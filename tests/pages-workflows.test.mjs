import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function workflow(name) {
  return readFile(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8");
}

test("CI blocks verification on a read-only, credential-isolated Pages preflight", async () => {
  const ci = await workflow("ci.yml");
  assert.match(ci, /pages-preflight:/u);
  assert.match(ci, /pages:\s+read/u);
  assert.match(ci, /pages-preflight:\s*\n\s+runs-on:[^\n]+\n\s+timeout-minutes:\s+2/u);
  assert.match(ci, /timeout 20s gh api/u);
  assert.ok(
    ci.indexOf("Collect GitHub Pages metadata") <
      ci.indexOf("Check synchronized site URL"),
  );
  assert.match(ci, /verify:\s*\n\s+needs:\s+pages-preflight/u);
  assert.match(ci, /persist-credentials:\s+false/u);
  assert.match(ci, /GH_TOKEN:\s+\$\{\{ github\.token \}\}/u);
  assert.doesNotMatch(ci, /GITHUB_TOKEN:/u);
  assert.match(ci, /PAGES_METADATA_PATH:/u);
  assert.match(ci, /node scripts\/pages-preflight\.mjs/u);
});

test("Pages deployment gates build on isolated preflight and verifies the deployed SHA", async () => {
  const pages = await workflow("pages.yml");
  assert.match(pages, /pages-preflight:/u);
  assert.match(pages, /pages-preflight:\s*\n\s+runs-on:[^\n]+\n\s+timeout-minutes:\s+2/u);
  assert.match(pages, /timeout 20s gh api/u);
  assert.ok(
    pages.indexOf("Collect GitHub Pages metadata") <
      pages.indexOf("Check synchronized site URL"),
  );
  assert.match(pages, /build:\s*\n\s+needs:\s+pages-preflight/u);
  assert.match(pages, /persist-credentials:\s+false/u);
  assert.doesNotMatch(pages, /GITHUB_TOKEN:/u);
  assert.match(pages, /smoke:\s*\n\s+needs:\s+deploy/u);
  assert.match(pages, /node scripts\/public-site-smoke\.mjs/u);
});
