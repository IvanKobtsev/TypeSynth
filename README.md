# TypeSynth

TypeSynth generates source files from your existing TypeScript project structure. It supports unrestricted TypeScript generators and the Handlebars generation workflow from hbs-magic.

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
    },
    api: {
      generate: hbsGenerator({
        sources: "./generation/api",
        output: "./src/api.gen.ts",
      }),
    },
  },
});
```

Run every job or a named subset:

```bash
tsynth gen
tsynth gen assets api
```

## Generator scripts

A generator owns its output and may use any TypeScript APIs or libraries:

```ts
import type { GeneratorScript } from "typesynth";

const generate: GeneratorScript = async ({ projectRoot, jobName }) => {
  // Inspect the project, render Handlebars, or write raw files here.
  console.log(projectRoot, jobName);
};

export default generate;
```

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

## CLI output

Interactive terminals show a loading spinner while TypeSynth generates. Redirected and CI output uses stable `Processing …` lines instead. Successful generation is green, warnings are yellow, and errors are red. TypeSynth respects `NO_COLOR` and `FORCE_COLOR`.

## License

[MIT](LICENSE) © Ivan Kobtsev
