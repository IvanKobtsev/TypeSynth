import {
  hbsMagicCliUsage,
  hbsMagicHelp,
  inputDataNotFound,
  multipleSourcesDetected,
  positionalArgumentsNotAllowed,
} from "./cli-messages.js";
import { getJson } from "./file-helpers.js";

type ParsedArgs = {
  [key: string]: string | boolean | string[];
};

export function extractArguments(process: NodeJS.Process, required: string[]) {
  const raw = process.argv.slice(2);

  if (raw.length === 1 && raw[0] === "--help") {
    console.log(hbsMagicHelp);
    process.exit(1);
  }

  const args: ParsedArgs = {};

  for (const arg of raw) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");

      args[key] = value ?? true;
    } else {
      throw new Error(positionalArgumentsNotAllowed);
    }
  }

  for (const req of required) {
    if (!(req in args)) {
      console.error(`Missing required argument: --${req}`);
      console.error(hbsMagicCliUsage);
      process.exit(1);
    }
  }

  return args;
}

export function extractFlag(
  process: NodeJS.Process,
  flagName: string,
): boolean {
  const arg = process.argv.find((a) => a.startsWith(`--${flagName}`));
  return !!arg;
}

export function extractArgument(process: NodeJS.Process, argumentName: string) {
  const arg = process.argv.find((a) => a.startsWith(`--${argumentName}=`));
  return arg?.split("=")[1] ?? undefined;
}

export async function getInputObject(
  externalJson: string | undefined,
  preparationScriptResult: any | undefined,
  inputPath: string | undefined,
) {
  if (!externalJson && !preparationScriptResult && !inputPath)
    throw new Error(inputDataNotFound);

  const sourcesCount =
    (externalJson ? 1 : 0) +
    (preparationScriptResult ? 1 : 0) +
    (inputPath ? 1 : 0);

  if (sourcesCount > 1) console.warn(multipleSourcesDetected);

  if (externalJson) return await getJson(externalJson);

  if (preparationScriptResult) return preparationScriptResult;

  if (inputPath) return await getJson(inputPath);
}
