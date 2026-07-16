# Footer and Icon System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured utility footer and a consistent inline-SVG icon system while preserving every existing audio and deployment behavior.

**Architecture:** Keep `apps/demo` as static HTML/CSS plus the existing TypeScript runtime. Define one hidden SVG symbol sprite in `apps/demo/index.html`, reference it from decorative icons, move project navigation from About into a new footer, and enforce the contract with Playwright and existing link validators.

**Tech Stack:** HTML, CSS, inline SVG, Playwright 1.61, Vite 8, GitHub Actions.

## Global Constraints

- Preserve all existing form control IDs, values, defaults, and runtime behavior.
- Preserve `CONVOLVE()`, Rust DSP, worker/WASM paths, playback, download, and output format.
- Preserve `/` locally and `/convolve-wasm/` on Pages.
- Keep the approved logo files unchanged.
- Add no runtime dependency, icon package, CDN, remote font, analytics, upload, or network request.
- Keep `@ffmpeg/core` absent.
- Do not merge, tag, publish, or create a release.

---

### Task 1: Define the footer and icon contract

**Files:**
- Modify: `tests/pages/pages.spec.ts`
- Modify: `tests/e2e/layout.spec.ts`

**Interfaces:**
- Produces assertions for the exact footer links, owner credit, Bluesky accessibility, icon presence, responsive footer layout, and minimum touch targets.

- [ ] **Step 1: Add failing Pages assertions**

Extend `tests/pages/pages.spec.ts` after the About-panel visibility checks:

```ts
await expect(page.locator("#about .resource-links")).toHaveCount(0);

const footerLinks = page.locator(".site-footer .footer-links a");
await expect(footerLinks).toHaveCount(4);
await expect(footerLinks.nth(0)).toHaveAttribute(
  "href",
  "https://github.com/agunal/convolve-wasm",
);
await expect(footerLinks.nth(1)).toHaveAttribute(
  "href",
  "https://github.com/agunal/convolve-wasm/blob/main/packages/convolve-wasm/README.md",
);
await expect(footerLinks.nth(2)).toHaveAttribute(
  "href",
  "https://github.com/agunal/convolve-wasm/blob/main/docs/browser-support.md",
);
await expect(footerLinks.nth(3)).toHaveAttribute(
  "href",
  "https://github.com/agunal/convolve-wasm/issues",
);

await expect(page.locator(".owner-name")).toHaveText("@takana.gg");
await expect(page.locator(".owner-name")).not.toHaveAttribute("href");
const bluesky = page.getByRole("link", { name: "@takana.gg on Bluesky" });
await expect(bluesky).toHaveAttribute(
  "href",
  "https://bsky.app/profile/takana.gg",
);
await expect(bluesky).toHaveAttribute("target", "_blank");
await expect(bluesky).toHaveAttribute("rel", "noreferrer");
await expect(page.locator(".site-footer")).toContainText(
  "No uploads · No analytics · No server processing",
);
await expect(page.locator(".site-footer")).toContainText(
  "MIT licensed · Rust + WebAssembly",
);
```

- [ ] **Step 2: Add failing icon and layout assertions**

Extend `tests/e2e/layout.spec.ts` with a desktop test that checks:

```ts
await page.setViewportSize({ width: 1180, height: 900 });
await page.goto("/");
await expect(page.locator(".icon-sprite")).toHaveCount(1);
await expect(page.locator("#run .ui-icon")).toHaveCount(1);
await expect(page.locator(".download .ui-icon")).toHaveCount(1);
await expect(page.locator(".control-label .ui-icon")).toHaveCount(4);
await expect(page.locator(".site-footer .ui-icon")).toHaveCount(5);
```

In the phone test, verify `.footer-grid` resolves to one column, each footer link is at least 44px high, and the document still has no horizontal overflow.

- [ ] **Step 3: Run the browser suites and confirm RED**

Run in CI through the draft PR.

Expected: local browser E2E and Pages smoke fail because the existing page has no icon sprite, the resource links are still in About, and the minimal footer lacks owner and Bluesky content.

