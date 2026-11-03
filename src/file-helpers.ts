import fs from "fs";
import fetch, { Response } from "node-fetch";
import https from "https";
import path from "path";
import { pathToFileURL } from "url";
import { build } from "esbuild";

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

    return await JSON.parse(responseText);
  } else {
    return JSON.parse(fs.readFileSync(source, "utf8"));
  }
}

export async function getDefaultExport(source: string) {
  if (source.endsWith(".ts")) {
    const tempFolder = fs.mkdtempSync(path.join(path.dirname(path.resolve(source)), ".typesynth-"));
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

      return (await import(`${pathToFileURL(tempFile).href}?t=${Date.now()}`)).default;
    } finally {
      fs.rmSync(tempFolder, { recursive: true, force: true });
    }
  } else {
    return (await import(`${pathToFileURL(path.resolve(source)).href}?t=${Date.now()}`)).default;
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

export function getInputDataPath(folder: string) {
  const input = path.join(folder, "input-data.json");
  return fs.existsSync(input) ? input : undefined;
}
