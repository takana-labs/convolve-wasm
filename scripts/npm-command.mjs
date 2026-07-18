export function resolveNpmInvocation({ execPath, npmExecPath, platform }) {
  if (npmExecPath) {
    return { command: execPath, prefix: [npmExecPath] };
  }
  return {
    command: platform === "win32" ? "npm.cmd" : "npm",
    prefix: [],
  };
}