- [ ] **Step 4: Commit the RED contract**

Commit message:

```text
test: define footer and icon contract
```

---

### Task 2: Implement the inline icon system and utility footer

**Files:**
- Modify: `apps/demo/index.html`
- Modify: `apps/demo/src/styles.css`

**Interfaces:**
- Produces `.icon-sprite`, `.ui-icon`, `.control-label`, `.footer-grid`, `.footer-links`, `.owner-name`, and the accessible Bluesky link.

- [ ] **Step 1: Add one hidden SVG symbol sprite**

Add an inline `<svg class="icon-sprite" aria-hidden="true">` immediately inside `<body>`. Define symbols for shield, chip, waveform, file, pan, slider, reverse, meter, download, input/output, server-off, GitHub, book, browser, issue, and Bluesky. Stroke icons use `fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, `stroke-linecap="round"`, and `stroke-linejoin="round"`. The Bluesky symbol uses `fill="currentColor"`.

- [ ] **Step 2: Add icons to selected existing elements**

Use decorative references of this form:

```html
<svg class="ui-icon" aria-hidden="true"><use href="#icon-shield"></use></svg>
```

Add them to hero badges, Audio A/B labels, the four effect labels, append reverse, render, download, About-card headings, footer links, and Bluesky. Keep all existing IDs and visible text.

- [ ] **Step 3: Replace About navigation with the structured footer**

Remove `.resource-links` from `#about`. Replace the minimal footer with:

```html
<footer class="site-footer">
  <div class="footer-grid">
    <section class="footer-brand" aria-labelledby="footer-brand-heading">...</section>
    <nav class="footer-links" aria-label="Project resources">...</nav>
    <section class="footer-owner" aria-label="Project owner">...</section>
  </div>
  <div class="footer-meta">MIT licensed · Rust + WebAssembly</div>
</footer>
```

The owner section contains visible text `Built by ` followed by `<span class="owner-name">@takana.gg</span>` and a separate icon-only Bluesky anchor with `aria-label="@takana.gg on Bluesky"`, `target="_blank"`, and `rel="noreferrer"`.

- [ ] **Step 4: Style the icon and footer system**

Add CSS that:

- visually hides `.icon-sprite` without removing its symbols;
- gives `.ui-icon` a consistent `1.05rem` square footprint and `flex: none`;
- aligns `.control-label`, hero badges, buttons, links, and headings with icons;
- renders `.site-footer` as an engraved slate surface consistent with the existing design;
- uses a three-column `.footer-grid` on desktop and one column at the existing phone/tablet breakpoint;
- preserves minimum 44px link and Bluesky targets;
- makes `.owner-name` plain text, not link-styled;
- preserves no-overflow behavior.

- [ ] **Step 5: Run the exact browser and Pages suites**

Run:

```bash
npm run test:e2e
npm run build:pages
npm run validate:pages
npm run test:pages
```

Expected: PASS.

- [ ] **Step 6: Commit the implementation**

Commit message:

```text
feat: add utility footer and interface icons
```

---

### Task 3: Verify the complete repository contract

**Files:**
- No production files beyond Tasks 1–2.

**Interfaces:**
- Confirms the branch remains behavior-preserving and release-neutral.

- [ ] **Step 1: Run repository validators**

```bash
npm run validate:docs
npm run validate:links
```

Expected: PASS.

- [ ] **Step 2: Run the full CI matrix**

The pull-request workflow must pass documentation images, repository links, Rust formatting/Clippy/tests, WASM build and Chromium tests, TypeScript/package-consumer tests, demo and Pages builds, Chromium/WebKit E2E, Pages subpath smoke, package inspection, and `@ffmpeg/core` absence.

- [ ] **Step 3: Review the final diff**

The final diff must remain limited to the approved spec/plan, `apps/demo/index.html`, `apps/demo/src/styles.css`, and browser tests. It must contain no Rust, runtime TypeScript, package metadata, generated WASM, logo, release, registry, or audio-fixture changes.

- [ ] **Step 4: Mark the pull request ready**

Update the PR description with exact-head CI evidence and stop before merge.
