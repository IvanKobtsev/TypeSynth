export async function getMagicChecksum(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export { defineConfig } from "./config.js";
export { hbsGenerator } from "./hbs-generator.js";
export type { HbsGeneratorOptions } from "./hbs-generator.js";
export type {
  FileChange,
  FileChangeType,
  GeneratorContext,
  GeneratorScript,
  GeneratorTrigger,
  RegistryAutomOptions,
  TypeSynthAutoms,
  TypeSynthConfig,
  TypeSynthJob,
  TypeSynthWatchOptions,
  WatcherContext,
  WatcherScript,
} from "./types.js";
