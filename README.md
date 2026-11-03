# TypeSynth

Generate source files with Handlebars templates, shared helpers, and TypeScript generation scripts.

```sh
npm install --save-dev typesynth
```

## Jobs

Create `typesynth.config.ts` in your project root:

```ts
import { defineJobs } from "typesynth";

export default defineJobs({
  signalR: {
    sources: "./generation/signal-r",
    output: "./src/clients/signal-r",
    overrides: { dtos: "./generation/custom-dtos.hbs" },
  },
});
```

```sh
 typesynth generate          # All jobs
 typesynth generate signalR  # Selected jobs
```

`tsynth` is an equivalent binary alias. Paths resolve relative to the config directory. Paths beginning with `@/` resolve through your tsconfig `paths` mappings, including inherited mappings and `baseUrl`; they do not automatically mean the project root.

## Multiple files

A sources folder can contain:

```text
main.ts
input-data.json
preparation-script.ts
hbs-helpers.ts
template_partial_header.hbs
templates/
  hubs.hbs
  dtos.hbs
  hubContract.hbs
```

Only `main.ts` and the templates it uses are required, plus an input data source. The default export of `main.ts` controls which files are generated:

```ts
import type { GeneratorScriptProps } from "typesynth";

export default async function main({ data, generate }: GeneratorScriptProps) {
  await generate("hubs", data, "./hubs.ts");
  await generate("dtos", data, "./DTOs.ts");

  for (const [name, hub] of Object.entries(data["x-signal-r-client"].hubs)) {
    await generate("hubContract", hub, `./${name}/${name}Contract.ts`);
  }
}
```

`generate(name, data, relativeOutputPath)` returns a promise. Await each call. Names omit `.hbs`; nested names such as `contracts/hub` are supported. Each call uses exactly its supplied data, with `magic__checksum` added as a SHA-256 checksum of that data. Output paths resolve within the job's output directory; parent directories are created automatically. Absolute paths and paths escaping that directory are rejected.

Helpers and partials load once and are shared within a job, isolated from other jobs. `hbs-helpers.ts` default-exports an object of helper functions. Root-level `template_partial_header.hbs` registers the `header` partial. Preparation runs once per job. `GeneratorScriptProps<TData>` optionally types your input; props also include `projectRoot` and `jobName`.

See [the multi-file example](examples/multi-file/typesynth.config.ts) for shared helpers and an override. Run it from `examples/multi-file` with `typesynth generate` after installing the package.

## Input and overrides

Jobs accept `input` (a JSON path or HTTP(S) URL) and `formatting` (defaults to `true`). Data priority is explicit `input`, the result of the default-exported function in `preparation-script.ts`, then `input-data.json`. Preparation still runs when explicit input is supplied.

`overrides` maps template names to replacement `.hbs` paths, resolved relative to the config directory or through tsconfig aliases. Overrides may introduce templates absent from `templates/`.

## Direct CLI

Direct jobs execute the same pipeline without a config file:

```sh
typesynth generate --sources=./generation --output=./src/generated --override=hubs=./custom-hubs.hbs --override=dtos=./custom-dtos.hbs
```

Repeat `--override=name=path` as needed. Quote the entire argument for paths containing spaces. Duplicate names are rejected. Direct paths resolve from the current directory. Add `--input=./schema.json` or `--disable-formatting` as needed. Direct options cannot be mixed with configured job names.

## Single-file templates

Without `main.ts`, TypeSynth renders `sources/template.hbs` and treats `output` as a file path. Existing helpers, partials, and input loading still apply. The override name for this template is `template`.

Generated JS/TS files use oxfmt; C# uses CSharpier. Unsupported extensions require formatting to be disabled. Generation stops on failure; already written files remain, and stale outputs are not deleted.

## Migration

Replace `defineConfig({ jobs: ... })` with `defineJobs({ ... })`, and replace `hbsGenerator(...)` jobs with their literal options. Unrestricted generator jobs are removed. Replace `tsynth gen` and `tsynth hbs` with `typesynth generate`. Multi-file generation scripts belong in `sources/main.ts`.

## Development

```sh
npm test
```

This builds the package and runs the Node test suite.

## License

[MIT](LICENSE)
