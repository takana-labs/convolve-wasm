import assert from "node:assert/strict";
import test from "node:test";

import { resolveNpmInvocation } from "../scripts/npm-command.mjs";

test("invokes npm through the current Node process when npm_execpath is available", () => {
  assert.deepEqual(
    resolveNpmInvocation({
      execPath: "C:/Program Files/nodejs/node.exe",
      npmExecPath: "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js",
      platform: "win32",
    }),
    {
      command: "C:/Program Files/nodejs/node.exe",
      prefix: ["C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"],
    },
  );
});

test("falls back to the platform npm executable outside an npm lifecycle", () => {
  assert.deepEqual(
    resolveNpmInvocation({ execPath: "node", platform: "win32" }),
    { command: "npm.cmd", prefix: [] },
  );
  assert.deepEqual(resolveNpmInvocation({ execPath: "node", platform: "linux" }), {
    command: "npm",
    prefix: [],
  });
});
