# GitHub Pages Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the existing browser audio application at `https://agunal.github.io/convolve-wasm/` with a compact About section, privacy footer, Pages-safe runtime assets, and automated deployment.

**Architecture:** Keep `apps/demo` as the single-page application. Build the package and demo with an explicit `/convolve-wasm/` Vite base, validate the static artifact, exercise the deployed subpath with Playwright, and publish `apps/demo/dist` through GitHub's official Pages actions.

**Tech Stack:** Vite 8, TypeScript 7, Playwright 1.61, Rust stable, wasm-pack 0.14, GitHub Actions, GitHub Pages.

## Global Constraints

- Preserve the existing `CONVOLVE` API and DSP semantics.
- Audio stays browser-local; no analytics, server upload, storage, telemetry, service worker, or remote processing.
- Keep `@ffmpeg/core` absent.
- Production Pages base is exactly `/convolve-wasm/`; local development and existing E2E remain rooted at `/`.
- The canonical logo remains `apps/demo/public/convolve-wasm-logo.png`.
- Do not create a release, tag, npm publication, or custom domain.
- The Pages workflow deploys only from `main` or manual dispatch and uses least-privilege permissions.

---

### Task 1: Add a deterministic Pages build and artifact validator

**Files:**
- Create: `scripts/build-pages.mjs`
- Create: `scripts/validate-pages.mjs`
- Modify: `package.json`
- Modify: `apps/demo/package.json`
- Modify: `apps/demo/vite.config.ts`

**Interfaces:**
- Produces: root commands `npm run build:pages`, `npm run validate:pages`, and demo command `npm run preview`.
- Produces: `apps/demo/dist` built with base `/convolve-wasm/`.

- [ ] **Step 1: Add the failing root scripts**

Add these entries to root `package.json`:

```json
"build:pages": "node scripts/build-pages.mjs",
"validate:pages": "node scripts/validate-pages.mjs"
```

Add this entry to `apps/demo/package.json`:

```json
"preview": "vite preview"
```

Run: `npm run build:pages`
Expected: FAIL because `scripts/build-pages.mjs` does not exist.

- [ ] **Step 2: Implement the Pages build wrapper**

Create `scripts/build-pages.mjs`:

```js
import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(args, env = process.env) {
  const result = spawnSync(npm, args, { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["run", "build:wasm"]);
run(["run", "build", "-w", "@agunal/convolve-wasm"]);
run(["run", "build", "-w", "@agunal/convolve-demo"], {
  ...process.env,
  CONVOLVE_DEMO_BASE: "/convolve-wasm/",
});
```

Modify `apps/demo/vite.config.ts`:

```ts
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.CONVOLVE_DEMO_BASE || "/",
    server: { port: 4173 },
    preview: { port: 4173 },
  };
});
```

- [ ] **Step 3: Implement artifact validation**

Create `scripts/validate-pages.mjs` that recursively enumerates `apps/demo/dist`, fails unless `index.html`, the logo, at least one `.wasm`, and a worker JavaScript artifact exist, rejects `.wav`/`.m4a` files, rejects `/src/` HTML references, requires `/convolve-wasm/` in built HTML, and rejects root-absolute HTML asset references outside `/convolve-wasm/`.

- [ ] **Step 4: Run build and validation**

Run:

```bash
npm run build:pages
npm run validate:pages
```

Expected: both commands exit 0 and validation prints the discovered HTML, logo, worker, and WASM paths.

- [ ] **Step 5: Commit**

```bash
git add package.json apps/demo/package.json apps/demo/vite.config.ts scripts/build-pages.mjs scripts/validate-pages.mjs
git commit -m "build: add Pages subpath artifact build"
```

### Task 2: Make the application a complete Pages homepage

**Files:**
- Modify: `apps/demo/index.html`
- Modify: `apps/demo/src/styles.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: Vite `%BASE_URL%` substitution from Task 1.
- Produces: base-aware logo/favicon, About section, privacy footer, and hosted-app documentation link.

- [ ] **Step 1: Write the failing Pages smoke expectations**

Create `tests/pages/pages.spec.ts` with assertions for `.brand-mark`, `#audio-a`, `#audio-b`, `#run`, `#about`, `.site-footer`, and links to the repository, package README, browser support, and release notes.

Run: `npm run test:pages`
Expected: FAIL because the Pages test command/config and new page sections do not yet exist.

- [ ] **Step 2: Make logo paths base-aware and add content**

In `apps/demo/index.html`, use:

```html
<link rel="icon" type="image/png" href="%BASE_URL%convolve-wasm-logo.png" />
<img class="brand-mark" src="%BASE_URL%convolve-wasm-logo.png" ... />
```

