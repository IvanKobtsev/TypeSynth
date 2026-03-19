#!/usr/bin/env node
import {
  getHbsHelpersAndTemplatePaths,
  getInputDataPath,
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

const args = extractArguments(process, ["hbs", "output"]);
const hbsFolder = args.hbs as string;
const outputFile = args.output as string;
const formatOutput = !extractFlag(process, "disable-formatting");
const externalJson = extractArgument(process, "input");

async function main() {
  const { preparationScriptPath, hbsHelpersPath, hbsPartials, templatePath } =
    getHbsHelpersAndTemplatePaths(hbsFolder);

  let preparationScriptResult = undefined;
  if (preparationScriptPath)
    preparationScriptResult = await runPreparationScript(preparationScriptPath);

  const inputObject = await validateInputs(
    externalJson,
    preparationScriptResult,
    getInputDataPath(hbsFolder),
  );

  if (hbsHelpersPath) await registerHbsHelpersFromFile(hbsHelpersPath);

  if (hbsPartials.length > 0) await registerHbsPartials(hbsPartials);

  await compileHbsTemplateAndWriteToFile(templatePath, inputObject, outputFile);

  if (formatOutput) await formatSourceFile(outputFile);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
