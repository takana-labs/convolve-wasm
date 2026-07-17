# Takana Labs and JSR Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare a transfer-safe branch that makes Takana Labs, JSR, and `convolve-wasm.app` the canonical project identity without changing runtime behavior.

**Architecture:** Preserve the monorepo and built browser package. Rename workspace identities and active URLs, add a JSR manifest for the built `dist` artifact, replace npm publication with inspected JSR candidate and OIDC publish workflows, and enforce the result through a repository identity validator plus existing browser/package tests.

**Tech Stack:** Rust, WebAssembly, wasm-pack, TypeScript, Vite, npm workspaces, Vitest, Playwright, GitHub Actions, JSR.

## Global Constraints

- Stable repository target: `takana-labs/convolve-wasm`.
- Stable package: `@takana-labs/convolve-wasm@0.1.0` on JSR.
- Canonical site: `https://convolve-wasm.app/`.
- Preserve `/convolve-wasm/` as the GitHub Pages project-site build base.
- Preserve the public `CONVOLVE` API and all fixed DSP, memory, worker, and PCM24 output semantics.
- Do not publish, tag, merge, create a GitHub Release, or modify external DNS/JSR settings.

---

### Task 1: Define the migration contract

**Files:**
- Create: `scripts/validate-project-identity.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `npm run validate:identity`, which exits nonzero on legacy active identity.

- [x] **Step 1: Add the failing identity validator**
- [x] **Step 2: Add the root npm script**
- [x] **Step 3: Run the validator in CI before compilation**
- [ ] **Step 4: Confirm the pull-request CI fails for legacy identity reasons**

### Task 2: Rename active workspace and repository identity

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `packages/convolve-wasm/package.json`
- Modify: `apps/demo/package.json`
- Modify: `apps/demo/src/main.ts`
- Modify: active README, docs, site, test, validator, and workflow files containing canonical identity.

**Interfaces:**
- Produces: workspace names `@takana-labs/convolve-wasm` and `@takana-labs/convolve-demo`.

- [ ] **Step 1: Replace package and workspace names**
- [ ] **Step 2: Regenerate the npm lockfile**
- [ ] **Step 3: Replace canonical GitHub, raw asset, issue, and Pages URLs**
- [ ] **Step 4: Run `npm run validate:identity` and confirm it now reaches JSR-specific checks**

### Task 3: Add the JSR package definition

**Files:**
- Create: `packages/convolve-wasm/jsr.json`
- Create: `packages/convolve-wasm/LICENSE`
- Modify: `packages/convolve-wasm/package.json`
- Modify: `packages/convolve-wasm/README.md`

**Interfaces:**
- Produces: a JSR package rooted at `packages/convolve-wasm`, exporting `./dist/index.js`.

- [ ] **Step 1: Add schema, name, version, export, and explicit publish include list**
- [ ] **Step 2: Copy the MIT license into the package root**
- [ ] **Step 3: Remove npm-only `publishConfig`**
- [ ] **Step 4: Document `npx jsr add @takana-labs/convolve-wasm`**
- [ ] **Step 5: Build and run `npx jsr publish --dry-run`**

### Task 4: Replace npm release workflows with JSR workflows

**Files:**
- Modify: `.github/workflows/release-candidate.yml`
- Delete: `.github/workflows/publish.yml`
- Create: `.github/workflows/publish-jsr.yml`

**Interfaces:**
- Produces: `jsr-release-candidate` artifact and OIDC JSR publication workflow.

- [ ] **Step 1: Validate exact source SHA, current main, version, JSR manifest, and browser matrix**
- [ ] **Step 2: Run the complete build/test matrix and JSR dry run**
- [ ] **Step 3: Stage the inspected package directory and SHA-256 metadata**
- [ ] **Step 4: Verify approved artifact identity in the publish workflow**
- [ ] **Step 5: Publish with `id-token: write` and no registry secret**

### Task 5: Align Pages and documentation

**Files:**
- Modify: `apps/demo/index.html`
- Modify: Pages/link/image validators and tests
- Modify: `README.md`, package README, architecture, browser support, release readiness, and v0.1.0 release notes

**Interfaces:**
- Produces: canonical public URL `https://convolve-wasm.app/` while retaining subpath test coverage.

- [ ] **Step 1: Update Open Graph and canonical project links**
- [ ] **Step 2: Update raw asset and issue/documentation URLs**
- [ ] **Step 3: Preserve `/convolve-wasm/` base-path tests**
- [ ] **Step 4: Validate all active links and image assets**

### Task 6: Complete validation and handoff

**Files:**
- Modify as required by failures only.

**Interfaces:**
- Produces: a green draft PR ready to survive repository transfer.

- [ ] **Step 1: Run identity, docs, links, Rust, WASM, TypeScript, build, Pages, Chromium, WebKit, package, and JSR checks**
- [ ] **Step 2: Confirm no `@ffmpeg/core` dependency or packed file**
- [ ] **Step 3: Inspect the final diff for runtime/API changes**
- [ ] **Step 4: Leave the PR unmerged and report the transfer instructions**
