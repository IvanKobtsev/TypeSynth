#!/usr/bin/env node
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { runGenerator } from "../src/generator.js";
import { hbsGenerator } from "../src/hbs-generator.js";
import { TypeSynthJob } from "../src/types.js";
import { reporter } from "../src/reporter.js";

const help = `TypeSynth — TypeScript source generation framework

Usage:
  tsynth gen [job...]                         Run configured jobs once
  tsynth hbs --sources=<folder> --output=<file> [options]

Direct Handlebars options:
  --sources=<folder>      Template folder (also accepts --hbs)
  --output=<file>         Generated output path
  --input=<json-or-url>   Optional JSON input
  --disable-formatting    Do not format the generated output
  --help                  Show this help

Configuration is loaded from typesynth.config.ts in the current directory.`;

type Command = "gen" | "hbs";
type ParsedCli = {
  command: Command;
  names: string[];
  flags: Record<string, string | true>;
};

function parseCli(argv: string[]): ParsedCli | undefined {
  if (argv.length === 0 || argv.includes("--help")) return undefined;
  const [rawCommand, ...rest] = argv;
  const commands: Command[] = ["gen", "hbs"];
  if (!commands.includes(rawCommand as Command)) {
    throw new Error(
      `Unknown command "${rawCommand}". Expected gen or hbs.`,
    );
  }
  const names: string[] = [];
  const flags: Record<string, string | true> = {};
  for (const argument of rest) {
    if (!argument.startsWith("--")) {
      names.push(argument);
      continue;
    }
    const equals = argument.indexOf("=");
    const key = argument.slice(2, equals === -1 ? undefined : equals);
    const value = equals === -1 ? true : argument.slice(equals + 1);
    if (!key || value === "") throw new Error(`Invalid option "${argument}".`);
    if (key in flags)
      throw new Error(`Option "--${key}" was provided more than once.`);
    flags[key] = value;
  }
  return { command: rawCommand as Command, names, flags };
}

function stringFlag(flags: Record<string, string | true>, name: string) {
  const value = flags[name];
  if (value === true) throw new Error(`Option "--${name}" requires a value.`);
  return value;
}

async function runDirectHbs(parsed: ParsedCli, projectRoot: string) {
  const allowed = new Set([
    "sources",
    "hbs",
    "output",
    "input",
    "disable-formatting",
  ]);
  for (const flag of Object.keys(parsed.flags)) {
    if (!allowed.has(flag)) throw new Error(`Unknown option "--${flag}".`);
  }
  if (parsed.names.length > 0)
    throw new Error('Names cannot be used with the "tsynth hbs" command.');
  const sources =
    stringFlag(parsed.flags, "sources") ?? stringFlag(parsed.flags, "hbs");
  const output = stringFlag(parsed.flags, "output");
  if (!sources || !output)
    throw new Error(
      "Direct Handlebars generation requires --sources and --output.",
    );
  if (parsed.flags.sources && parsed.flags.hbs)
    throw new Error("Use either --sources or --hbs, not both.");
  await reporter.task(
    "hbs",
    "Handlebars generation",
    async () =>
      await hbsGenerator({
        sources,
        output,
        input: stringFlag(parsed.flags, "input"),
        formatting: !parsed.flags["disable-formatting"],
      })({
        projectRoot,
        jobName: "handlebars",
      }),
    `Successfully generated "${path.resolve(projectRoot, output)}".`,
  );
}

function selectJobs(
  jobs: Record<string, TypeSynthJob>,
  requested: string[],
) {
  const selected = requested.length > 0 ? requested : Object.keys(jobs);
  const unknown = selected.filter((name) => !(name in jobs));
  if (unknown.length > 0)
    throw new Error(`Unknown TypeSynth job(s): ${unknown.join(", ")}.`);
  if (selected.length === 0)
    throw new Error("TypeSynth configuration does not define any jobs.");
  return selected;
}

async function runJobsOnce(
  jobs: Record<string, TypeSynthJob>,
  selected: string[],
  configDirectory: string,
) {
  for (const jobName of selected) {
    await reporter.task(
      `gen:${jobName}`,
      `job "${jobName}"`,
      () =>
        runGenerator(jobName, jobs[jobName], configDirectory, {
          projectRoot: configDirectory,
          jobName,
        }),
      `Successfully generated "${jobName}".`,
    );
  }
}

async function main() {
  const parsed = parseCli(process.argv.slice(2));
  if (!parsed) {
    reporter.info(help);
    return;
  }
  const projectRoot = process.cwd();
  if (parsed.command === "hbs") {
    await runDirectHbs(parsed, projectRoot);
    return;
  }
  if (Object.keys(parsed.flags).length > 0) {
    const hbsFlags = [
      "sources",
      "hbs",
      "output",
      "input",
      "disable-formatting",
    ];
    if (Object.keys(parsed.flags).some((flag) => hbsFlags.includes(flag))) {
      throw new Error(
        'Direct Handlebars generation uses the "tsynth hbs" command.',
      );
    }
    throw new Error(
      `Unknown option(s): ${Object.keys(parsed.flags)
        .map((flag) => `--${flag}`)
        .join(", ")}.`,
    );
  }
  const { config, configPath } = await loadConfig(projectRoot);
  const configDirectory = path.dirname(configPath);
  const jobs = config.jobs ?? {};

  if (parsed.command === "gen") {
    await runJobsOnce(jobs, selectJobs(jobs, parsed.names), configDirectory);
    return;
  }
}

main().catch((error) => {
  reporter.close();
  reporter.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
