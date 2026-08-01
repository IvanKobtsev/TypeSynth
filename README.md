# TypeSynth

TypeSynth generates source files from your existing TypeScript project structure. It supports unrestricted TypeScript generators, incremental watching, and the Handlebars generation workflow from hbs-magic.

## Installation

```bash
npm install --save-dev typesynth
```

## Handlebars generation

The existing Handlebars workflow is available directly under `gen`:

```bash
tsynth gen --sources=gen/input --output=src/result.gen.ts
tsynth gen --sources=gen/input --output=src/client.gen.ts --input=https://example.com/schema.json
```

`--hbs` is an alias for `--sources`. Add `--disable-formatting` to skip Prettier or CSharpier.

The sources folder may contain:

- `template.hbs` (required)
- `input-data.json`
- `preparation-script.ts`, default-exporting a function that returns template data
- `hbs-helpers.ts`, default-exporting an object of Handlebars helpers
- `template_partial_*.hbs`

Input priority is `--input`, the preparation script result, then `input-data.json`.

## Configured generators

Create `typesynth.config.ts` in the project root:

```ts
import { defineConfig, hbsGenerator } from "typesynth";

export default defineConfig({
  jobs: {
    assets: {
      generate: "./scripts/generate-assets.ts",
      watch: {
        files: ["assets/**/*", "scripts/generate-assets.ts"],
        debounce: 150,
        script: "./scripts/watch-assets.ts",
      },
    },
    api: {
      generate: hbsGenerator({
        sources: "./generation/api",
        output: "./src/api.gen.ts",
      }),
      watch: {
        files: "generation/api/**/*",
      },
    },
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

Paths in file events are project-relative and use `/` separators. Event types are `add`, `change`, `unlink`, `addDir`, and `unlinkDir`.

## Built-in generators

TypeSynth is intended to include generators for common patterns. Registry generation is planned but is not implemented in this release.

## License

[MIT](LICENSE) © Ivan Kobtsev
