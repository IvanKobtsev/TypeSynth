import path from "node:path";
import { getDefaultExport } from "./file-helpers.js";
import {
  FileChange,
  GeneratorContext,
  GeneratorScript,
  TypeSynthJob,
  WatcherScript,
} from "./types.js";

async function resolveScript<T extends Function>(
  script: string | T,
  configDirectory: string,
  label: string,
): Promise<T> {
  const loaded =
    typeof script === "string"
      ? await getDefaultExport(path.resolve(configDirectory, script))
      : script;

  if (typeof loaded !== "function") {
    throw new Error(`${label} must default-export a function.`);
  }
  return loaded as T;
}

export async function runGenerator<TChanges>(
  jobName: string,
  job: TypeSynthJob<TChanges>,
  configDirectory: string,
  context: GeneratorContext<TChanges>,
) {
  const generator = await resolveScript<GeneratorScript<TChanges>>(
    job.generate,
    configDirectory,
    `Generator for job \"${jobName}\"`,
  );
  await generator(context);
}

export async function runWatcherScript<TChanges>(
  jobName: string,
  job: TypeSynthJob<TChanges>,
  configDirectory: string,
  events: FileChange[],
): Promise<TChanges | FileChange[] | false> {
  if (!job.watch?.script) return events;
  const watcher = await resolveScript<WatcherScript<TChanges>>(
    job.watch.script,
    configDirectory,
    `Watcher for job \"${jobName}\"`,
  );
  return await watcher(events, {
    projectRoot: configDirectory,
    jobName,
  });
}
