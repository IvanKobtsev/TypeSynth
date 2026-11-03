import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
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
       export default async ({ jobName }) => writeFile(jobName + ".txt", jobName);`,
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
    assert.equal(
      await readFile(path.join(folder, "first.txt"), "utf8"),
      "first",
    );
    await assert.rejects(readFile(path.join(folder, "second.txt"), "utf8"));

    const all = await run(["gen"], folder);
    assert.equal(all.code, 0, all.stderr);
    assert.equal(
      await readFile(path.join(folder, "second.txt"), "utf8"),
      "second",
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("rejects unknown commands, jobs, and Handlebars flags under gen", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "typesynth-test-"));
  try {
    await writeFile(
      path.join(folder, "typesynth.config.ts"),
      "export default { jobs: { existing: { generate: () => {} } } };",
    );
    assert.equal((await run(["nope"], folder)).code, 1);
    assert.match(
      (await run(["gen", "missing"], folder)).stderr,
      /Unknown TypeSynth job/,
    );
    assert.match(
      (await run(["gen", "job", "--sources=x", "--output=y"], folder)).stderr,
      /uses the "tsynth hbs" command/,
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("runs direct Handlebars generation only through the hbs command", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "typesynth-hbs-test-"));
  try {
    await writeFile(path.join(folder, "template.hbs"), "Hello {{name}}!");
    await writeFile(
      path.join(folder, "input-data.json"),
      JSON.stringify({ name: "TypeSynth" }),
    );
    const result = await run(
      ["hbs", "--sources=.", "--output=result.txt", "--disable-formatting"],
      folder,
    );
    assert.equal(result.code, 0, result.stderr);
    assert.equal(
      await readFile(path.join(folder, "result.txt"), "utf8"),
      "Hello TypeSynth!",
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

