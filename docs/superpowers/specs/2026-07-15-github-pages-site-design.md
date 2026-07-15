# GitHub Pages App Site Design

**Repository:** `agunal/convolve-wasm`  
**Target URL:** `https://agunal.github.io/convolve-wasm/`  
**Status:** Approved design  
**Date:** 2026-07-15

## 1. Goal

Publish the existing browser demo as the repository's GitHub Pages site so visitors can use `convolve-wasm` without installing anything.

The deployed site must:

- open directly to the working audio convolution application;
- process audio entirely in the visitor's browser;
- support the existing WAV and browser-decodable M4A inputs;
- preserve the existing public API and DSP behavior;
- preview and download the generated stereo 48 kHz PCM24 WAV;
- work correctly from the repository subpath `/convolve-wasm/`;
- retain the canonical project logo and current visual language;
- deploy automatically from `main` through GitHub Actions.

The Pages work is independent of npm publication, GitHub releases, and release tagging.

## 2. User experience

The existing demo remains the primary page content rather than being moved behind a separate landing page.

Page order:

1. Branded hero with the canonical logo and a concise local-processing statement.
2. Existing Audio A and Audio B file selectors.
3. Existing processing controls:
   - beat-pan source;
   - pan transition;
   - reverse crossfade;
   - true-peak target;
   - append-reverse toggle.
4. Existing render action, progress/status output, audio preview, and WAV download.
5. New compact About section below the result panel.
6. Small privacy-focused footer.

The About section will explain:

- processing happens locally and files are not uploaded;
- the application uses browser decoding, a dedicated module worker, and Rust/WASM DSP;
- accepted inputs are WAV and browser-supported M4A;
- output is stereo 48 kHz signed PCM24 WAV;
- M4A codec availability depends on the browser and operating system;
- the project has no bundled `@ffmpeg/core` or server fallback.

It will include links to:

- the GitHub repository;
- package documentation;
- browser-support documentation;
- v0.1.0 release notes.

## 3. Visual design

The site will extend the current design rather than replace it.

Existing visual rules remain authoritative:

- warm neutral background;
- dark text and panels;
- orange accent color;
- serif display heading paired with system sans-serif body text;
- translucent rounded cards;
- responsive one-column layout on narrow screens;
- visible keyboard focus states.

The About section will reuse the existing panel/card primitives. The footer will be visually quiet and remain readable at mobile widths.

No new illustration or branding asset is required. The canonical logo already stored in the demo remains the site logo and favicon.

## 4. Build architecture

The Vite demo under `apps/demo` remains the deployable application.

### 4.1 Base path

The production Pages build must use:

```text
/convolve-wasm/
```

Local development, preview, and existing browser tests must continue to use `/` unless they explicitly exercise the Pages base path.

The Vite configuration will derive the base from an explicit build-time environment variable rather than hard-code Pages behavior for all builds. The Pages workflow will set the variable to `/convolve-wasm/`.

### 4.2 Static assets

Logo and favicon URLs must be base-aware. Root-absolute paths such as `/convolve-wasm-logo.png` are not acceptable for the deployed repository subpath.

The implementation may use Vite's base substitution or module asset URLs, but the resulting production HTML must reference assets beneath `/convolve-wasm/`.

### 4.3 Worker and WASM loading

The package build already emits the dedicated worker next to the package module and resolves it through `new URL(..., import.meta.url)`. This behavior must be preserved.

The Pages build must contain and load:

- the demo JavaScript bundle;
- `convolve.worker.js`;
- the wasm-bindgen JavaScript glue;
- `convolve_core_bg.wasm`;
- logo and other static assets.

No worker or WASM URL may resolve to the domain root. All must remain valid under the Pages subdirectory.

### 4.4 Output directory

The deployable artifact is:

```text
apps/demo/dist
```

The Pages workflow uploads exactly this directory after a clean build.

## 5. GitHub Actions deployment

Add `.github/workflows/pages.yml`.

Triggers:

- push to `main`;
- manual `workflow_dispatch`.

Permissions:

```yaml
contents: read
pages: write
id-token: write
```

Concurrency:

- one Pages deployment group;
- do not cancel a deployment already in progress;
- newer queued deployments supersede older queued work where supported by GitHub's standard Pages pattern.

