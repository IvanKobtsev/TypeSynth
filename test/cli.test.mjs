import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runGenerator } from "../dist/src/generator.js";
import { defineJobs } from "../dist/src/index.js";
const cli = fileURLToPath(new URL("../dist/bin/cli.js", import.meta.url));
function run(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
async function fixture(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "typesynth-"));
  const put = async (name, value) => {
    const full = path.join(root, name);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, value);
  };
  try {
    await fn(root, put);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("configured selection, direct fallback, and CLI validation", () =>
  fixture(async (root, put) => {
    await put("sources/template.hbs", "Hello {{name}}");
    await put("sources/input-data.json", '{"name":"world"}');
    await put(
      "typesynth.config.ts",
      `export default { first: { sources: './sources', output: './first.txt', formatting: false }, second: { sources: './sources', output: './second.txt', formatting: false } };`,
    );
    assert.equal((await run(["generate", "first"], root)).code, 0);
    await assert.rejects(readFile(path.join(root, "second.txt")));
    assert.equal((await run(["generate"], root)).code, 0);
    assert.equal(await readFile(path.join(root, "second.txt"), "utf8"), "Hello world");
    const direct = await run(
      ["generate", "--sources=./sources", "--output=nested/out.txt", "--disable-formatting"],
      root,
    );
    assert.equal(direct.code, 0, direct.stderr);
    for (const args of [
      ["gen"],
      ["hbs"],
      ["generate", "missing"],
      ["generate", "first", "--sources=x"],
      ["generate", "--sources=x"],
      ["generate", "--override=x=a", "--override=x=b"],
      ["generate", "--unknown=x"],
    ])
      assert.equal((await run(args, root)).code, 1, args.join(" "));
  }));
test("shared helpers, partials, per-file data, overrides, alias inheritance, and formatting", () =>
  fixture(async (root, put) => {
    await put(
      "base.json",
      JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./*"] } } }),
    );
    await put("tsconfig.json", '{"extends":"./base.json"}');
    await put("sources/input-data.json", '{"ignored":true}');
    await put(
      "sources/preparation-script.ts",
      `import fs from 'node:fs'; export default () => { fs.appendFileSync(${JSON.stringify(path.join(root, "calls"))}, 'x'); return { items: [{name:'A'}, {name:'B'}] }; };`,
    );
    await put("sources/hbs-helpers.ts", "export default { loud: (x) => x.toUpperCase() };");
    await put("sources/template_partial_label.hbs", "{{loud name}}");
    await put("sources/templates/item.hbs", 'export const name="{{> label}}";');
    await put("replacement.hbs", 'export const other="{{> label}}";');
    await put(
      "sources/main.ts",
      `export default async ({data, generate}) => { for (const item of data.items) { await generate('item', item, item.name + '/item.ts'); await generate('extra', item, item.name + '/extra.ts'); } };`,
    );
    await runGenerator(
      "multi",
      defineJobs({
        multi: { sources: "@/sources", output: "@/out", overrides: { extra: "./replacement.hbs" } },
      }).multi,
      root,
    );
    assert.equal(await readFile(path.join(root, "calls"), "utf8"), "x");
    assert.match(
      await readFile(path.join(root, "out/A/item.ts"), "utf8"),
      /export const name = "A";/,
    );
    assert.match(await readFile(path.join(root, "out/B/extra.ts"), "utf8"), /other = "B"/);
    await put("external.json", '{"items":[{"name":"C"}]}');
    const result = await run(
      [
        "generate",
        "--sources=@/sources",
        "--output=@/direct",
        "--input=external.json",
        "--override=extra=./replacement.hbs",
      ],
      root,
    );
    assert.equal(result.code, 0, result.stderr);
    assert.match(await readFile(path.join(root, "direct/C/extra.ts"), "utf8"), /"C"/);
  }));
test("isolation and actionable failures", () =>
  fixture(async (root, put) => {
    await put("one/input-data.json", '{"name":"test"}');
    await put("one/hbs-helpers.ts", "export default { unique: x => x };");
    await put("one/template.hbs", "{{unique name}}");
    await runGenerator("one", { sources: "one", output: "one.txt", formatting: false }, root);
    await put("two/input-data.json", '{"name":"test"}');
    await put("two/template.hbs", "{{unique name}}");
    await assert.rejects(
      runGenerator("two", { sources: "two", output: "two.txt", formatting: false }, root),
      /Missing helper/,
    );
    await put("two/main.ts", "export default 42;");
    await assert.rejects(
      runGenerator("two", { sources: "two", output: "out" }, root),
      /main.ts must/,
    );
    for (const target of ["../escape.ts", path.join(root, "absolute.ts")]) {
      await put(
        "two/main.ts",
        `export default async ({generate}) => generate('x', {}, ${JSON.stringify(target)});`,
      );
      await assert.rejects(
        runGenerator("two", { sources: "two", output: "out" }, root),
        /relative path|remain inside/,
      );
    }
    await put(
      "two/main.ts",
      "export default async ({generate}) => generate('missing', {}, 'out.ts');",
    );
    await assert.rejects(
      runGenerator("two", { sources: "two", output: "out" }, root),
      /Job "two".*Template "missing"/,
    );
    await assert.rejects(
      runGenerator("alias", { sources: "@/missing", output: "out" }, root),
      /tsconfig/,
    );
  }));
