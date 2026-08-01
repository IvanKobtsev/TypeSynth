import path from "node:path";
import { watch, FSWatcher } from "chokidar";
import picomatch from "picomatch";
import { runGenerator, runWatcherScript } from "./generator.js";
import { FileChange, FileChangeType, TypeSynthJob } from "./types.js";

const eventTypes = new Set<FileChangeType>([
  "add",
  "change",
  "unlink",
  "addDir",
  "unlinkDir",
]);

export async function watchJob(
  jobName: string,
  job: TypeSynthJob<any>,
  configDirectory: string,
): Promise<FSWatcher> {
  if (!job.watch) throw new Error(`Job \"${jobName}\" has no watch configuration.`);
  const patterns = Array.isArray(job.watch.files)
    ? job.watch.files
    : [job.watch.files];
  if (patterns.length === 0 || patterns.some((pattern) => !pattern)) {
    throw new Error(`Job \"${jobName}\" must define at least one watch glob.`);
  }
  const matches = picomatch(patterns, { dot: true });
  const debounce = job.watch.debounce ?? 100;
  if (!Number.isFinite(debounce) || debounce < 0) {
    throw new Error(`Job \"${jobName}\" debounce must be a non-negative number.`);
  }

  let queued = new Map<string, FileChange>();
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let pending = false;

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
            await runGenerator(jobName, job, configDirectory, {
              trigger: "watch",
              changes,
              projectRoot: configDirectory,
              jobName,
            });
            console.log(`Generated \"${jobName}\" from ${events.length} change(s).`);
          }
        } catch (error) {
          console.error(`TypeSynth watch job \"${jobName}\" failed:`, error);
        }
      } while (pending || queued.size > 0);
    } finally {
      running = false;
    }
  };

  const watcher = watch(configDirectory, {
    ignoreInitial: true,
    persistent: true,
    ignored: (watchedPath) => {
      const relative = path
        .relative(configDirectory, path.resolve(watchedPath))
        .replace(/\\/g, "/");
      return (
        relative === ".git" ||
        relative.startsWith(".git/") ||
        relative === "node_modules" ||
        relative.startsWith("node_modules/") ||
        relative.split("/").some((part) => part.startsWith(".typesynth-"))
      );
    },
  });
  watcher.on("all", (eventName, changedPath) => {
    if (!eventTypes.has(eventName as FileChangeType)) return;
    const relativePath = path
      .relative(configDirectory, path.resolve(changedPath))
      .replace(/\\/g, "/");
    if (!matches(relativePath)) return;
    queued.set(relativePath, {
      path: relativePath,
      type: eventName as FileChangeType,
    });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void execute(), debounce);
  });

  await new Promise<void>((resolve, reject) => {
    watcher.once("ready", resolve);
    watcher.once("error", reject);
  });

  return watcher;
}
