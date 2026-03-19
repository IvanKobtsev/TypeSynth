export const inputDataNotFound = `No input data found.

Please provide data using one of the following options:

1. Use the "--input" flag with a path or URL to a JSON file
   Example: hbs-magic --input=./data.json

2. Add a preparation script:
   - File name: preparation-script.ts or preparation-script.js
   - Must export a default function that returns the data object
   - Place it inside your .hbs template folder

3. Add a default JSON file:
   - File name: input-data.json
   - Place it inside your .hbs template folder

Need help? Run: hbs-magic --help`;

export const multipleSourcesDetected = `Warning: Multiple input sources detected.

hbs-magic will use only one source based on the following priority:

1. --input flag
2. preparation-script.ts/js
3. input-data.json

The highest-priority source will be used. All others will be ignored.

Tip: Remove unused inputs to make your setup clearer.`;

export const positionalArgumentsNotAllowed = `No positional arguments allowed. Use '--key=value' format.`;

export const hbsMagicCliUsage = `Usage: [--input=<json>] --hbs=<folder> --output=<file> [--disable-formatting]
    --input: Optional JSON input file path. If not provided, the script will look for "input-data.json" in the specified hbs folder.
    --hbs: Required folder containing the Handlebars template, optional helpers, partials, and preparation script.
    --output: Required output file path where the generated source code will be written.
    --disable-formatting: Optional flag to disable auto-formatting of the output file after generation.`;
