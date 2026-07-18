import assert from "node:assert/strict";
import test from "node:test";

import { validatePagesHtml } from "../scripts/validate-pages.mjs";

const options = {
  publicUrl: "https://convolve-wasm.app/",
  publicLogoUrl: "https://convolve-wasm.app/convolve-wasm-logo.png",
  buildSha: "abc123",
};

function htmlWith(references) {
  return `<!doctype html>
<html>
  <head>
    <link rel="canonical" href="${options.publicUrl}">
    <meta property="og:url" content="${options.publicUrl}">
    <meta property="og:image" content="${options.publicLogoUrl}">
    <meta name="convolve-build" content="${options.buildSha}">
    ${references}
  </head>
</html>`;
}

test("accepts relative local assets and configured public metadata", () => {
  assert.doesNotThrow(() =>
    validatePagesHtml(
      htmlWith(
        '<script src="./assets/app.js"></script><link href="./assets/app.css"><img src="./logo.png">',
      ),
      options,
    ),
  );
});

test("rejects root-absolute local assets", () => {
  assert.throws(
    () =>
      validatePagesHtml(
        htmlWith('<script src="/convolve-wasm/assets/app.js"></script>'),
        options,
      ),
    /relative local asset reference/i,
  );
});

test("rejects stale canonical metadata and build markers", () => {
  assert.throws(
    () =>
      validatePagesHtml(
        htmlWith("").replace(options.publicUrl, "https://old.example/"),
        options,
      ),
    /canonical/i,
  );
  assert.throws(
    () =>
      validatePagesHtml(htmlWith("").replace(options.buildSha, "old"), options),
    /build SHA/i,
  );
});
