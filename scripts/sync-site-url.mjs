import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readSiteConfig } from "./site-config.mjs";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function replaceSiteUrlBlock(text, content, file) {
  const start = "<!-- site-url:start -->";
  const end = "<!-- site-url:end -->";
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`${file} is missing the site URL synchronization markers`);
  }
  return `${text.slice(0, startIndex + start.length)}${content}${text.slice(endIndex)}`;
}

export async function synchronizeSiteUrl({ root, publicUrl, check }) {
  const changed = [];
  const textTargets = [
    { file: "README.md", content: publicUrl },
    {
      file: "docs/release-readiness.md",
      content: `\`${publicUrl}\``,
    },
  ];

  for (const target of textTargets) {
    const absolute = path.join(root, target.file);
    const before = await readFile(absolute, "utf8");
    const after = replaceSiteUrlBlock(before, target.content, target.file);
    if (after !== before) {
      changed.push(target.file);
      if (!check) await writeFile(absolute, after);
    }
  }

  const manifestFile = "packages/convolve-wasm/package.json";
  const manifestPath = path.join(root, manifestFile);
  const manifestBefore = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestBefore);
  manifest.homepage = publicUrl;
  const manifestAfter = `${JSON.stringify(manifest, null, 2)}\n`;
  if (manifestAfter !== manifestBefore) {
    changed.push(manifestFile);
    if (!check) await writeFile(manifestPath, manifestAfter);
  }

  return { changed };
}

async function main() {
  const check = process.argv.includes("--check");
  const { publicUrl } = readSiteConfig();
  const result = await synchronizeSiteUrl({
    root: repositoryRoot,
    publicUrl,
    check,
  });

  if (check && result.changed.length > 0) {
    throw new Error(
      `Site URL derived files are stale: ${result.changed.join(", ")}. Update site.config.json, then run npm run sync:site-url.`,
    );
  }

  console.log(
    result.changed.length > 0
      ? `Synchronized site URL in ${result.changed.join(", ")}.`
      : "Site URL derived files are synchronized.",
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
