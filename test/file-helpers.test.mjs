import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { getJson } from "../dist/src/file-helpers.js";

test("loads JSON over HTTP, including redirects", async () => {
  const server = http.createServer((req, res) => {
    if (req.url === "/redirect") {
      res.writeHead(302, { Location: "/data" });
      res.end();
    } else {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.deepEqual(await getJson(`${base}/data`), { ok: true });
    assert.deepEqual(await getJson(`${base}/redirect`), { ok: true });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
