import path from "node:path";
import { TypeSynthAutoms } from "./types.js";
import { getRegistryProjectPaths, runRegistryAutom } from "./registry-autom.js";
import { watchJob, WatchHandle } from "./watch.js";

export type AutomName = keyof TypeSynthAutoms;

export function selectAutoms(
  automs: TypeSynthAutoms,
  requested: string[],
): AutomName[] {
  const available = Object.keys(automs) as AutomName[];
  const selected = requested.length > 0 ? requested : available;
  const unknown = selected.filter((name) => !(name in automs));
  if (unknown.length > 0)
    throw new Error(`Unknown TypeSynth autom(s): ${unknown.join(", ")}.`);
  if (selected.length === 0)
    throw new Error("TypeSynth configuration does not define any automs.");
  return selected as AutomName[];
}

export async function runAutomsOnce(
  automs: TypeSynthAutoms,
  selected: AutomName[],
  configDirectory: string,
) {
  for (const name of selected) {
    if (name === "registry") {
      await runRegistryAutom(configDirectory, automs.registry ?? {});
    }
  }
}

export async function watchAutoms(
  automs: TypeSynthAutoms,
  selected: AutomName[],
  configDirectory: string,
): Promise<WatchHandle[]> {
  const handles: WatchHandle[] = [];
  for (const name of selected) {
    if (name !== "registry") continue;
    const options = automs.registry ?? {};
    const { outputRoot, outDir } = getRegistryProjectPaths(configDirectory);
    try {
      await runRegistryAutom(configDirectory, options);
    } catch (error) {
      console.error(`Initial registry autom generation failed:`, error);
    }
    handles.push(
      await watchJob(
        "autom:registry",
        {
          generate: async () => runRegistryAutom(configDirectory, options),
          watch: {
            target: ["**/*.ts", "**/*.tsx", "tsconfig.json"],
            script: (events) => {
              const filtered = events.filter((event) => {
                if (event.source !== "file") return true;
                const absolute = path.resolve(configDirectory, event.path);
                if (absolute === path.join(configDirectory, "tsconfig.json"))
                  return true;
                if (
                  absolute === outputRoot ||
                  absolute.startsWith(`${outputRoot}${path.sep}`)
                )
                  return false;
                if (
                  outDir &&
                  (absolute === outDir ||
                    absolute.startsWith(`${outDir}${path.sep}`))
                )
                  return false;
                return true;
              });
              return filtered.length > 0 ? filtered : false;
            },
          },
        },
        configDirectory,
      ),
    );
  }
  return handles;
}
