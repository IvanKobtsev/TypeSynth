import path from "node:path";
import { TypeSynthAutoms } from "./types.js";
import { RegistryAutomSession, runRegistryAutom } from "./registry-autom.js";
import { reporter } from "./reporter.js";
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
      await reporter.task(
        "autom:registry:once",
        "registry autom",
        () => runRegistryAutom(configDirectory, automs.registry ?? {}),
        "Registry autom generated successfully.",
      );
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
    if (
      options.debounceMs !== undefined &&
      (!Number.isFinite(options.debounceMs) || options.debounceMs < 0)
    ) {
      throw new Error(
        "Registry autom debounceMs must be a non-negative number.",
      );
    }
    const session = new RegistryAutomSession(configDirectory, options);
    try {
      await reporter.task(
        "autom:registry:initial",
        "registry autom",
        () => session.rebuild(),
        "Registry autom generated successfully.",
      );
    } catch (error) {
      reporter.error("Initial registry autom generation failed:", error);
    }
    const watcher = await watchJob(
      "autom:registry",
      {
        generate: async ({ changes }) => {
          await reporter.task(
            "autom:registry:update",
            "registry autom update",
            () => session.applyChanges(changes ?? []),
            "Registry autom generated successfully.",
          );
        },
        watch: {
          target: ["**/*.ts", "**/*.tsx", "tsconfig.json"],
          debounceMs: options.debounceMs ?? 100,
          script: (events) => {
            const filtered = events.filter((event) => {
              if (event.source !== "file") return true;
              const absolute = path.resolve(configDirectory, event.path);
              if (absolute === path.join(configDirectory, "tsconfig.json"))
                return true;
              if (
                absolute === session.outputRoot ||
                absolute.startsWith(`${session.outputRoot}${path.sep}`)
              )
                return false;
              if (
                session.outDir &&
                (absolute === session.outDir ||
                  absolute.startsWith(`${session.outDir}${path.sep}`))
              )
                return false;
              return true;
            });
            return filtered.length > 0 ? filtered : false;
          },
        },
      },
      configDirectory,
    );
    handles.push({
      async close() {
        await watcher.close();
        session.dispose();
      },
    });
  }
  return handles;
}
