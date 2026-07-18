import { spawnSync } from "node:child_process";

import { resolveNpmInvocation } from "./npm-command.mjs";

const npm = resolveNpmInvocation({
  execPath: process.execPath,
  npmExecPath: process.env.npm_execpath,
  platform: process.platform,
});

function run(args, env = process.env) {
  const result = spawnSync(npm.command, [...npm.prefix, ...args], {
    stdio: "inherit",
    env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["run", "build:wasm"]);
run(["run", "build", "-w", "@takana-labs/convolve-wasm"]);
run(["run", "build", "-w", "@takana-labs/convolve-demo"]);
