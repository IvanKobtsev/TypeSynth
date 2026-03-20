#  hbs-magic

A CLI tool designed to simplify source-code generation with [Handlebars](https://handlebarsjs.com/) templates as much as humanly possible.

Point it at a folder with a `.hbs` template, give it some data — and it generates a fully formatted source file. That's it.

## Installation

```bash
yarn add -D hbs-magic
```
Or
```bash
npm install -D hbs-magic
```


## Quick Start

### 1. Create an input folder with a template and some data

```
my-gen/
  template.hbs
  input-data.json
```

**`input-data.json`**
```json
{
  "greeting": "Hello",
  "items": ["Apple", "Banana", "Cherry"]
}
```

**`template.hbs`**
```handlebars
// {{greeting}}, World!

{{#each items}}
export const {{this}} = "{{this}}";
{{/each}}
```

### 2. Run hbs-magic

```bash
hbs-magic --hbs=my-gen --output=result.gen.ts
```

### 3. Get a formatted output file ✅

**`result.gen.ts`**
```typescript
// Hello, World!

export const Apple = "Apple";
export const Banana = "Banana";
export const Cherry = "Cherry";
```

That's all it takes. No config files, no boilerplate — just a template and data.

---

## How It Works

Everything lives inside a single **input folder** (the `--hbs` folder). Depending on your needs, it can contain:

| File                         | Purpose                                                      |
|------------------------------|--------------------------------------------------------------|
| `template.hbs`               | The Handlebars template to render                            |
| `input-data.json`            | Static JSON data for the template                            |
| `preparation-script.ts`      | A script that programmatically builds the data object        |
| `hbs-helpers.ts`             | Custom Handlebars helpers                                    |
| `template_partial_*.hbs`     | Handlebars partials (named by the part after the second `_`) |

> If multiple data sources are provided, priority is: `--input` flag → `preparation-script` → `input-data.json`.

---

## CLI Usage

```
hbs-magic --hbs=<folder> --output=<file> [--input=<json>] [--disable-formatting]
```

| Flag | Description |
|---|---|
| `--hbs` | **(required)** Path to the folder containing your template, data, helpers, etc. |
| `--output` | **(required)** Path for the generated output file |
| `--input` | Optional external JSON data source — a local file path **or a URL** |
| `--disable-formatting` | Skip auto-formatting the output (Prettier for JS/TS, CSharpier for C#) |

---

## Data Input — Three Ways

### Option A: Static JSON — `input-data.json`

The simplest approach. Just drop a JSON file into the input folder:

```
my-gen/
  template.hbs
  input-data.json      ← hbs-magic picks this up automatically
```

### Option B: Preparation Script — `preparation-script.ts`

Need to compute data dynamically? Export a default function that returns the data object:

```
my-gen/
  template.hbs
  preparation-script.ts
```

```typescript
// preparation-script.ts
export default async function () {
  // Read files, call APIs, parse ASTs — whatever you need
  return {
    items: ["generated", "at", "build-time"],
  };
}
```

The function can be `async`. hbs-magic will bundle and execute it for you (TypeScript supported out of the box).

### Option C: External JSON via `--input` flag

Pass a local file or a remote URL:

```bash
# From a local file
hbs-magic --hbs=my-gen --output=result.ts --input=./data.json

# From an API endpoint
hbs-magic --hbs=my-gen --output=result.ts --input=https://api.example.com/data.json
```

---

## Custom Handlebars Helpers — `hbs-helpers.ts`

Export a default object whose keys are helper names and values are helper functions:

```
my-gen/
  template.hbs
  input-data.json
  hbs-helpers.ts       ← automatically registered
```

```typescript
// hbs-helpers.ts
function shout(text: string) {
  return text.toUpperCase() + "!!!";
}

function isEven(index: number) {
  return index % 2 === 0;
}

export default { shout, isEven };
```

Then use them in your template:

```handlebars
{{#each items}}
  {{shout this}}
{{/each}}
```

---

## Handlebars Partials

Any `.hbs` file in the input folder (other than `template.hbs`) is registered as a partial. The partial name is taken from the **third segment** of the filename, split by `_`:

```
template_partial_node.hbs  →  partial name: "node"
template_partial_row.hbs   →  partial name: "row"
```

Use them in your template with `{{> node}}` or `{{> row}}`.

Partials are great for recursive structures — like rendering a nested tree of routes (see the [Advanced Example](#3-advanced--c-url-helpers-with-partials-preparation-script-and-helpers) below).

---

## Auto-Formatting

hbs-magic automatically formats the generated output file based on its extension:

| Extension | Formatter |
|---|---|
| `.ts`, `.tsx`, `.js`, `.jsx` | [Prettier](https://prettier.io/) |
| `.cs` | [CSharpier](https://csharpier.com/) |

You can disable it with `--disable-formatting`.

---

## Examples

### 1. Simple — Assets Helper (Preparation Script)

> Scans a folder of audio files and generates a typed TypeScript module with imports, an enum, and a record.

**Folder structure:**
```
examples/simple_assets-helper/
  external-input/
    dummy_audio_1.mp3
    dummy_audio_2.mp3
    dummy_audio_3.mp3
  input/
    preparation-script.ts
    template.hbs
```

**Run:**
```bash
hbs-magic --hbs=examples/simple_assets-helper/input --output=examples/simple_assets-helper/Result.gen.ts
```

**Generated `Result.gen.ts`:**
```typescript
import dummy_audio_1SFX from "examples/simple_assets-helper/external-input/dummy_audio_1.mp3";
import dummy_audio_2SFX from "examples/simple_assets-helper/external-input/dummy_audio_2.mp3";
import dummy_audio_3SFX from "examples/simple_assets-helper/external-input/dummy_audio_3.mp3";

export enum SoundEffect {
  dummy_audio_1 = "dummy_audio_1",
  dummy_audio_2 = "dummy_audio_2",
  dummy_audio_3 = "dummy_audio_3",
}

export const SoundEffects: Record<SoundEffect, SoundSource> = {
    [SoundEffect.dummy_audio_1]: {
        src: dummy_audio_1SFX,
        name: SoundEffect.dummy_audio_1,
    },
    [SoundEffect.dummy_audio_2]: {
        src: dummy_audio_2SFX,
        name: SoundEffect.dummy_audio_2,
    },
    [SoundEffect.dummy_audio_3]: {
        src: dummy_audio_3SFX,
        name: SoundEffect.dummy_audio_3,
    },
};
```

---

### 2. From API — TypeScript API Client (Helpers + External JSON)

> Fetches an OpenAPI spec from a URL and generates TypeScript functions for every endpoint.

**Folder structure:**
```
examples/from-api_ts-api-client/
  input/
    template.hbs
    hbs-helpers.ts
```

**Run** (note the `--input` pointing to a live API):
```bash
hbs-magic \
  --input=https://petstore3.swagger.io/api/v3/openapi.json \
  --hbs=examples/from-api_ts-api-client/input \
  --output=examples/from-api_ts-api-client/Result.gen.ts
```

**Generated `Result.gen.ts`** (excerpt):
```typescript
export async function findPetsByStatus(status: string) {
  console.log("Calling get /pet/findByStatus");
}

export async function getPetById(petId: number) {
  console.log("Calling get /pet/{petId}");
}

export async function loginUser(username: string, password: string) {
  console.log("Calling get /user/login");
}
// ... and every other endpoint from the Swagger Petstore
```

---

### 3. Advanced — C# URL Helpers with Partials, Preparation Script, and Helpers

> Parses a TypeScript route definition file (using `ts-morph`), extracts route/param info, and generates a full C# helper class with nested static classes, query parameter models, and link-builder methods — using **partials** for recursive rendering.

**Folder structure:**
```
examples/advanced_csharp-url-helpers/
  external-input/
    links.ts                          ← source routes file (react-router-url-params)
  input/
    preparation-script.ts             ← parses links.ts via ts-morph AST
    hbs-helpers.ts                    ← TS→C# type converters
    template.hbs                      ← main template
    template_partial_node.hbs         ← recursive partial for nested route groups
    input-data.json                   ← generated intermediate JSON (by prep script)
```

**Run:**
```bash
hbs-magic \
  --hbs=examples/advanced_csharp-url-helpers/input \
  --output=examples/advanced_csharp-url-helpers/Result.gen.cs
```

**Generated `Result.gen.cs`** (excerpt):
```csharp
public static class Routes
{
    public static class Unauthorized
    {
        public static class Login
        {
            public static string Link(string siteUrl, LoginQueryParams queryParams) =>
                siteUrl + "/login" + "?" + queryParams.GetQueryString();
        }

        public static class ConfirmEmail
        {
            public static string Link(string siteUrl, string userId, string token) =>
                siteUrl + "/confirm-email/:userId/:token"
                    .Replace(":userId", userId.ToString())
                    .Replace(":token", token.ToString());
        }
    }

    public static class Authorized
    {
        // ... deeply nested route groups with full C# link builders
    }
}

public class LoginQueryParams : IRouteQueryParams
{
    public string? Redirect { get; init; }

    public string GetQueryString()
    {
        var queryParams = new List<string>();
        if (!string.IsNullOrEmpty(Redirect))
            queryParams.Add($"redirect={Redirect}");
        return string.Join("&", queryParams);
    }
}
```

---

## Adding to `package.json` scripts

A convenient pattern is to add generation commands as npm scripts:

```json
{
  "scripts": {
    "gen:assets": "hbs-magic --hbs=src/gen/assets/input --output=src/generated/assets.gen.ts",
    "gen:api":    "hbs-magic --input=https://api.example.com/openapi.json --hbs=src/gen/api/input --output=src/generated/api-client.gen.ts",
    "gen:all":    "npm run gen:assets && npm run gen:api"
  }
}
```

Then simply run `npm run gen:all` to regenerate everything.

---

## License

[MIT](LICENSE) © Ivan Kobtsev

