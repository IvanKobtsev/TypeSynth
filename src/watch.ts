import path from "node:path";
import { createHash } from "node:crypto";
import { watch, FSWatcher } from "chokidar";
import fetch from "node-fetch";
import picomatch from "picomatch";
import { runGenerator, runWatcherScript } from "./generator.js";
import { reporter } from "./reporter.js";
import { FileChange, FileChangeType, TypeSynthJob } from "./types.js";

const eventTypes = new Set<FileChangeType>([
  "add",
  "change",
  "unlink",
  "addDir",
  "unlinkDir",
]);

const isUrl = (target: string) => /^https?:\/\//i.test(target);
const normalizePath = (value: string) => value.replace(/\\/g, "/");

export type WatchHandle = {
  close(): Promise<void>;
};

export async function watchJob(
  jobName: string,
  job: TypeSynthJob<any>,
  configDirectory: string,
): Promise<WatchHandle> {
  if (!job.watch)
    throw new Error(`Job \"${jobName}\" has no watch configuration.`);
  const targets = Array.isArray(job.watch.target)
    ? job.watch.target
    : [job.watch.target];
  if (targets.length === 0 || targets.some((target) => !target)) {
    throw new Error(
      `Job \"${jobName}\" must define at least one watch target.`,
    );
  }

  const urlTargets = targets.filter(isUrl);
  const localPatterns = targets.filter((target) => !isUrl(target));
  let generationScriptPath: string | undefined;
  if (
    typeof job.generate === "string" &&
    job.watch.watchGenerationScript !== false
  ) {
    generationScriptPath = path.resolve(configDirectory, job.generate);
    localPatterns.push(
      normalizePath(path.relative(configDirectory, generationScriptPath)),
    );
  }
  const matches = localPatterns.length
    ? picomatch(localPatterns.map(normalizePath), { dot: true })
    : () => false;
  const debounce = job.watch.debounceMs ?? 500;
  if (!Number.isFinite(debounce) || debounce < 0) {
    throw new Error(
      `Job \"${jobName}\" debounceMs must be a non-negative number.`,
    );
  }
  const pollInterval = job.watch.urlPollIntervalMs ?? 5000;
  if (!Number.isFinite(pollInterval) || pollInterval <= 0) {
    throw new Error(
      `Job \"${jobName}\" urlPollIntervalMs must be a positive number.`,
    );
  }

  let queued = new Map<string, FileChange>();
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let pending = false;
  let closed = false;
  const pollTimers = new Set<NodeJS.Timeout>();
  const pollControllers = new Set<AbortController>();

  const execute = async () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      do {
        pending = false;
        const events = [...queued.values()];
        queued = new Map();
        if (events.length === 0) continue;
        try {
          const changes = await runWatcherScript(
            jobName,
            job,
            configDirectory,
            events,
          );
          if (changes !== false) {
            const generate = () =>
              runGenerator(jobName, job, configDirectory, {
                trigger: "watch",
                changes,
                projectRoot: configDirectory,
                jobName,
              });
            if (jobName.startsWith("autom:")) {
              await generate();
            } else {
              await reporter.task(
                `watch:${jobName}`,
                `job \"${jobName}\"`,
                generate,
                `Generated \"${jobName}\" from ${events.length} change(s).`,
              );
            }
          }
        } catch (error) {
          reporter.error(`TypeSynth watch job \"${jobName}\" failed:`, error);
        }
      } while (pending || queued.size > 0);
    } finally {
      running = false;
    }
  };

  const enqueue = (change: FileChange) => {
    queued.set(`${change.source}:${change.path}`, change);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void execute(), debounce);
  };

  let fileWatcher: FSWatcher | undefined;
  if (localPatterns.length > 0) {
    const watchPaths = [configDirectory];
    if (
      generationScriptPath &&
      normalizePath(
        path.relative(configDirectory, generationScriptPath),
      ).startsWith("../")
    ) {
      watchPaths.push(generationScriptPath);
    }
    fileWatcher = watch(watchPaths, {
      ignoreInitial: true,
      persistent: true,
      ignored: (watchedPath) => {
        const relative = normalizePath(
          path.relative(configDirectory, path.resolve(watchedPath)),
        );
        return (
          relative === ".git" ||
          relative.startsWith(".git/") ||
          relative === "node_modules" ||
          relative.startsWith("node_modules/") ||
          relative.split("/").some((part) => part.startsWith(".typesynth-"))
        );
      },
    });
    fileWatcher.on("all", (eventName, changedPath) => {
      if (!eventTypes.has(eventName as FileChangeType)) return;
      const relativePath = normalizePath(
        path.relative(configDirectory, path.resolve(changedPath)),
      );
      if (!matches(relativePath)) return;
      enqueue({
        path: relativePath,
        type: eventName as FileChangeType,
        source: "file",
      });
    });
    await new Promise<void>((resolve, reject) => {
      fileWatcher!.once("ready", resolve);
      fileWatcher!.once("error", reject);
    });
  }

  const startUrlPoller = async (url: string) => {
    let checksum: string | undefined;
    const poll = async () => {
      if (closed) return;
      const controller = new AbortController();
      pollControllers.add(controller);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok)
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        const body = Buffer.from(await response.arrayBuffer());
        const nextChecksum = createHash("sha256").update(body).digest("hex");
        if (checksum !== undefined && checksum !== nextChecksum) {
          enqueue({ path: url, type: "change", source: "url" });
        }
        checksum = nextChecksum;
      } catch (error) {
        if (!closed) {
          reporter.error(
            `TypeSynth URL poll for job \"${jobName}\" failed (${url}):`,
            error,
          );
        }
      } finally {
        pollControllers.delete(controller);
        if (!closed) {
          const nextTimer = setTimeout(() => {
            pollTimers.delete(nextTimer);
            void poll();
          }, pollInterval);
          pollTimers.add(nextTimer);
        }
      }
    };
    await poll();
  };

  await Promise.all(urlTargets.map(startUrlPoller));

  return {
    async close() {
      closed = true;
      if (timer) clearTimeout(timer);
      for (const pollTimer of pollTimers) clearTimeout(pollTimer);
      pollTimers.clear();
      for (const controller of pollControllers) controller.abort();
      pollControllers.clear();
      if (fileWatcher) await fileWatcher.close();
    },
  };
}
