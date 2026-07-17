# Takana Labs and JSR Migration Design

## Goal

Make `takana-labs/convolve-wasm`, `@takana-labs/convolve-wasm`, and `https://convolve-wasm.app/` the canonical stable identity without changing the public `CONVOLVE` API, DSP semantics, browser architecture, or output contract.

## Repository transfer model

The migration is prepared on `chore/takana-labs-jsr-migration` while the repository is still `agunal/convolve-wasm`. The owner transfers the repository without renaming it. Git history, branches, pull requests, issues, and workflow files therefore move together. The migration branch must not merge until the transfer and organization app authorization are complete.

## Package identity

The publishable workspace becomes `@takana-labs/convolve-wasm`. The private demo workspace becomes `@takana-labs/convolve-demo`. Active manifests, imports, package-consumer tests, documentation, GitHub links, raw asset URLs, and release checks use the organization identity. Historical implementation plans may retain old references when needed to describe prior state.

The package homepage becomes `https://convolve-wasm.app/`. The repository and issue tracker become `https://github.com/takana-labs/convolve-wasm` and its `/issues` path.

## JSR packaging

JSR is the canonical registry. `packages/convolve-wasm/jsr.json` exports the already-built `dist/index.js` entrypoint and explicitly includes `dist/**`, `README.md`, and a package-local `LICENSE`. Publishing the built output preserves the existing Vite transformation that resolves the dedicated module worker and WebAssembly asset URLs.

The npm `publishConfig` and bootstrap-token workflow are removed. npm remains the workspace package manager and build tool; `npm pack --dry-run` may remain as a local artifact inspection check, but no workflow publishes to the npm registry.

## Release pipeline

The candidate workflow continues to verify an exact current-`main` commit, full Rust/WASM/TypeScript/browser tests, manual browser support evidence, package identity, JSR dry-run output, and absence of `@ffmpeg/core`. It uploads an inspected JSR package directory plus checksums and metadata.

The publish workflow is renamed to `publish-jsr.yml`. It requires the approved source commit, successful candidate run ID, and approved artifact hash. It downloads and verifies the inspected package, confirms the `v0.1.0` tag points to the approved source commit, then publishes through JSR OIDC with `id-token: write`. No registry token is stored.

## Website and Pages

The repository keeps the `/convolve-wasm/` GitHub Pages build base so the temporary organization Pages URL remains testable after transfer. Public canonical and Open Graph URLs use `https://convolve-wasm.app/`. Repository and documentation links use `takana-labs`.

The owner separately verifies the domain, configures DNS, attaches the custom domain in GitHub Pages, and enables HTTPS. Repository code must not assume those UI actions have already completed.

## Validation

A project identity validator checks canonical manifests, JSR configuration, release workflow names, required package files, and selected active files for legacy owner, package, Pages, npm-token, or npm-publish strings.

CI runs the identity validator before expensive compilation, then performs the existing full matrix and a JSR dry run after building the package. Package-consumer and browser tests continue to prove worker and WASM asset resolution.

## Non-goals

- No DSP or Rust changes.
- No public API changes.
- No creation of a separate experimental repository.
- No npm publication.
- No domain or JSR settings changes through repository code.
- No merge, tag, GitHub Release, or registry publication during migration preparation.
