import { getJson } from "./file-helpers.js";
import { reporter } from "./reporter.js";

export async function getInputObject(
  externalJson: string | undefined,
  preparationScriptResult: any,
  inputPath: string | undefined,
) {
  if (!externalJson && preparationScriptResult === undefined && !inputPath)
    throw new Error(
      "No input data found. Supply input, preparation-script.ts, or input-data.json.",
    );
  const count =
    Number(!!externalJson) + Number(preparationScriptResult !== undefined) + Number(!!inputPath);
  if (count > 1)
    reporter.warn(
      "Multiple input sources detected; using input, preparation result, then input-data.json in priority order.",
    );
  if (externalJson) return getJson(externalJson);
  if (preparationScriptResult !== undefined) return preparationScriptResult;
  if (inputPath) return getJson(inputPath);
}
