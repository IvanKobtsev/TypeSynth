import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
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

async function waitFor(check, message, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(message);
}

async function lineCount(file) {
  try {
    return (await readFile(file, "utf8")).trim().split("\n").filter(Boolean)
      .length;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
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
    assert.equal(
      await readFile(path.join(folder, "first.txt"), "utf8"),
      "manual",
    );
    await assert.rejects(readFile(path.join(folder, "second.txt"), "utf8"));

    const all = await run(["gen"], folder);
    assert.equal(all.code, 0, all.stderr);
    assert.equal(
      await readFile(path.join(folder, "second.txt"), "utf8"),
      "manual",
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

test("generates registry automs with inferred and manual registrations", async () => {
  const folder = await mkdtemp(
    path.join(os.tmpdir(), "typesynth-registry-test-"),
  );
  try {
    const source = path.join(folder, "src");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(source));
    await writeFile(
      path.join(folder, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          baseUrl: ".",
          paths: { "@/*": ["src/*"] },
        },
        include: ["src/**/*"],
      }),
    );
    await writeFile(
      path.join(folder, "typesynth.config.ts"),
      "export default { automs: { registry: {} } };",
    );
    await writeFile(
      path.join(source, "core.ts"),
      "/** @registry Modal */\nexport interface GlobalModalProps<T = {}> { data: T }",
    );
    await writeFile(
      path.join(source, "confirmation.tsx"),
      `import type { GlobalModalProps } from "./core.js";
       export function ConfirmationModal(props: GlobalModalProps<{ id: string }>) { return props.data.id; }`,
    );
    await writeFile(
      path.join(source, "schedule.ts"),
      "/** @register Modal */\nexport const ScheduleModal = () => null;",
    );

    const result = await run(["automs"], folder);
    assert.equal(result.code, 0, result.stderr);
    const generated = await readFile(
      path.join(folder, "tsynth-gen", "registry", "modalRegistry.gen.ts"),
      "utf8",
    );
    assert.match(
      generated,
      /import \{ ConfirmationModal \} from "@\/confirmation"/,
    );
    assert.match(generated, /import \{ ScheduleModal \} from "@\/schedule"/);
    assert.match(generated, /Confirmation = "Confirmation"/);
    assert.match(generated, /Schedule = "Schedule"/);
    assert.match(generated, /\[ModalType\.Confirmation\]: ConfirmationModal/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("supports manual-only registries and contained output overrides", async () => {
  const folder = await mkdtemp(
    path.join(os.tmpdir(), "typesynth-manual-registry-test-"),
  );
  try {
    const source = path.join(folder, "src");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(source));
    await writeFile(
      path.join(folder, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { baseUrl: "src", paths: { "@/*": ["*"] } },
        include: ["src/**/*"],
      }),
    );
    await writeFile(
      path.join(folder, "typesynth.config.ts"),
      "export default { automs: { registry: { useManualRegistration: true } } };",
    );
    const corePath = path.join(source, "core.ts");
    await writeFile(
      corePath,
      "/** @registry Action nested/action.gen.ts */\nexport interface ActionProps { value: string }",
    );
    await writeFile(
      path.join(source, "actions.ts"),
      `import type { ActionProps } from "./core";
       export function InferredAction(props: ActionProps) { return props.value; }
       /** @register Action */
       export const ExplicitAction = () => "ok";`,
    );
    const result = await run(["automs", "registry"], folder);
    assert.equal(result.code, 0, result.stderr);
    const output = await readFile(
      path.join(source, "tsynth-gen", "registry", "nested", "action.gen.ts"),
      "utf8",
    );
    assert.match(output, /Explicit = "Explicit"/);
    assert.doesNotMatch(output, /Inferred/);

    await writeFile(
      corePath,
      "/** @registry Action ../outside.ts */\nexport interface ActionProps { value: string }",
    );
    assert.match((await run(["automs"], folder)).stderr, /cannot escape/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("start automs regenerates registries when project sources change", async () => {
  const folder = await mkdtemp(
    path.join(os.tmpdir(), "typesynth-registry-watch-test-"),
  );
  let child;
  try {
    const source = path.join(folder, "src");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(source));
    await writeFile(
      path.join(folder, "tsconfig.json"),
      JSON.stringify({ compilerOptions: {}, include: ["src/**/*"] }),
    );
    await writeFile(
      path.join(folder, "typesynth.config.ts"),
      "export default { automs: { registry: { useManualRegistration: true } } };",
    );
    await writeFile(
      path.join(source, "core.ts"),
      "/** @registry Command */\nexport interface CommandProps {}",
    );
    const commandsPath = path.join(source, "commands.ts");
    await writeFile(
      commandsPath,
      "/** @register Command */\nexport const OpenCommand = () => null;",
    );
    child = spawn(process.execPath, [cli, "start", "automs"], { cwd: folder });
    const watching = new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("autom watcher did not start")),
        5000,
      );
      child.stdout.on("data", (chunk) => {
        if (String(chunk).includes("Watching automs")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.on("exit", (code) =>
        reject(new Error(`autom watcher exited with ${code}`)),
      );
    });
    const outputPath = path.join(
      folder,
      "tsynth-gen",
      "registry",
      "commandRegistry.gen.ts",
    );
    await waitFor(async () => {
      try {
        return (await readFile(outputPath, "utf8")).includes('Open = "Open"');
      } catch {
        return false;
      }
    }, "registry autom did not initially generate");
    await watching;
    await appendFile(
      commandsPath,
      "\n/** @register Command */\nexport const CloseCommand = () => null;\n",
    );
    await waitFor(
      async () =>
        (await readFile(outputPath, "utf8")).includes('Close = "Close"'),
      "registry autom did not regenerate after a source change",
    );
  } finally {
    if (child && !child.killed) child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 100));
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
        watch: { target: "input/**/*", debounceMs: 30, script: "./watcher.ts" }
      } } };`,
    );
    child = spawn(process.execPath, [cli, "watch"], { cwd: folder });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("watcher did not start")),
        5000,
      );
      child.stdout.on("data", (chunk) => {
        if (String(chunk).includes("Watching 1")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.on("exit", (code) =>
        reject(new Error(`watcher exited with ${code}`)),
      );
    });
    await import("node:fs/promises").then(({ mkdir }) =>
      mkdir(path.join(folder, "input")),
    );
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

test("watches path-based generators by default and supports opting out", async () => {
  const folder = await mkdtemp(
    path.join(os.tmpdir(), "typesynth-script-watch-test-"),
  );
  let child;
  try {
    const generatorPath = path.join(folder, "generator.ts");
    await writeFile(
      generatorPath,
      `import { appendFile } from "node:fs/promises";
       export default async ({ jobName, trigger }) => appendFile(jobName + ".txt", trigger + "\\n");`,
    );
    await writeFile(
      path.join(folder, "typesynth.config.ts"),
      `export default { jobs: {
        automatic: { generate: "./generator.ts", watch: { target: "input/**/*", debounceMs: 20 } },
        disabled: { generate: "./generator.ts", watch: { target: "input/**/*", debounceMs: 20, watchGenerationScript: false } }
      } };`,
    );
    child = spawn(process.execPath, [cli, "watch"], { cwd: folder });
    const watching = new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("watcher did not start")),
        5000,
      );
      child.stdout.on("data", (chunk) => {
        if (String(chunk).includes("Watching 2")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.on("exit", (code) =>
        reject(new Error(`watcher exited with ${code}`)),
      );
    });
    await waitFor(
      async () =>
        (await lineCount(path.join(folder, "automatic.txt"))) === 1 &&
        (await lineCount(path.join(folder, "disabled.txt"))) === 1,
      "initial generators did not run",
    );
    await watching;
    await appendFile(generatorPath, "\n// changed\n");
    await waitFor(
      async () => (await lineCount(path.join(folder, "automatic.txt"))) === 2,
      "generator script change was not detected",
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(await lineCount(path.join(folder, "disabled.txt")), 1);
  } finally {
    if (child && !child.killed) child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await rm(folder, { recursive: true, force: true });
  }
});

test("polls URL targets and generates only when the response body changes", async () => {
  let body = "first";
  const server = createServer((_request, response) => response.end(body));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/input`;
  const folder = await mkdtemp(
    path.join(os.tmpdir(), "typesynth-url-watch-test-"),
  );
  let child;
  try {
    await writeFile(
      path.join(folder, "generator.ts"),
      `import { appendFile } from "node:fs/promises";
       export default async ({ trigger, changes }) => appendFile("runs.txt", JSON.stringify({ trigger, changes }) + "\\n");`,
    );
    await writeFile(
      path.join(folder, "typesynth.config.ts"),
      `export default { jobs: { remote: {
        generate: "./generator.ts",
        watch: { target: ${JSON.stringify(url)}, urlPollIntervalMs: 40, debounceMs: 10, watchGenerationScript: false }
      } } };`,
    );
    child = spawn(process.execPath, [cli, "watch"], { cwd: folder });
    await waitFor(
      async () => (await lineCount(path.join(folder, "runs.txt"))) === 1,
      "initial URL generator did not run",
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(await lineCount(path.join(folder, "runs.txt")), 1);
    body = "second";
    await waitFor(
      async () => (await lineCount(path.join(folder, "runs.txt"))) === 2,
      "changed URL response did not trigger generation",
    );
    const runs = (await readFile(path.join(folder, "runs.txt"), "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.deepEqual(runs[1].changes, [
      { path: url, type: "change", source: "url" },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(await lineCount(path.join(folder, "runs.txt")), 2);
  } finally {
    if (child && !child.killed) child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await new Promise((resolve) => server.close(resolve));
    await rm(folder, { recursive: true, force: true });
  }
});
