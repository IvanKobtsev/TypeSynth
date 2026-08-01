#!/usr/bin/env node
import path from "node:path";
import { FSWatcher } from "chokidar";
import { loadConfig } from "../src/config.js";
import { runGenerator } from "../src/generator.js";
import { hbsGenerator } from "../src/hbs-generator.js";
import { watchJob } from "../src/watch.js";

const help = `TypeSynth — TypeScript source generation framework

Usage:
  tsynth gen [job...]                         Run configured generators once
  tsynth watch [job...]                       Watch and run configured generators
  tsynth gen --sources=<folder> --output=<file> [options]

Direct Handlebars options:
  --sources=<folder>      Template folder (also accepts --hbs)
  --output=<file>         Generated output path
  --input=<json-or-url>   Optional JSON input
  --disable-formatting    Do not format the generated output
  --help                  Show this help

Configuration is loaded from typesynth.config.ts in the current directory.`;

type ParsedCli = {
  command: "gen" | "watch";
  jobs: string[];
  flags: Record<string, string | true>;
};

function parseCli(argv: string[]): ParsedCli | undefined {
  if (argv.length === 0 || argv.includes("--help")) return undefined;
  const [rawCommand, ...rest] = argv;

  if (rawCommand !== "gen" && rawCommand !== "watch") {
    throw new Error(`Unknown command \"${rawCommand}\". Expected \"gen\" or \"watch\".`);
  }

  const jobs: string[] = [];
  const flags: Record<string, string | true> = {};

  for (const argument of rest) {
    if (!argument.startsWith("--")) {
      jobs.push(argument);
      continue;
    }

    const equals = argument.indexOf("=");
    const key = argument.slice(2, equals === -1 ? undefined : equals);
    const value = equals === -1 ? true : argument.slice(equals + 1);

    if (!key || value === "") throw new Error(`Invalid option \"${argument}\".`);
    if (key in flags) throw new Error(`Option \"--${key}\" was provided more than once.`);

    flags[key] = value;
  }

  return { command: rawCommand, jobs, flags };
}

function stringFlag(flags: Record<string, string | true>, name: string) {
  const value = flags[name];

  if (value === true) throw new Error(`Option \"--${name}\" requires a value.`);

  return value;
}

async function runDirectHbs(parsed: ParsedCli, projectRoot: string) {
  const allowed = new Set(["sources", "hbs", "output", "input", "disable-formatting"]);

  for (const flag of Object.keys(parsed.flags)) {
    if (!allowed.has(flag)) throw new Error(`Unknown option \"--${flag}\".`);
  }

  if (parsed.command !== "gen") throw new Error("Direct Handlebars flags are only supported by tsynth gen.");
  if (parsed.jobs.length > 0) throw new Error("Job names cannot be combined with direct Handlebars flags.");

  const sources = stringFlag(parsed.flags, "sources") ?? stringFlag(parsed.flags, "hbs");
  const output = stringFlag(parsed.flags, "output");

  if (!sources || !output) throw new Error("Direct Handlebars generation requires --sources and --output.");
  if (parsed.flags.sources && parsed.flags.hbs) throw new Error("Use either --sources or --hbs, not both.");

  await hbsGenerator({
    sources,
    output,
    input: stringFlag(parsed.flags, "input"),
    formatting: !parsed.flags["disable-formatting"],
  })({ trigger: "manual", changes: undefined, projectRoot, jobName: "handlebars" });

  console.log(`Successfully generated \"${path.resolve(projectRoot, output)}\".`);
}

async function main() {
  const parsed = parseCli(process.argv.slice(2));

  if (!parsed) {
    console.log(help);
    return;
  }

  const projectRoot = process.cwd();
  if (Object.keys(parsed.flags).length > 0) {
    await runDirectHbs(parsed, projectRoot);
    return;
  }

  const { config, configPath } = await loadConfig(projectRoot);

  const configDirectory = path.dirname(configPath);
  const selected = parsed.jobs.length > 0 ? parsed.jobs : Object.keys(config.jobs);
  const unknown = selected.filter((name) => !(name in config.jobs));

  if (unknown.length > 0) throw new Error(`Unknown TypeSynth job(s): ${unknown.join(", ")}.`);
  if (selected.length === 0) throw new Error("TypeSynth configuration does not define any jobs.");

  if (parsed.command === "gen") {
    for (const jobName of selected) {
      await runGenerator(jobName, config.jobs[jobName], configDirectory, {
        trigger: "manual",
        changes: undefined,
        projectRoot: configDirectory,
        jobName,
      });

      console.log(`Successfully generated \"${jobName}\".`);
    }

    return;
  }

  const watchers: FSWatcher[] = [];

  for (const jobName of selected) {
    const job = config.jobs[jobName];

    if (!job.watch) throw new Error(`Job \"${jobName}\" has no watch configuration.`);

    try {
      await runGenerator(jobName, job, configDirectory, {
        trigger: "initial",
        changes: undefined,
        projectRoot: configDirectory,
        jobName,
      });
      console.log(`Initially generated \"${jobName}\".`);
    } catch (error) {
      console.error(`Initial generation for \"${jobName}\" failed:`, error);
    }
    watchers.push(await watchJob(jobName, job, configDirectory));
  }

  console.log(`Watching ${selected.length} TypeSynth job(s).`);
  const close = async () => {
    await Promise.all(watchers.map((watcher) => watcher.close()));
    process.exit(0);
  };

  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
