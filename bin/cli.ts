#!/usr/bin/env node
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { runGenerator } from "../src/generator.js";
import { hbsGenerator } from "../src/hbs-generator.js";
import { selectAutoms, runAutomsOnce, watchAutoms } from "../src/automs.js";
import { watchJob, WatchHandle } from "../src/watch.js";
import { TypeSynthJob } from "../src/types.js";

const help = `TypeSynth — TypeScript source generation framework

Usage:
  tsynth gen [job...]                         Run configured jobs once
  tsynth watch [job...]                       Watch configured jobs
  tsynth automs [autom...]                    Run configured automs once
  tsynth start jobs|automs|all                Watch a configured category
  tsynth hbs --sources=<folder> --output=<file> [options]

Direct Handlebars options:
  --sources=<folder>      Template folder (also accepts --hbs)
  --output=<file>         Generated output path
  --input=<json-or-url>   Optional JSON input
  --disable-formatting    Do not format the generated output
  --help                  Show this help

Configuration is loaded from typesynth.config.ts in the current directory.`;

type Command = "gen" | "watch" | "automs" | "start" | "hbs";
type ParsedCli = {
  command: Command;
  names: string[];
  flags: Record<string, string | true>;
};

function parseCli(argv: string[]): ParsedCli | undefined {
  if (argv.length === 0 || argv.includes("--help")) return undefined;
  const [rawCommand, ...rest] = argv;
  const commands: Command[] = ["gen", "watch", "automs", "start", "hbs"];
  if (!commands.includes(rawCommand as Command)) {
    throw new Error(
      `Unknown command "${rawCommand}". Expected gen, watch, automs, start, or hbs.`,
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
  await hbsGenerator({
    sources,
    output,
    input: stringFlag(parsed.flags, "input"),
    formatting: !parsed.flags["disable-formatting"],
  })({
    trigger: "manual",
    changes: undefined,
    projectRoot,
    jobName: "handlebars",
  });
  console.log(`Successfully generated "${path.resolve(projectRoot, output)}".`);
}

function selectJobs(
  jobs: Record<string, TypeSynthJob<any>>,
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
  jobs: Record<string, TypeSynthJob<any>>,
  selected: string[],
  configDirectory: string,
) {
  for (const jobName of selected) {
    await runGenerator(jobName, jobs[jobName], configDirectory, {
      trigger: "manual",
      changes: undefined,
      projectRoot: configDirectory,
      jobName,
    });
    console.log(`Successfully generated "${jobName}".`);
  }
}

async function watchJobs(
  jobs: Record<string, TypeSynthJob<any>>,
  selected: string[],
  configDirectory: string,
  continueOnError = false,
) {
  const handles: WatchHandle[] = [];
  for (const jobName of selected) {
    try {
      const job = jobs[jobName];
      if (!job.watch)
        throw new Error(`Job "${jobName}" has no watch configuration.`);
      try {
        await runGenerator(jobName, job, configDirectory, {
          trigger: "initial",
          changes: undefined,
          projectRoot: configDirectory,
          jobName,
        });
        console.log(`Initially generated "${jobName}".`);
      } catch (error) {
        console.error(`Initial generation for "${jobName}" failed:`, error);
      }
      handles.push(await watchJob(jobName, job, configDirectory));
    } catch (error) {
      if (!continueOnError) throw error;
      console.error(`Failed to start job "${jobName}":`, error);
    }
  }
  return handles;
}

function installShutdown(handles: WatchHandle[], label: string) {
  if (handles.length === 0)
    throw new Error(`No ${label} watchers were started.`);
  console.log(`Watching ${label}.`);
  const close = async () => {
    await Promise.all(handles.map((handle) => handle.close()));
    process.exit(0);
  };
  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());
}

async function main() {
  const parsed = parseCli(process.argv.slice(2));
  if (!parsed) {
    console.log(help);
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
  const automs = config.automs ?? {};

  if (parsed.command === "gen") {
    await runJobsOnce(jobs, selectJobs(jobs, parsed.names), configDirectory);
    return;
  }
  if (parsed.command === "watch") {
    const selected = selectJobs(jobs, parsed.names);
    installShutdown(
      await watchJobs(jobs, selected, configDirectory),
      `${selected.length} job(s)`,
    );
    return;
  }
  if (parsed.command === "automs") {
    await runAutomsOnce(
      automs,
      selectAutoms(automs, parsed.names),
      configDirectory,
    );
    return;
  }

  if (
    parsed.names.length !== 1 ||
    !["jobs", "automs", "all"].includes(parsed.names[0])
  ) {
    throw new Error("Usage: tsynth start jobs|automs|all");
  }
  const category = parsed.names[0];
  const handles: WatchHandle[] = [];
  if (category === "jobs" || category === "all") {
    if (Object.keys(jobs).length === 0 && category === "jobs") {
      throw new Error("TypeSynth configuration does not define any jobs.");
    }
    if (Object.keys(jobs).length > 0) {
      handles.push(
        ...(await watchJobs(
          jobs,
          Object.keys(jobs),
          configDirectory,
          category === "all",
        )),
      );
    }
  }
  if (category === "automs" || category === "all") {
    if (Object.keys(automs).length === 0 && category === "automs") {
      throw new Error("TypeSynth configuration does not define any automs.");
    }
    if (Object.keys(automs).length > 0) {
      try {
        handles.push(
          ...(await watchAutoms(
            automs,
            Object.keys(automs) as any,
            configDirectory,
          )),
        );
      } catch (error) {
        if (category !== "all") throw error;
        console.error("Failed to start automs:", error);
      }
    }
  }
  installShutdown(handles, category);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