Append an `<section id="about" class="about-panel">` explaining local processing, worker/WASM architecture, WAV/M4A behavior, PCM24 output, and the absence of a server fallback or bundled FFmpeg. Add four external documentation links and a `.site-footer` that says files are never uploaded.

- [ ] **Step 3: Style the About section and footer**

Extend `apps/demo/src/styles.css` with focused rules for `.about-panel`, `.about-grid`, `.about-card`, `.resource-links`, and `.site-footer`, reusing the current colors, radii, focus treatment, and mobile breakpoint.

- [ ] **Step 4: Add the hosted app link**

Near the top of `README.md`, add:

```markdown
**Use the app:** https://agunal.github.io/convolve-wasm/
```

State that the hosted app processes files locally and is distinct from npm installation.

- [ ] **Step 5: Commit**

```bash
git add apps/demo/index.html apps/demo/src/styles.css README.md tests/pages/pages.spec.ts
git commit -m "feat: turn demo into Pages application site"
```

### Task 3: Add subpath browser verification

**Files:**
- Create: `tests/pages/playwright.config.ts`
- Modify: `tests/pages/pages.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `apps/demo/dist` from `npm run build:pages` and existing WAV fixture generators from `tests/e2e/fixtures.ts`.
- Produces: root command `npm run test:pages`.

- [ ] **Step 1: Add the Pages Playwright command**

Add to root `package.json`:

```json
"test:pages": "playwright test -c tests/pages/playwright.config.ts"
```

- [ ] **Step 2: Add the dedicated config**

Create `tests/pages/playwright.config.ts` with one Chromium project, base URL `http://127.0.0.1:4173/convolve-wasm/`, and a web server running:

```text
npm run preview -w @agunal/convolve-demo -- --host 127.0.0.1 --port 4173
```

- [ ] **Step 3: Exercise the worker/WASM path**

In `tests/pages/pages.spec.ts`, import `makeSourceAWav` and `makeImpulseResponseWav`, upload them, click `#run`, wait for `data-state="done"`, and assert preview/download blob URLs. Capture responses whose paths include `convolve.worker` or end in `.wasm`; assert both classes were requested beneath `/convolve-wasm/`. Assert no page errors or console errors.

- [ ] **Step 4: Run Pages verification**

Run:

```bash
npm run build:pages
npm run validate:pages
npx playwright install --with-deps chromium
npm run test:pages
```

Expected: artifact validation passes and the Pages smoke test passes in Chromium.

- [ ] **Step 5: Commit**

```bash
git add package.json tests/pages/playwright.config.ts tests/pages/pages.spec.ts
git commit -m "test: verify Pages worker and WASM subpath"
```

### Task 4: Add GitHub Pages deployment

**Files:**
- Create: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: `npm run build:pages`, `npm run validate:pages`, and `npm run test:pages`.
- Produces: deployment of `apps/demo/dist` to the `github-pages` environment.

- [ ] **Step 1: Add the workflow**

Create `.github/workflows/pages.yml` with push-to-`main` and `workflow_dispatch` triggers, `contents: read`, `pages: write`, and `id-token: write`, a `pages` concurrency group, a build job using Node `22.16.0`, stable Rust, `wasm32-unknown-unknown`, `wasm-pack 0.14.0`, `npm ci`, Pages build/validation/Chromium smoke, `actions/configure-pages@v5`, and `actions/upload-pages-artifact@v4`. Add a deploy job using the `github-pages` environment and `actions/deploy-pages@v4`.

- [ ] **Step 2: Validate workflow syntax through PR CI**

Push the workflow and inspect the pull-request CI run. Expected: existing CI passes; the Pages deployment workflow does not deploy on the feature branch because its push trigger is restricted to `main`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/pages.yml
git commit -m "ci: deploy application to GitHub Pages"
```

### Task 5: Final verification and pull request

**Files:**
- Review all changed files from `main...feat/github-pages-site`.

- [ ] **Step 1: Run full verification**

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npm ci
npm run build:wasm
npm run test:ts
npm run build
npm run build:pages
npm run validate:pages
npx playwright install --with-deps chromium webkit
wasm-pack test --headless --chrome crates/convolve-core
npm run test:e2e
npm run test:pages
npm pack -w @agunal/convolve-wasm --dry-run
npm ls @ffmpeg/core
git diff --check
git status --short
```

Expected: all applicable commands pass; `npm ls @ffmpeg/core` may exit nonzero only because the dependency is absent; the working tree is clean.

- [ ] **Step 2: Open the pull request**

Open a PR from `feat/github-pages-site` to `main` summarizing the site, base-path handling, official Pages deployment, validation, and privacy boundary. Stop before merge.

- [ ] **Step 3: Verify PR CI**

Inspect every job and step on the exact PR head. Report the exact head SHA, workflow run ID, changed paths, and any remaining requirement to enable **Settings → Pages → Source: GitHub Actions** after merge.
