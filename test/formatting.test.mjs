import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { formatSourceFile } from "../dist/src/formatting-helpers.js";

test("formats generated TypeScript with the destination's oxfmt configuration", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "typesynth-format-"));
  try {
    await writeFile(path.join(folder, ".oxfmtrc.json"), JSON.stringify({ semi: false, singleQuote: true }));
    const output = path.join(folder, "result.ts");
    await writeFile(output, 'const   message="hello";');
    await formatSourceFile(output);
    assert.equal(await readFile(output, "utf8"), "const message = 'hello'\n");
    const invalid = "export const = ;";
    await writeFile(output, invalid);
    await assert.rejects(formatSourceFile(output));
    assert.equal(await readFile(output, "utf8"), invalid);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
