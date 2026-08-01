import fs from "fs";
import fetch, { Response } from "node-fetch";
import https from "https";
import path from "path";
import { pathToFileURL } from "url";
import { build } from "esbuild";
import { HbsPartial } from "./hbs-process-helpers.js";
import { globalVariables } from "./hbs-process-helpers.js";
import { getMagicChecksum } from "./index.js";

const agent = new https.Agent({ rejectUnauthorized: false });

export async function getJson(source: string) {
  if (source.startsWith("http://") || source.startsWith("https://")) {
    let response: Response;
    try {
      response = await fetch(source, { agent });
    } catch (err) {
      throw new Error(`Failed to fetch JSON from URL: ${err}`);
    }

    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

    const responseText = await response.text();
    globalVariables.magic__checksum = await getMagicChecksum(responseText);

    return await JSON.parse(responseText);
  } else {
    return JSON.parse(fs.readFileSync(source, "utf8"));
  }
}

export async function getDefaultExport(source: string) {
  if (source.endsWith(".ts")) {
    const tempFolder = fs.mkdtempSync(
      path.join(path.dirname(path.resolve(source)), ".typesynth-"),
    );
    const tempFile = path.join(tempFolder, "script.mjs");

    try {
      await build({
        absWorkingDir: path.dirname(path.resolve(source)),
        stdin: {
          contents: fs.readFileSync(source, "utf8"),
          resolveDir: path.dirname(path.resolve(source)),
          sourcefile: path.basename(source),
          loader: "ts",
        },
        outfile: tempFile,
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        banner: {
          js: 'import { createRequire as __createRequire } from "module"; const require = __createRequire(import.meta.url);',
        },
      });

      return (await import(`${pathToFileURL(tempFile).href}?t=${Date.now()}`))
        .default;
    } finally {
      fs.rmSync(tempFolder, { recursive: true, force: true });
    }
  } else {
    return (
      await import(`${pathToFileURL(path.resolve(source)).href}?t=${Date.now()}`)
    ).default;
  }
}

export async function runPreparationScript(fullPath: string | undefined) {
  if (!fullPath) return undefined;

  const preparationScript = await getDefaultExport(fullPath);
  if (typeof preparationScript === "function") return await preparationScript();
  else
    throw new Error(
      `Failed to run preparation script: ${fullPath}. Default export is not a function.`,
    );
}

export function getAllHbsPartialsInFolder(folder: string) {
  const partials: HbsPartial[] = [];
  const files = fs.readdirSync(folder);

  for (const file of files) {
    if (file.endsWith(".hbs")) {
      const partialFullName = path.basename(file, ".hbs");
      if (partialFullName === "template") continue; // skip main template file

      const partialName = partialFullName.split("_")[2];
      const partialPath = path.join(folder, file);

      partials.push({
        name: partialName,
        content: fs.readFileSync(partialPath, "utf8"),
      });
    }
  }

  return partials;
}

export function getInputDataPath(hbsFolder: string) {
  const inputPath = path.join(hbsFolder, "input-data.json");

  return fs.existsSync(inputPath) ? inputPath : undefined;
}

export function getHbsHelpersAndTemplatePaths(hbsFolder: string) {
  const preparationScriptPath = path.join(hbsFolder, "preparation-script.ts");
  const helpersPath = path.join(hbsFolder, "hbs-helpers.ts");
  const templatePath = path.join(hbsFolder, "template.hbs");
  const partials = getAllHbsPartialsInFolder(hbsFolder);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }

  return {
    preparationScriptPath: fs.existsSync(preparationScriptPath)
      ? preparationScriptPath
      : undefined,
    hbsHelpersPath: fs.existsSync(helpersPath) ? helpersPath : undefined,
    templatePath: templatePath,
    hbsPartials: partials,
  };
}
