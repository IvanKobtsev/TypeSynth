import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(repository, "dist", "bin", "cli.js");

function run(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("runs all and selected configured TypeScript generators", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "typesynth-test-"));
  try {
    await writeFile(
      path.join(folder, "generator.ts"),
      `import { writeFile } from "node:fs/promises";
       export default async ({ jobName, trigger }) => writeFile(jobName + ".txt", trigger);`,
    );
    await writeFile(
      path.join(folder, "typesynth.config.ts"),
      `export default { jobs: {
        first: { generate: "./generator.ts" },
        second: { generate: "./generator.ts" }
      } };`,
    );

    const selected = await run(["gen", "first"], folder);
    assert.equal(selected.code, 0, selected.stderr);
    assert.equal(await readFile(path.join(folder, "first.txt"), "utf8"), "manual");
    await assert.rejects(readFile(path.join(folder, "second.txt"), "utf8"));

    const all = await run(["gen"], folder);
    assert.equal(all.code, 0, all.stderr);
    assert.equal(await readFile(path.join(folder, "second.txt"), "utf8"), "manual");
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("rejects unknown commands, jobs, and direct Handlebars flag combinations", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "typesynth-test-"));
  try {
    await writeFile(path.join(folder, "typesynth.config.ts"), "export default { jobs: {} };");
    assert.equal((await run(["nope"], folder)).code, 1);
    assert.match((await run(["gen", "missing"], folder)).stderr, /Unknown TypeSynth job/);
    assert.match(
      (await run(["gen", "job", "--sources=x", "--output=y"], folder)).stderr,
      /cannot be combined/,
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("watch runs initially, filters batches, and passes transformed changes", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "typesynth-watch-test-"));
  let child;
  try {
    await writeFile(
      path.join(folder, "generator.ts"),
      `import { appendFile } from "node:fs/promises";
       export default async ({ trigger, changes }) => appendFile("runs.txt", JSON.stringify({ trigger, changes }) + "\\n");`,
    );
    await writeFile(
      path.join(folder, "watcher.ts"),
      `export default (events) => {
        const paths = events.filter(x => x.path.endsWith(".ts")).map(x => x.path);
        return paths.length ? paths : false;
      };`,
    );
    await writeFile(
      path.join(folder, "typesynth.config.ts"),
      `export default { jobs: { demo: {
        generate: "./generator.ts",
        watch: { files: "input/**/*", debounce: 30, script: "./watcher.ts" }
      } } };`,
    );
    child = spawn(process.execPath, [cli, "watch"], { cwd: folder });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("watcher did not start")), 5000);
      child.stdout.on("data", (chunk) => {
        if (String(chunk).includes("Watching 1")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.on("exit", (code) => reject(new Error(`watcher exited with ${code}`)));
    });
    await import("node:fs/promises").then(({ mkdir }) => mkdir(path.join(folder, "input")));
    await writeFile(path.join(folder, "input", "ignored.txt"), "x");
    await writeFile(path.join(folder, "input", "accepted.ts"), "export {};");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const runs = (await readFile(path.join(folder, "runs.txt"), "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(runs[0].trigger, "initial");
    assert.equal(runs.at(-1).trigger, "watch");
    assert.deepEqual(runs.at(-1).changes, ["input/accepted.ts"]);
  } finally {
    if (child && !child.killed) child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await rm(folder, { recursive: true, force: true });
  }
});
