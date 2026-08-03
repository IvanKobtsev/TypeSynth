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
      `TypeSynth configuration not found: ${configPath}\nCreate ${defaultConfigFile} or use direct Handlebars flags with \"tsynth hbs\".`,
    );
  }

  const config = await getDefaultExport(configPath);
  if (!config || typeof config !== "object") {
    throw new Error(
      `${defaultConfigFile} must default-export a TypeSynth configuration.`,
    );
  }

  config.jobs ??= {};
  config.automs ??= {};
  const unknownAutoms = Object.keys(config.automs).filter(
    (name) => name !== "registry",
  );
  if (unknownAutoms.length > 0) {
    throw new Error(`Unknown TypeSynth autom(s): ${unknownAutoms.join(", ")}.`);
  }
  if (
    Object.keys(config.jobs).length === 0 &&
    Object.keys(config.automs).length === 0
  ) {
    throw new Error(
      `${defaultConfigFile} must define at least one job or autom.`,
    );
  }

  return { config, configPath };
}
