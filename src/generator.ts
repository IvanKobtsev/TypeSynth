import path from "node:path";
import { getDefaultExport } from "./file-helpers.js";
import {
  GeneratorContext,
  GeneratorScript,
  TypeSynthJob,
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

export async function runGenerator(
  jobName: string,
  job: TypeSynthJob,
  configDirectory: string,
  context: GeneratorContext,
) {
  const generator = await resolveScript<GeneratorScript>(
    job.generate,
    configDirectory,
    `Generator for job \"${jobName}\"`,
  );
  await generator(context);
}

