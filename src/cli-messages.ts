export const inputDataNotFound = `No input data found.

Please provide data using one of the following options:

1. Use the "--input" flag with a path or URL to a JSON file
   Example: tsynth hbs --input=./data.json

2. Add a preparation script:
   - File name: preparation-script.ts or preparation-script.js
   - Must export a default function that returns the data object
   - Place it inside your .hbs template folder

3. Add a default JSON file:
   - File name: input-data.json
   - Place it inside your .hbs template folder

Need help? Run: tsynth --help`;

export const multipleSourcesDetected = `Warning: Multiple input sources detected.

TypeSynth will use only one source based on the following priority:

1. --input flag
2. preparation-script.ts/js
3. input-data.json

The highest-priority source will be used. All others will be ignored.

Tip: Remove unused inputs to make your setup clearer.`;

export const positionalArgumentsNotAllowed = `No positional arguments allowed. Use '--key=value' format.`;

export const hbsMagicCliUsage = `Usage: tsynth hbs [--input=<json>] --sources=<folder> --output=<file> [--disable-formatting]
    --input: Optional JSON input file path. If not provided, the script will look for "input-data.json" in the specified hbs folder.
    --sources: Required folder containing the Handlebars template, optional helpers, partials, and preparation script.
    --output: Required output file path where the generated source code will be written.
    --disable-formatting: Optional flag to disable auto-formatting of the output file after generation.`;

export const hbsMagicHelp = `TypeSynth — source-code generation with Handlebars templates

Usage:
  tsynth hbs --sources=<folder> --output=<file> [--input=<json>] [--disable-formatting]

Required flags:
  --sources=<folder>    Folder containing your Handlebars template and optional
                        helpers, partials, and preparation script.
  --output=<file>       Path where the generated file will be written.

Optional flags:
  --input=<json>        External JSON data source — a local file path or a URL.
  --disable-formatting  Skip auto-formatting of the generated output.
  --help                Show this help message.

Input folder structure:
  The --sources folder can contain any combination of these files:

  template.hbs              (required)  The Handlebars template to render.
  input-data.json           (optional)  Static JSON data for the template.
  preparation-script.ts     (optional)  Script exporting a default function
                                        that returns the data object.
  hbs-helpers.ts            (optional)  Custom Handlebars helpers. Must export
                                        a default object: { helperName: fn }.
  template_partial_*.hbs    (optional)  Partials, named by the part after the
                                        second "_" (e.g. template_partial_row.hbs
                                        registers a partial called "row").

Data source priority:
  If multiple sources are provided, only one is used:
    1. --input flag          (highest)
    2. preparation-script
    3. input-data.json       (lowest)

Auto-formatting:
  Output files are automatically formatted based on extension:
    .ts .tsx .js .jsx  →  Prettier
    .cs                →  CSharpier

Examples:
  # Simple: static JSON + template
  tsynth hbs --sources=gen/input --output=src/result.gen.ts

  # From a remote API
  tsynth hbs --input=https://api.example.com/openapi.json --sources=gen/input --output=src/client.gen.ts

  # With formatting disabled
  tsynth hbs --sources=gen/input --output=src/result.gen.ts --disable-formatting

Documentation: https://github.com/IvanKobtsev/TypeSynth#readme`;
