import assert from "node:assert/strict";
import test from "node:test";
import { CliReporter } from "../dist/src/reporter.js";

function stream(isTTY = false) {
  return {
    isTTY,
    output: "",
    write(chunk) {
      this.output += chunk;
    },
  };
}

test("reporter emits stable uncolored output outside a TTY", async () => {
  const stdout = stream();
  const stderr = stream();
  const reporter = new CliReporter({ stdout, stderr, env: {} });
  await reporter.task("one", "registry autom", async () => {}, "Generated.");
  reporter.warn("Warning.");
  reporter.error("Error.");
  assert.equal(stderr.output, "Processing registry autom…\nWarning.\nError.\n");
  assert.equal(stdout.output, "Generated.\n");
  assert.doesNotMatch(stdout.output + stderr.output, /\u001b\[/);
});

test("reporter colors severities when FORCE_COLOR is enabled", () => {
  const stdout = stream();
  const stderr = stream();
  const reporter = new CliReporter({
    stdout,
    stderr,
    env: { FORCE_COLOR: "1" },
  });
  reporter.success("Success");
  reporter.warn("Warning");
  reporter.error("Error");
  assert.match(stdout.output, /\u001b\[32mSuccess/);
  assert.match(stderr.output, /\u001b\[33mWarning/);
  assert.match(stderr.output, /\u001b\[31mError/);
});

test("reporter aggregates concurrent TTY tasks and clears its timer", () => {
  const stdout = stream(true);
  const stderr = stream(true);
  let callback;
  let cleared = false;
  const reporter = new CliReporter({
    stdout,
    stderr,
    env: { NO_COLOR: "1" },
    setInterval(fn) {
      callback = fn;
      return 1;
    },
    clearInterval() {
      cleared = true;
    },
  });
  reporter.start("one", "first task");
  reporter.start("two", "second task");
  callback();
  callback();
  assert.match(stderr.output, /Processing 2 TypeSynth tasks…/);
  assert.match(stderr.output, /\|/);
  assert.match(stderr.output, /\//);
  assert.match(stderr.output, /-/);
  reporter.stop("one");
  reporter.stop("two");
  assert.equal(cleared, true);
  assert.match(stderr.output, /\u001b\[2K/);
});

test("reporter animates on stdout when stderr is not a TTY", () => {
  const stdout = stream(true);
  const stderr = stream(false);
  let callback;
  const reporter = new CliReporter({
    stdout,
    stderr,
    env: { NO_COLOR: "1" },
    setInterval(fn) {
      callback = fn;
      return 1;
    },
    clearInterval() {},
  });
  reporter.start("one", "fallback task");
  callback();
  reporter.stop("one");
  assert.match(stdout.output, /\| Processing fallback task/);
  assert.match(stdout.output, /\/ Processing fallback task/);
  assert.equal(stderr.output, "");
});
