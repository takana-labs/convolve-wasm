import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const siteConfigPath = fileURLToPath(
  new URL("../site.config.json", import.meta.url),
);

export function parseSiteConfig(value) {
  if (!value || typeof value.publicUrl !== "string" || !value.publicUrl) {
    throw new Error("site.config.json publicUrl must be a non-empty string");
  }

  let url;
  try {
    url = new URL(value.publicUrl);
  } catch {
    throw new Error("site.config.json publicUrl must be an absolute URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("site.config.json publicUrl must use HTTP(S)");
  }
  if (url.search) {
    throw new Error("site.config.json publicUrl must not contain a query string");
  }
  if (url.hash) {
    throw new Error("site.config.json publicUrl must not contain a fragment");
  }
  if (!value.publicUrl.endsWith("/")) {
    throw new Error("site.config.json publicUrl must have a trailing slash");
  }

  return {
    publicUrl: url.href,
    publicLogoUrl: new URL("convolve-wasm-logo.png", url).href,
  };
}

export function readSiteConfig(path = siteConfigPath) {
  return parseSiteConfig(JSON.parse(readFileSync(path, "utf8")));
}
