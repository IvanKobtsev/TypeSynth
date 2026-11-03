import { createHash } from "node:crypto";
export async function getMagicChecksum(text: string): Promise<string> {
  return createHash("sha256").update(text).digest("hex");
}
export { defineJobs } from "./config.js";
export type {
  Generate,
  GeneratorContext,
  GeneratorScriptProps,
  GeneratorScript,
  TypeSynthJob,
  TypeSynthJobs,
} from "./types.js";
