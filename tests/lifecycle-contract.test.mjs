import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

const lifecycleSource = await readFile(
  new URL("../scripts/app.mjs", import.meta.url),
  "utf8",
);
const serverSource = await readFile(
  new URL("../scripts/app-server.mjs", import.meta.url),
  "utf8",
);

test("exposes the project-owned lifecycle command contract", () => {
  assert.deepEqual(
    Object.fromEntries(
      [
        "app:status",
        "app:url",
        "app:logs",
        "app:ready",
        "app:start:hidden",
        "app:stop",
        "app:restart:hidden",
        "app:doctor",
      ].map((name) => [name, packageJson.scripts[name]]),
    ),
    {
      "app:status": "node scripts/app.mjs status",
      "app:url": "node scripts/app.mjs url",
      "app:logs": "node scripts/app.mjs logs",
      "app:ready": "node scripts/app.mjs ready",
      "app:start:hidden": "node scripts/app.mjs start --hidden",
      "app:stop": "node scripts/app.mjs stop",
      "app:restart:hidden": "node scripts/app.mjs restart --hidden",
      "app:doctor": "node scripts/app.mjs doctor",
    },
  );
});

test("binds readiness and shutdown to the launched server identity", () => {
  assert.match(lifecycleSource, /randomUUID\(\)/u);
  assert.match(lifecycleSource, /CONVOLVE_APP_NONCE/u);
  assert.match(lifecycleSource, /waitUntilStopped/u);
  assert.match(lifecycleSource, /\[\.\.\.invocation\.prefix, "run", "build"\]/u);
  assert.match(
    lifecycleSource,
    /Get-CimInstance Win32_Process -Filter/u,
  );
  assert.equal(
    lifecycleSource.match(/CONVOLVE_STDOUT_PATH/gu)?.length,
    2,
  );
  assert.equal(
    lifecycleSource.match(/CONVOLVE_STDERR_PATH/gu)?.length,
    2,
  );
  assert.match(serverSource, /"X-Convolve-Lifecycle": lifecycleNonce/u);
});

test("lifecycle parser accepts the documented actions and bounded log tails", async () => {
  const { parseLifecycleArgs } = await import("../scripts/app.mjs");

  assert.deepEqual(parseLifecycleArgs(["status"]), {
    action: "status",
    hidden: false,
    tail: null,
  });
  assert.deepEqual(parseLifecycleArgs(["start", "--hidden"]), {
    action: "start",
    hidden: true,
    tail: null,
  });
  assert.deepEqual(parseLifecycleArgs(["logs", "--tail", "25"]), {
    action: "logs",
    hidden: false,
    tail: 25,
  });
  assert.deepEqual(parseLifecycleArgs(["logs", "--tail"]), {
    action: "logs",
    hidden: false,
    tail: 100,
  });
  assert.throws(
    () => parseLifecycleArgs(["logs", "--tail", "25junk"]),
    /tail must be an integer/i,
  );
  assert.throws(() => parseLifecycleArgs(["unknown"]), /unknown action/i);
});
