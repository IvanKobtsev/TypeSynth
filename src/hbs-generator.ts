import path from "node:path";
import {
  getHbsHelpersAndTemplatePaths,
  getInputDataPath,
  runPreparationScript,
} from "./file-helpers.js";
import { formatSourceFile } from "./formatting-helpers.js";
import {
  compileHbsTemplateAndWriteToFile,
  registerHbsHelpersFromFile,
  registerHbsPartials,
} from "./hbs-process-helpers.js";
import { getInputObject } from "./process-helpers.js";
import { GeneratorScript } from "./types.js";

export type HbsGeneratorOptions = {
  sources: string;
  output: string;
  input?: string;
  formatting?: boolean;
};

export function hbsGenerator(options: HbsGeneratorOptions): GeneratorScript {
  return async ({ projectRoot }) => {
    const sources = path.resolve(projectRoot, options.sources);
    const output = path.resolve(projectRoot, options.output);
    const input = options.input
      ? /^(https?:)?\/\//.test(options.input)
        ? options.input
        : path.resolve(projectRoot, options.input)
      : undefined;
    const { preparationScriptPath, hbsHelpersPath, hbsPartials, templatePath } =
      getHbsHelpersAndTemplatePaths(sources);
    const preparationResult = await runPreparationScript(preparationScriptPath);
    const inputObject = await getInputObject(
      input,
      preparationResult,
      getInputDataPath(sources),
    );

    if (hbsHelpersPath) await registerHbsHelpersFromFile(hbsHelpersPath);
    if (hbsPartials.length > 0) await registerHbsPartials(hbsPartials);
    await compileHbsTemplateAndWriteToFile(templatePath, inputObject, output);
    if (options.formatting !== false) await formatSourceFile(output);
  };
}
