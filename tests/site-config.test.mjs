import assert from "node:assert/strict";
import test from "node:test";

import { parseSiteConfig } from "../scripts/site-config.mjs";

test("accepts custom-domain and project Pages URLs", () => {
  assert.deepEqual(parseSiteConfig({ publicUrl: "https://convolve-wasm.app/" }), {
    publicUrl: "https://convolve-wasm.app/",
    publicLogoUrl: "https://convolve-wasm.app/convolve-wasm-logo.png",
  });
  assert.deepEqual(
    parseSiteConfig({ publicUrl: "https://owner.github.io/convolve-wasm/" }),
    {
      publicUrl: "https://owner.github.io/convolve-wasm/",
      publicLogoUrl:
        "https://owner.github.io/convolve-wasm/convolve-wasm-logo.png",
    },
  );
});

for (const [name, config, message] of [
  ["requires publicUrl", {}, "publicUrl must be a non-empty string"],
  ["requires an absolute URL", { publicUrl: "/convolve-wasm/" }, "absolute"],
  ["rejects non-HTTP protocols", { publicUrl: "ftp://example.com/" }, "HTTP"],
  ["rejects query strings", { publicUrl: "https://example.com/?v=1" }, "query"],
  ["rejects fragments", { publicUrl: "https://example.com/#app" }, "fragment"],
  ["requires a trailing slash", { publicUrl: "https://example.com/app" }, "trailing slash"],
  ["requires a literal root trailing slash", { publicUrl: "https://example.com" }, "trailing slash"],
]) {
  test(name, () => {
    assert.throws(() => parseSiteConfig(config), new RegExp(message, "i"));
  });
}
