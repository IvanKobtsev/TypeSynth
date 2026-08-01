import fs from "node:fs";
import path from "node:path";
import { getDefaultExport } from "./file-helpers.js";
import { TypeSynthConfig } from "./types.js";

export const defaultConfigFile = "typesynth.config.ts";

export function defineConfig(config: TypeSynthConfig): TypeSynthConfig {
  return config;
}

export async function loadConfig(projectRoot: string): Promise<{
  config: TypeSynthConfig;
  configPath: string;
}> {
  const configPath = path.join(projectRoot, defaultConfigFile);
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `TypeSynth configuration not found: ${configPath}\nCreate ${defaultConfigFile} or use direct Handlebars flags with \"tsynth gen\".`,
    );
  }

  const config = await getDefaultExport(configPath);
  if (!config || typeof config !== "object" || !config.jobs) {
    throw new Error(`${defaultConfigFile} must default-export { jobs: { ... } }.`);
  }

  return { config, configPath };
}
