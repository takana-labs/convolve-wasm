import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(repoRoot, "apps", "demo", "dist");
const stdoutPath = process.env.CONVOLVE_STDOUT_PATH;
const stderrPath = process.env.CONVOLVE_STDERR_PATH;
const lifecycleNonce = process.env.CONVOLVE_APP_NONCE;
if (!lifecycleNonce) {
  throw new Error("CONVOLVE_APP_NONCE is required");
}

const host = "127.0.0.1";
const port = 4173;
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
]);

function log(path, message) {
  if (path) {
    appendFileSync(path, "[static server] " + message + "\n");
  }
}

function send(
  response,
  statusCode,
  body,
  contentType = "text/plain; charset=utf-8",
) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": contentType,
    "X-Convolve-Lifecycle": lifecycleNonce,
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://" + host + ":" + port);
    const pathname = decodeURIComponent(url.pathname);
    const relativePath =
      pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = resolve(distRoot, relativePath);
    if (filePath !== distRoot && !filePath.startsWith(distRoot + sep)) {
      send(response, 403, "Forbidden");
      return;
    }
    const body = await readFile(filePath);
    send(
      response,
      200,
      body,
      mimeTypes.get(extname(filePath).toLowerCase()) ??
        "application/octet-stream",
    );
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "EISDIR") {
      send(response, 404, "Not found");
      return;
    }
    log(
      stderrPath,
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    send(response, 500, "Internal server error");
  }
});

server.once("error", (error) => {
  log(stderrPath, error.stack ?? error.message);
  process.exit(1);
});
server.listen(port, host, () => {
  log(stdoutPath, "ready: http://" + host + ":" + port);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
