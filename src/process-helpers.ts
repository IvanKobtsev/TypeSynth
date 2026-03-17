type ParsedArgs = {
  [key: string]: string | boolean | string[];
};

export function extractArguments(
  process: NodeJS.Process,
  required: string[],
  usage?: string,
) {
  const raw = process.argv.slice(2);

  const args: ParsedArgs = {};

  for (const arg of raw) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");

      args[key] = value ?? true;
    } else {
      throw new Error(
        "No positional arguments allowed. Use '--key=value' format.",
      );
    }
  }

  for (const req of required) {
    if (!(req in args)) {
      console.error(`Missing required argument: --${req}`);
      if (usage) console.error(usage);
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

export function validateInputs(
  inputPath: string | undefined,
  externalJson: string | undefined,
) {
  if (!inputPath && !externalJson)
    throw new Error(
      `Found no ".json" input. Please provide input data either by placing a JSON file in your specified hbs folder or by using the "--input" argument.`,
    );
  if (inputPath && externalJson)
    console.warn(
      `Found both JSON file in your hbs folder and the external json input. Script will prioritize the data specified with "--input" argument.`,
    );
}
