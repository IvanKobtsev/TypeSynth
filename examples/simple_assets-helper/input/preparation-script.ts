import { readdir, stat } from "fs/promises";
import path from "path";

async function getFiles(dir: string) {
  let results: string[] = [];

  const items = await readdir(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = await stat(fullPath);

    if (stats.isDirectory()) {
      results = results.concat(await getFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

function getNameFromPath(
  path: string,
  includeExtension: boolean = true,
): string {
  return includeExtension
    ? (path.split("\\").pop() ?? "")
    : path.slice(path.lastIndexOf("\\") + 1, path.lastIndexOf("."));
}

/**
 *  Example of preparation script that reads the contents of some assets folder
 *  into an object for Handlebars template input.
 */
export default async function preparationScript() {
  const sounds = (
    await getFiles("examples/simple_assets-helper/external-input")
  ).map((path) => ({
    name: getNameFromPath(path, false),
    path: path.replace(/\\/g, "/"),
  }));

  return { soundEffects: sounds };
}
