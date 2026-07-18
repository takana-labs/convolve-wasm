import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluatePagesSettings,
  runPagesPreflight,
} from "../scripts/pages-preflight.mjs";

const customSite = {
  publicUrl: "https://convolve-wasm.app/",
  publicLogoUrl: "https://convolve-wasm.app/convolve-wasm-logo.png",
};

function matchingPages(overrides = {}) {
  return {
    html_url: customSite.publicUrl,
    cname: "convolve-wasm.app",
    build_type: "workflow",
    https_enforced: true,
    pending_domain_unverified_at: null,
    https_certificate: {
      state: "approved",
      domains: ["convolve-wasm.app", "www.convolve-wasm.app"],
    },
    ...overrides,
  };
}

test("accepts matching custom-domain settings and warns on stale homepage metadata", () => {
  const result = evaluatePagesSettings({
    siteConfig: customSite,
    pages: matchingPages(),
    repository: { homepage: "http://owner.github.io/convolve-wasm/" },
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].field, "repository.homepage");
});

test("accepts a transferred default project Pages URL without a CNAME", () => {
  const siteConfig = {
    publicUrl: "https://new-owner.github.io/convolve-wasm/",
    publicLogoUrl:
      "https://new-owner.github.io/convolve-wasm/convolve-wasm-logo.png",
  };
  const result = evaluatePagesSettings({
    siteConfig,
    pages: matchingPages({
      html_url: siteConfig.publicUrl,
      cname: null,
      https_certificate: null,
    }),
    repository: { homepage: siteConfig.publicUrl },
  });

  assert.deepEqual(result, { errors: [], warnings: [] });
});

for (const [name, overrides, field] of [
  ["Pages URL mismatch", { html_url: "https://old.example/" }, "pages.html_url"],
  ["CNAME mismatch", { cname: "old.example" }, "pages.cname"],
  ["non-workflow publishing", { build_type: "legacy" }, "pages.build_type"],
  ["disabled HTTPS", { https_enforced: false }, "pages.https_enforced"],
  [
    "pending domain verification",
    { pending_domain_unverified_at: "2026-07-17T00:00:00Z" },
    "pages.pending_domain_unverified_at",
  ],
  [
    "unapproved certificate",
    { https_certificate: { state: "pending", domains: ["convolve-wasm.app"] } },
    "pages.https_certificate.state",
  ],
  [
    "certificate hostname mismatch",
    { https_certificate: { state: "approved", domains: ["other.example"] } },
    "pages.https_certificate.domains",
  ],
]) {
  test(`reports ${name}`, () => {
    const result = evaluatePagesSettings({
      siteConfig: customSite,
      pages: matchingPages(overrides),
      repository: { homepage: customSite.publicUrl },
    });
    assert.ok(result.errors.some((error) => error.field === field));
  });
}

test("pull request preflight performs no network request", async () => {
  const result = await runPagesPreflight({
    siteConfig: customSite,
    pages: matchingPages(),
    repository: { homepage: customSite.publicUrl },
    eventName: "pull_request",
    fetchImpl: async () => {
      throw new Error("pull request preflight must not fetch");
    },
  });

  assert.deepEqual(result.errors, []);
});

test("trusted preflight checks reachability without forwarding credentials", async () => {
  const calls = [];
  const result = await runPagesPreflight({
    siteConfig: customSite,
    pages: matchingPages(),
    repository: { homepage: customSite.publicUrl },
    eventName: "push",
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return new Response("ok", { status: 200 });
    },
  });

  assert.deepEqual(result.errors, []);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.startsWith(customSite.publicUrl));
  assert.equal(calls[0].init.headers.authorization, undefined);
  assert.ok(calls[0].init.signal instanceof AbortSignal);
});
