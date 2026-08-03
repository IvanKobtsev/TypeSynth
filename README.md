# TypeSynth

TypeSynth generates source files from your existing TypeScript project structure. It supports unrestricted TypeScript generators, incremental watching, and the Handlebars generation workflow from hbs-magic.

## Installation

```bash
npm install --save-dev typesynth
```

or

```bash
yarn add -D typesynth
```

## Configured generators

Create `typesynth.config.ts` in the project root:

```ts
import { defineConfig, hbsGenerator } from "typesynth";

export default defineConfig({
  jobs: {
    assets: {
      generate: "./scripts/generate-assets.ts",
      watch: {
        target: "assets/**/*",
        debounceMs: 250,
        script: "./scripts/watch-assets.ts",
      },
    },
    api: {
      generate: hbsGenerator({
        sources: "./generation/api",
        output: "./src/api.gen.ts",
      }),
      watch: {
        target: "https://example.com/schema.json",
      },
    },
  },
  automs: {
    registry: {}
  },
});
```

Run every job or a named subset:

```bash
tsynth gen
tsynth gen assets api
tsynth watch
tsynth watch assets
```

`watch` runs each selected generator once at startup. After that it debounces matching add, change, and delete events. Runs never overlap for the same job; changes received during generation are combined into one subsequent run.

When `generate` is a script path, TypeSynth watches that script automatically. Set `watchGenerationScript: false` in the watch options to disable the automatic target.

Targets may mix local globs and HTTP(S) URLs. URLs are polled every five seconds by default; set `urlPollIntervalMs` to override that interval. The first successful response establishes a checksum baseline, and subsequent polls trigger generation only when the response body changes.

## Automs

Automs are TypeSynth-provided generation workflows. Run them once or keep them and your jobs synchronized:

```bash
tsynth automs
tsynth automs registry
tsynth start jobs
tsynth start automs
tsynth start all
```

### Registry autom

Mark a type as a registry and export values that consume it:

```ts
/** @registry Modal */
export interface GlobalModalProps<TData = {}> {
  data: TData;
}

/** @register Modal */ 
//  ^^^^^^^^^^^^^^^    Can be omitted for components and hooks with a single argument unless "useManualRegistration" is set to "true"
export function ConfirmationModal(
  props: GlobalModalProps<{ message: string }>,
) {
  return props.data.message;
}

/** @register Modal */
export function ScheduleModal(
  props: GlobalModalProps<{ title: string }>,
) {
    return props.data.title;
}
```

TypeSynth automatically infers exported single-argument functions that use the registry type. Set `useManualRegistration: true` to require annotations for every value.

_The example generates `tsynth-gen/registry/modalRegistry.gen.ts` beneath the tsconfig `baseUrl`, or beside `typesynth.config.ts` when no `baseUrl` is configured:_

```ts
export enum ModalType {
  Confirmation = "Confirmation",
  Schedule = "Schedule",
}

export const ModalMap = {
  [ModalType.Confirmation]: ConfirmationModal,
  [ModalType.Schedule]: ScheduleModal,
} as const;
```

Use `@registry Modal modals/custom.gen.ts` to choose a nested path beneath `tsynth-gen/registry`. Absolute paths, paths escaping that folder, and non-`.ts` outputs are rejected. Imports prefer tsconfig path aliases and otherwise use relative paths.

## Generator scripts

A generator owns its output and may use any TypeScript APIs or libraries:

```ts
import type { GeneratorScript } from "typesynth";

const generate: GeneratorScript = async ({ trigger, changes, projectRoot }) => {
  // Inspect the project, render Handlebars, or write raw files here.
  console.log(trigger, changes, projectRoot);
};

export default generate;
```

For `tsynth gen` and the initial `tsynth watch` run, `changes` is `undefined`. Subsequent watch runs receive the watcher script's result, or the raw event list when no watcher script is configured.

## Watcher scripts

A watcher script receives a debounced batch. Return transformed data for the generator, or `false` to skip that batch:

```ts
import type { WatcherScript } from "typesynth";

const watchAssets: WatcherScript<string[]> = (events) => {
  const changedImages = events
    .filter(({ path, type }) => type !== "unlinkDir" && path.endsWith(".png"))
    .map(({ path }) => path);

  return changedImages.length > 0 ? changedImages : false;
};

export default watchAssets;
```

Paths in local file events are project-relative and use `/` separators. Event types are `add`, `change`, `unlink`, `addDir`, and `unlinkDir`. Every event has `source: "file" | "url"`; URL changes use the URL as `path` and `type: "change"`.

## Handlebars generation

If you want a simple template-driven generation, TypeSynth got you covered with its Handlebars CLI integration:

```bash
tsynth hbs --sources=gen/input --output=src/result.gen.ts
tsynth hbs --sources=gen/client --input=https://example.com/schema.json --output=src/client.gen.ts
```

The sources folder may contain:

- `template.hbs` (required)
- `input-data.json`
- `preparation-script.ts`, default-exporting a function that can prepare the template data
- `hbs-helpers.ts`, default-exporting an object of Handlebars helpers
- `template_partial_*.hbs`

Input priority is `--input`, the preparation script result, then `input-data.json`.

## License

[MIT](LICENSE) © Ivan Kobtsev
