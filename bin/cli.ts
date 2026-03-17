#!/usr/bin/env node
import {
  getHbsHelpersAndTemplatePaths,
  runPreparationScript,
} from "../src/file-helpers.js";
import { formatSourceFile } from "../src/formatting-helpers.js";
import {
  compileHbsTemplateAndWriteToFile,
  registerHbsHelpersFromFile,
  registerHbsPartials,
} from "../src/hbs-process-helpers.js";
import {
  extractArgument,
  extractArguments,
  extractFlag,
  validateInputs,
} from "../src/process-helpers.js";

const args = extractArguments(
  process,
  ["hbs", "output"],
  "Usage: [--input=<json>] --hbs=<folder> --output=<file> [--disable-formatting] \n" +
    '--input: Optional JSON input file path. If not provided, the script will look for "input-data.json" in the specified hbs folder.\n' +
    "--hbs: Required folder containing the Handlebars template, optional helpers, partials, and preparation script.\n" +
    "--output: Required output file path where the generated source code will be written.\n" +
    "--disable-formatting: Optional flag to disable formatting of the output file after generation.",
);
const hbsFolder = args.hbs as string;
const outputFile = args.output as string;
const formatOutput = !extractFlag(process, "disable-formatting");
const externalJson = extractArgument(process, "input");

async function main() {
  console.log("Hello");

  const {
    preparationScriptPath,
    hbsHelpersPath,
    hbsPartials,
    inputPath,
    templatePath,
  } = getHbsHelpersAndTemplatePaths(hbsFolder);

  validateInputs(inputPath, externalJson);

  if (preparationScriptPath) await runPreparationScript(preparationScriptPath);

  if (hbsHelpersPath) await registerHbsHelpersFromFile(hbsHelpersPath);

  if (hbsPartials.length > 0) await registerHbsPartials(hbsPartials);

  await compileHbsTemplateAndWriteToFile(
    templatePath,
    externalJson ?? inputPath!,
    outputFile,
  );

  if (formatOutput) await formatSourceFile(outputFile);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
