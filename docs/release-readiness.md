# v0.1.2 release readiness

**Status:** Draft candidate. Do not tag, create a GitHub Release, or publish until explicit authorization and two physical Android evidence records both say `Pass`.

## Approved v0.1.2 identity

| Surface | Value |
|---|---|
| JSR package | `@takana-labs/convolve-wasm@0.1.2` |
| Release tag | `v0.1.2` |
| Candidate archive | `convolve-wasm-jsr-0.1.2.tgz` |
| Publication acknowledgement | `PUBLISH @takana-labs/convolve-wasm@0.1.2 TO JSR` |
| Generated WASM | Ignored in source; included only in built `dist` |
| Android state | Candidate only; official Android support blocked |

v0.1.2 preserves the public API and full-engine WAV bytes while replacing avoidable full-engine allocations with incremental panning, virtual reverse/layered normalization, exact-length convolution buffers, reused FFT scratch, and 68-byte-header PCM24 pull streaming.

## Fail-closed physical Android gate

Both workflows execute `node scripts/verify-android-release-gate.mjs`. It requires exactly one `**Physical Android status:** Pass` line in each record:

- [v0.1.1 mobile safe-rejection evidence](testing/2026-07-17-mobile-safe-rejection.md)
- [v0.1.2 lower-memory full-FFT evidence](testing/2026-07-18-lower-memory-full-fft.md)

`Not run`, `Failed`, missing, duplicated, or malformed status blocks candidate packaging, tag validation, and publication. The records currently remain `Not run`; publication is intentionally blocked. The v0.1.2 physical record requires a reported 4 GB Android Chrome device, the hash-only private pair safe-rejection results, and a successful public multi-chunk playback/download run with a surviving page and clean console.

## Candidate and publication checks

The candidate workflow validates Node 24, Rust/WASM, package/demo, generated-WASM Chrome, Chromium/WebKit, Pages, docs/identity/links, JSR dry run, and exact staged package contents. It archives the built package as `convolve-wasm-jsr-0.1.2.tgz` with a checksum and source/package metadata.

The publication workflow accepts only the exact tagged source commit and inspected candidate run/artifact, revalidates the evidence gate and package identity, requires the explicit v0.1.2 acknowledgement, and publishes the already-inspected directory through JSR OIDC. Tests use only dry-run/package inspection paths and never publish.

## Historical v0.1.0 migration notes
# v0.1.0 final release readiness

**Status:** Migration candidate only. Do not merge before the repository is transferred to `takana-labs/convolve-wasm` and the GitHub app is authorized for the organization. Do not tag, create a GitHub Release, or publish until exact-artifact authorization is given.

## Approved identity

| Surface | v0.1.0 value |
|---|---|
| Repository | `takana-labs/convolve-wasm` |
| JSR package | `@takana-labs/convolve-wasm@0.1.0` |
| Canonical site | <!-- site-url:start -->`https://convolve-wasm.app/`<!-- site-url:end --> |
| Registry authentication | GitHub Actions OIDC; no registry token |
| Release tag | `v0.1.0` |
| Generated WASM | Ignored in source; included only in built `dist` |
| FFmpeg boundary | `@ffmpeg/core` remains absent |

## Preserved release evidence

The branded Chrome, branded Edge, and system Safari HE-AAC matrix passed on 2026-07-15 against the unchanged production build. Exact fixture, browser, formula, playback/download, and hash evidence remains in [the hosted release-browser matrix report](testing/2026-07-15-hosted-release-browser-matrix.md).

The registry migration does not alter the public API, the DSP order, the exact 256 MiB memory boundary, worker/WASM architecture, or stereo 48 kHz signed PCM24 output.

## External owner actions before publication

1. Transfer the repository without renaming it.
2. Authorize the GitHub app and confirm organization Actions/Pages policy.
3. Verify and configure the canonical site above for GitHub Pages.
4. Link the reserved JSR package to `takana-labs/convolve-wasm`.
5. Create a protected GitHub environment named `jsr` with the desired reviewer policy.

## Candidate workflow

**Build JSR Release Candidate** accepts the exact current `main` SHA, runs the complete Rust/WASM/TypeScript/Chromium/WebKit/Pages matrix, validates the manual browser table, performs a JSR dry run, stages the exact package directory, and uploads a checksum-protected `jsr-release-candidate` artifact.

The candidate artifact contains:

```text
convolve-wasm-jsr-0.1.0.tgz
SHA256SUMS
CONTENTS.txt
JSR-DRY-RUN.txt
RELEASE-METADATA.txt
```

## Publication workflow

**Publish Inspected JSR Artifact** requires:

```text
source_commit:              exact tagged source SHA
artifact_run_id:            successful Build JSR Release Candidate run ID
artifact_sha256:            approved lowercase SHA-256
publish_acknowledgement:    PUBLISH @takana-labs/convolve-wasm@0.1.0 TO JSR
```

It verifies the tag, candidate run name/event/conclusion/head SHA, downloaded archive checksum, source metadata, package identity, JSR export, and absence of `@ffmpeg/core`. It publishes the already-inspected directory through JSR OIDC without rebuilding.

## Required sequence

1. Merge only after explicit authorization and green post-transfer CI.
2. Run **Build JSR Release Candidate** on the exact resulting `main` SHA.
3. Download and inspect the candidate archive, contents list, dry-run output, metadata, and SHA-256.
4. Obtain explicit authorization naming the exact SHA, run ID, filename, and hash.
5. Create `v0.1.0` on that exact SHA.
6. Run **Publish Inspected JSR Artifact** with the approved values.
7. Verify the immutable JSR version and a clean consumer installation.
8. Create a GitHub Release only after separate authorization.

Any mismatch in source commit, tag, workflow run, artifact hash, manifest, package contents, browser matrix, or acknowledgement voids the authorization and stops publication.

## Current prohibited actions

- Do not merge before the repository transfer and explicit merge authorization.
- Do not create `v0.1.0` before exact-artifact authorization.
- Do not create a GitHub Release without separate authorization.
- Do not run either release workflow against an unapproved commit.
- Do not publish any rebuilt or repacked artifact.
- Do not commit private HE-AAC audio, deterministic browser fixtures, output audio, or generated source-tree WASM.
