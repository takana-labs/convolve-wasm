import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { readSiteConfig } from "./site-config.mjs";

function diagnostic(field, expected, actual, remediation) {
  return { field, expected, actual, remediation };
}

function normalizeUrl(value) {
  if (!value) return null;
  try {
    return new URL(value).href;
  } catch {
    return String(value);
  }
}

function metadataFailure(pages, repository) {
  const actual = pages?._preflight_error ?? repository?._preflight_error;
  if (!actual) return null;
  return diagnostic(
    "pages.api",
    "readable Pages configuration",
    actual,
    "Confirm Pages is enabled and GITHUB_TOKEN has pages: read.",
  );
}

export function evaluatePagesSettings({ siteConfig, pages, repository }) {
  const errors = [];
  const warnings = [];
  const publicUrl = new URL(siteConfig.publicUrl);
  const customDomain = !publicUrl.hostname.endsWith(".github.io");

  if (normalizeUrl(pages.html_url) !== siteConfig.publicUrl) {
    errors.push(
      diagnostic(
        "pages.html_url",
        siteConfig.publicUrl,
        pages.html_url ?? null,
        "Set the GitHub Pages custom domain or update site.config.json.",
      ),
    );
  }

  if (pages.build_type !== "workflow") {
    errors.push(
      diagnostic(
        "pages.build_type",
        "workflow",
        pages.build_type ?? null,
        "Set Pages source to GitHub Actions.",
      ),
    );
  }

  const expectedCname = customDomain ? publicUrl.hostname : null;
  if ((pages.cname ?? null) !== expectedCname) {
    errors.push(
      diagnostic(
        "pages.cname",
        expectedCname,
        pages.cname ?? null,
        customDomain
          ? `Set the Pages custom domain to ${publicUrl.hostname}.`
          : "Remove the Pages custom domain for the default github.io URL.",
      ),
    );
  }

  if (publicUrl.protocol === "https:" && pages.https_enforced !== true) {
    errors.push(
      diagnostic(
        "pages.https_enforced",
        true,
        pages.https_enforced ?? null,
        "Enable Enforce HTTPS in GitHub Pages settings.",
      ),
    );
  }

  if (pages.pending_domain_unverified_at) {
    errors.push(
      diagnostic(
        "pages.pending_domain_unverified_at",
        null,
        pages.pending_domain_unverified_at,
        "Verify the custom domain, then rerun this workflow.",
      ),
    );
  }

  if (customDomain && publicUrl.protocol === "https:") {
    const certificate = pages.https_certificate;
    if (certificate?.state !== "approved") {
      errors.push(
        diagnostic(
          "pages.https_certificate.state",
          "approved",
          certificate?.state ?? null,
          "Wait for GitHub to approve the Pages certificate, then rerun.",
        ),
      );
    } else if (!certificate.domains?.includes(publicUrl.hostname)) {
      errors.push(
        diagnostic(
          "pages.https_certificate.domains",
          publicUrl.hostname,
          certificate.domains ?? [],
          "Reconfigure the custom domain so its certificate covers the hostname.",
        ),
      );
    }
  }

  if (normalizeUrl(repository.homepage) !== siteConfig.publicUrl) {
    warnings.push(
      diagnostic(
        "repository.homepage",
        siteConfig.publicUrl,
        repository.homepage ?? null,
        "Update the repository Website field; this does not block delivery.",
      ),
    );
  }

  return { errors, warnings };
}

export async function runPagesPreflight({
  siteConfig,
  pages,
  repository,
  eventName,
  fetchImpl = fetch,
  requestTimeoutMs = 15_000,
}) {
  const failure = metadataFailure(pages, repository);
  if (failure) return { errors: [failure], warnings: [] };

  const result = evaluatePagesSettings({ siteConfig, pages, repository });
  if (eventName === "push" || eventName === "workflow_dispatch") {
    try {
      const url = new URL(siteConfig.publicUrl);
      url.searchParams.set("preflight", Date.now().toString());
      const response = await fetchImpl(url, {
        headers: { "cache-control": "no-cache" },
        redirect: "follow",
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      result.errors.push(
        diagnostic(
          "publicUrl.reachability",
          "successful HTTPS response",
          error instanceof Error ? error.message : String(error),
          "Check DNS, TLS, and the configured Pages domain.",
        ),
      );
    }
  }
  return result;
}

function escapeCommand(value) {
  return String(value)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

function annotation(kind, item) {
  const message = `${item.field}: expected ${JSON.stringify(item.expected)}, got ${JSON.stringify(item.actual)}. ${item.remediation}`;
  console.log(
    `::${kind} title=Pages preflight ${escapeCommand(item.field)}::${escapeCommand(message)}`,
  );
}

function summaryRow(level, item) {
  return `| ${level} | \`${item.field}\` | \`${JSON.stringify(item.expected)}\` | \`${JSON.stringify(item.actual)}\` | ${item.remediation} |`;
}

async function readMetadata(environmentName) {
  const file = process.env[environmentName];
  if (!file) throw new Error(`${environmentName} is required`);
  return JSON.parse(await readFile(file, "utf8"));
}

async function main() {
  const siteConfig = readSiteConfig();
  const [pages, repository] = await Promise.all([
    readMetadata("PAGES_METADATA_PATH"),
    readMetadata("REPOSITORY_METADATA_PATH"),
  ]);
  const result = await runPagesPreflight({
    siteConfig,
    pages,
    repository,
    eventName: process.env.GITHUB_EVENT_NAME,
  });

  for (const item of result.errors) annotation("error", item);
  for (const item of result.warnings) annotation("warning", item);

  const summary = [
    "## GitHub Pages preflight",
    "",
    "| Level | Field | Expected | Actual | Remediation |",
    "| --- | --- | --- | --- | --- |",
    ...result.errors.map((item) => summaryRow("Error", item)),
    ...result.warnings.map((item) => summaryRow("Warning", item)),
  ].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  } else {
    console.log(summary);
  }

  if (result.errors.length > 0) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`::error title=Pages preflight failed::${escapeCommand(message)}`);
    process.exitCode = 1;
  }
}
