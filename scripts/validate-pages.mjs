import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { validatePagesHtml } from "./pages-artifact.mjs";
import { readSiteConfig } from "./site-config.mjs";

export { validatePagesHtml } from "./pages-artifact.mjs";

const defaultRoot = path.resolve("apps/demo/dist");

async function walk(root, directory = root) {
  const entries = await readdir(directory);
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry);
    const info = await stat(absolute);
    if (info.isDirectory()) {
      files.push(...(await walk(root, absolute)));
    } else if (info.isFile()) {
      files.push(path.relative(root, absolute).replaceAll(path.sep, "/"));
    }
  }

  return files.sort();
}

function requireValue(value, message) {
  if (!value) throw new Error(message);
  return value;
}

export async function validatePagesArtifact(root = defaultRoot) {
  const files = await walk(root);
  const indexPath = requireValue(
    files.find((file) => file === "index.html"),
    "Pages artifact is missing index.html",
  );
  const logoPath = requireValue(
    files.find((file) => file === "convolve-wasm-logo.png"),
    "Pages artifact is missing the canonical logo",
  );
  const workerPath = requireValue(
    files.find((file) => /(^|\/)convolve\.worker(?:-[^/]+)?\.js$/u.test(file)),
    "Pages artifact is missing the module worker",
  );
  const wasmPath = requireValue(
    files.find((file) => file.endsWith(".wasm")),
    "Pages artifact is missing the WASM binary",
  );

  const privateAudio = files.filter((file) => /\.(?:m4a|wav)$/iu.test(file));
  if (privateAudio.length > 0) {
    throw new Error(`Pages artifact contains audio files: ${privateAudio.join(", ")}`);
  }

  const html = await readFile(path.join(root, indexPath), "utf8");
  if (html.includes("/src/")) {
    throw new Error("Pages HTML still references source files");
  }

  const siteConfig = readSiteConfig();
  validatePagesHtml(html, {
    ...siteConfig,
    buildSha: process.env.GITHUB_SHA?.trim() || "local",
  });

  return {
    root,
    index: indexPath,
    logo: logoPath,
    worker: workerPath,
    wasm: wasmPath,
    files: files.length,
  };
}

async function main() {
  console.log(JSON.stringify(await validatePagesArtifact(), null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
