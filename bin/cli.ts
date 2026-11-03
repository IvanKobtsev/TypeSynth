#!/usr/bin/env node
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { runGenerator } from "../src/generator.js";
import type { TypeSynthJob } from "../src/types.js";
import { reporter } from "../src/reporter.js";

const help = `TypeSynth — Handlebars source generation
Usage:
  typesynth generate [job...]                 Run configured jobs
  typesynth generate --sources=<folder> --output=<path> [options]
Options:
  --input=<json-or-url>       Override input data
  --override=<name>=<path>    Replace a template (repeatable)
  --disable-formatting       Skip output formatting
  --help                     Show help

Configuration: typesynth.config.ts; exports defineJobs({ name: { sources, output } }).
With sources/main.ts, output is a directory; otherwise it is a file.
The tsynth binary is an alias for typesynth.`;

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help")) { reporter.info(help); return; }
  if (args.shift() !== "generate") throw new Error('Unknown command. Expected "generate".');
  const names: string[] = [];
  const flags: Record<string, string | true> = {};
  const overrides: Record<string, string> = Object.create(null);
  for (const arg of args) {
    if (!arg.startsWith("--")) { names.push(arg); continue; }
    const equals = arg.indexOf("=");
    const key = arg.slice(2, equals < 0 ? undefined : equals);
    const value = equals < 0 ? true : arg.slice(equals + 1);
    if (!["sources", "output", "input", "override", "disable-formatting"].includes(key)) throw new Error(`Unknown option --${key}.`);
    if (key === "disable-formatting" && value !== true) throw new Error("--disable-formatting takes no value.");
    if (key !== "disable-formatting" && (value === true || !value)) throw new Error(`--${key} requires a value.`);
    if (key === "override") {
      const text = value as string;
      const split = text.indexOf("=");
      if (split <= 0 || split === text.length - 1) throw new Error("Use --override=name=path.");
      const name = text.slice(0, split);
      if (Object.prototype.hasOwnProperty.call(overrides, name)) throw new Error(`Duplicate override: ${name}`);
      overrides[name] = text.slice(split + 1);
    } else {
      if (Object.prototype.hasOwnProperty.call(flags, key)) throw new Error(`Option --${key} was provided more than once.`);
      flags[key] = value;
    }
  }
  const root = process.cwd();
  const execute = (name: string, job: TypeSynthJob, directory: string) => reporter.task(
    `generate:${name}`, `job "${name}"`, () => runGenerator(name, job, directory), `Successfully generated "${name}".`,
  );
  if (Object.keys(flags).length || Object.keys(overrides).length) {
    if (names.length) throw new Error("Cannot mix job names with direct-job options.");
    if (!flags.sources || !flags.output) throw new Error("Direct generation requires --sources and --output.");
    await execute("direct", { sources: flags.sources as string, output: flags.output as string,
      input: flags.input as string | undefined, formatting: !flags["disable-formatting"], overrides }, root);
  } else {
    const { jobs, configPath } = await loadConfig(root);
    const selected = names.length ? names : Object.keys(jobs);
    for (const name of selected) if (!Object.prototype.hasOwnProperty.call(jobs, name)) throw new Error(`Unknown TypeSynth job: ${name}`);
    for (const name of selected) await execute(name, jobs[name], path.dirname(configPath));
  }
}
main().catch(error => { reporter.close(); reporter.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });

