import assert from "node:assert/strict";
import test from "node:test";

import { runPagesPreflight } from "../scripts/pages-preflight.mjs";
import { verifyPublicSite } from "../scripts/public-site-smoke.mjs";

const siteConfig = {
  publicUrl: "https://example.com/",
  publicLogoUrl: "https://example.com/convolve-wasm-logo.png",
};

function response(body, contentType, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

function page() {
  return `<!doctype html><html><head>
    <meta name="convolve-build" content="new-sha">
    <link rel="stylesheet" href="./assets/app.css">
    <link rel="icon" href="./logo.png">
    <script type="module" src="./assets/app.js"></script>
  </head></html>`;
}

test("reports a missing GitHub Pages configuration", async () => {
  const result = await runPagesPreflight({
    siteConfig,
    pages: { _preflight_error: "Pages API returned HTTP 404" },
    repository: { homepage: siteConfig.publicUrl },
    eventName: "pull_request",
  });

  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].field, "pages.api");
  assert.match(String(result.errors[0].actual), /HTTP 404/u);
});

test("rejects a deployment that does not expose its worker and WASM", async () => {
  const fetchImpl = async (input) => {
    const url = new URL(input);
    if (url.pathname === "/") return response(page(), "text/html");
    if (url.pathname.endsWith("app.js")) {
      return response("console.log('loaded');", "application/javascript");
    }
    if (url.pathname.endsWith(".css")) return response("css", "text/css");
    if (url.pathname.endsWith(".png")) return response("png", "image/png");
    return response("missing", "text/plain", 404);
  };

  await assert.rejects(
    verifyPublicSite({
      publicUrl: siteConfig.publicUrl,
      buildSha: "new-sha",
      fetchImpl,
      attempts: 1,
    }),
    /worker/i,
  );
});

test("rejects an incorrect WASM content type", async () => {
  const fetchImpl = async (input) => {
    const url = new URL(input);
    if (url.pathname === "/") return response(page(), "text/html");
    if (url.pathname.endsWith("app.js")) {
      return response(
        'new Worker(new URL("convolve.worker.js", import.meta.url));',
        "application/javascript",
      );
    }
    if (url.pathname.endsWith("convolve.worker.js")) {
      return response(
        'new URL("convolve_core_bg.wasm", import.meta.url);',
        "application/javascript",
      );
    }
    if (url.pathname.endsWith(".wasm")) return response("wasm", "text/plain");
    if (url.pathname.endsWith(".css")) return response("css", "text/css");
    if (url.pathname.endsWith(".png")) return response("png", "image/png");
    return response("missing", "text/plain", 404);
  };

  await assert.rejects(
    verifyPublicSite({
      publicUrl: siteConfig.publicUrl,
      buildSha: "new-sha",
      fetchImpl,
      attempts: 1,
    }),
    /wasm.*text\/plain.*application\/wasm/i,
  );
});
