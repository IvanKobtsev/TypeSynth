import path from "node:path";
import { getDefaultExport } from "./file-helpers.js";
import type { TypeSynthJobs } from "./types.js";

export const defaultConfigFile = "typesynth.config.ts";
export function defineJobs<T extends TypeSynthJobs>(jobs: T): T {
  return jobs;
}
export async function loadConfig(projectRoot: string) {
  const configPath = path.join(projectRoot, defaultConfigFile);
  const jobs = await getDefaultExport(configPath);
  if (!jobs || typeof jobs !== "object" || Array.isArray(jobs) || !Object.keys(jobs).length)
    throw new Error(`${defaultConfigFile} must default-export a nonempty job map.`);
  return { jobs: jobs as TypeSynthJobs, configPath };
}