The workflow will:

1. Check out the repository.
2. Set up Node `22.16.0` with npm caching.
3. Set up stable Rust with `wasm32-unknown-unknown`.
4. Install `wasm-pack 0.14.0`.
5. Run `npm ci`.
6. Run the existing WASM and package builds.
7. Build the demo with the Pages base path.
8. Run Pages-specific artifact validation.
9. Configure Pages.
10. Upload `apps/demo/dist` using the official Pages artifact action.
11. Deploy using the official Pages deployment action.

The deployment job will use the `github-pages` environment and publish its URL through the standard Pages deployment output.

## 6. Validation and tests

### 6.1 Existing verification

The existing CI workflow remains unchanged and must continue to pass:

- Rust formatting, linting, and native tests;
- WASM build and browser smoke tests;
- TypeScript/package tests;
- library and demo builds;
- Chromium and WebKit E2E;
- package inspection;
- `@ffmpeg/core` absence check.

### 6.2 Pages artifact validation

Add a deterministic validation script or test that builds the demo using `/convolve-wasm/` and asserts:

- `apps/demo/dist/index.html` exists;
- the logo asset exists in the output;
- a worker JavaScript artifact exists;
- the WASM binary exists;
- generated HTML and entry assets use the `/convolve-wasm/` prefix where appropriate;
- no production HTML reference starts with `/src/`;
- no required runtime asset is referenced from the domain root;
- the output contains no private audio fixture.

### 6.3 Browser smoke test

Run a lightweight browser smoke test against the built artifact served under a local `/convolve-wasm/` route.

The smoke test will verify:

- the page loads without console or page errors;
- the logo loads;
- both file inputs and the render button are present;
- the application JavaScript initializes;
- worker and WASM requests resolve successfully from the subpath.

It does not need to perform a long convolution because the production worker/WASM path is already covered by existing integration and release-browser evidence. A minimal fixture-backed initialization or existing small test fixture may be used if required to prove worker/WASM loading.

## 7. Documentation updates

Update the root README after the Pages URL is deployable:

```text
Use the app: https://agunal.github.io/convolve-wasm/
```

The README must continue to distinguish the hosted app from npm installation and local development.

No private audio fixture, generated release artifact, npm credential, or publication state is added to documentation or the repository.

## 8. Error handling and operational behavior

- A failed build or artifact validation must prevent deployment.
- A failed Pages deployment must not alter npm or release state.
- The site continues to surface existing stable `ConvolveError` codes in the UI.
- Unsupported M4A codec paths remain explicit browser decode failures; the site will not imply universal M4A support.
- GitHub Pages caching is acceptable because deployed asset filenames are content-hashed by Vite.
- The application remains static and requires no service worker, server function, analytics, cookies, or storage.

## 9. Security and privacy

- Audio files remain in the browser tab and are never transmitted by application code.
- The Pages workflow receives no npm token or release credential.
- The deployment workflow uses least-privilege GitHub permissions.
- No `SharedArrayBuffer`, COOP, or COEP requirement is introduced.
- No external analytics, telemetry, CDN script, or remote audio service is added.

## 10. Scope boundaries

Included:

- Pages-compatible demo build;
- functional site at the repository Pages URL;
- compact About/footer content;
- deployment workflow;
- subpath artifact validation and smoke testing;
- README app link.

Excluded:

- npm publication;
- GitHub release or tag creation;
- custom domain;
- separate documentation framework;
- server-side processing or file uploads;
- bundled FFmpeg;
- service worker or offline caching;
- new DSP options or public API changes;
- redesign of the existing application.

## 11. Acceptance criteria

The work is complete when:

1. A pull request from `feat/github-pages-site` contains only the approved Pages-site changes.
2. All existing CI checks pass.
3. The Pages-specific subpath build and smoke checks pass.
4. The built site loads from `/convolve-wasm/` with functioning logo, application bundle, worker, and WASM assets.
5. The application can still process files locally and expose preview/download behavior.
6. The About section and privacy footer are responsive and accessible.
7. The Pages deployment workflow is ready to deploy from `main` after merge.
8. No npm publication, release, or tag action occurs as part of this work.
