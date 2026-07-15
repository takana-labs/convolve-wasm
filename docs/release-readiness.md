# v0.1.0 final release readiness

**Status:** Draft final release candidate. The package metadata is prepared on `release/v0.1.0-final`, but merge, tagging, GitHub release creation, and npm publication remain prohibited until every blocker and authorization gate below is satisfied.

**Merged readiness baseline:** `main` at `60e79cf38174fc0d90df47cbee5f21d274821a43`.

**Final release branch:** `release/v0.1.0-final`.

The manual desktop HE-AAC matrix is not available in the current execution environment and remains a hard release blocker. No blank row or automated WebKit result may be converted into a manual pass.

## Approved owner decisions

The owner instructed the final release phase to proceed on 2026-07-14. That instruction approves preparation of the following choices in a draft final release pull request; it does not authorize merge, tag creation, GitHub release creation, or npm publication.

| Decision | Approved v0.1.0 choice | Implementation state |
|---|---|---|
| Public version | `0.1.0` | Prepared on final release branch |
| Package visibility | Remove `private: true` | Prepared on final release branch |
| npm access | Public scoped package | Enforced with `publishConfig.access: "public"` |
| Provenance | Required | Enforced with `publishConfig.provenance: true` and npm trusted publishing |
| Registry authentication | GitHub Actions trusted publishing with OIDC; no long-lived publish token | Manual workflows added; registry-side trust still must be configured |
| Package description | `Browser-side stereo audio convolution powered by a Rust/WebAssembly DSP core.` | Prepared |
| Repository metadata | `agunal/convolve-wasm`, package directory `packages/convolve-wasm` | Prepared |
| Support metadata | GitHub issues and repository README | Prepared |
| Package-level Node engines | Omit because the published runtime is browser-based | Prepared |
| Tag name | `v0.1.0` | Approved name only; tag does not exist yet |
| Release notes | `docs/releases/v0.1.0.md` | Drafted |
| Generated WASM | Keep source-tree wasm-bindgen output ignored; publish built `dist` assets only | Preserved |
| FFmpeg boundary | Keep `@ffmpeg/core` absent | Preserved and explicitly checked |

## Current evidence

- Pull request #1 merged the implementation at `a088b5bf57aa3f256da79de86a0de2d21a265684`.
- Pull request #6 merged the release-readiness documentation at `60e79cf38174fc0d90df47cbee5f21d274821a43`.
- The implementation and readiness pull requests passed Rust formatting, Clippy, native tests, WASM builds, Chrome WASM smoke tests, TypeScript/package-consumer tests, library/demo builds, Chromium and WebKit E2E, package inspection, and the `@ffmpeg/core` absence gate.
- The package-consumer test creates a real npm tarball, installs it in a clean consumer, and proves that local worker and standalone WASM assets bundle correctly.
- The final release branch changes release metadata and control documentation only; it does not change DSP behavior or the public `CONVOLVE()` contract.
- The desktop Chrome, Edge, and Safari HE-AAC matrix is still incomplete.

## Manual HE-AAC blocker

Run the matrix in `docs/browser-support.md` with a known stereo 48 kHz HE-AAC `.m4a` and a WAV impulse on current desktop Chrome, Edge, and Safari.

For every browser, record:

- exact browser and operating-system versions;
- exact AAC profile or object type and the named inspection tool used;
- passing plain convolution;
- passing `beatPan: "a"` with reverse append;
- successful playback and download of both outputs;
- stereo 48 kHz PCM24 metadata;
- expected output-frame formulas;
- finite, non-silent peak metadata;
- no clipping and no page errors.

The current environment has neither the private HE-AAC fixture nor genuine desktop Chrome, Edge, and Safari coverage. The matrix therefore remains `Not run`. Do not merge the final release pull request until the table contains real evidence for all three browsers.

## Trusted publishing setup

The repository contains two manual workflows:

- `.github/workflows/release-candidate.yml` verifies the exact merged source commit, requires a complete browser matrix, runs the full clean-room test suite, packs once, inspects the `.tgz`, records `SHA256SUMS`, and uploads the exact artifact.
- `.github/workflows/publish.yml` requires a successful candidate workflow run, the exact source commit, and the approved tarball SHA-256. It downloads that artifact, verifies the `v0.1.0` tag points to the exact commit, verifies the tarball again, and publishes that same `.tgz` without rebuilding or repacking.

Before publication, configure npm trusted publishing with these exact values:

```text
Provider:           GitHub Actions
Organization/user:  agunal
Repository:         convolve-wasm
Workflow filename:  publish.yml
Environment:        npm
Allowed action:     npm publish
```

Also configure a protected GitHub environment named `npm` with an owner-controlled approval gate.

The publish workflow uses a GitHub-hosted runner, Node 24, npm 11.5.1, `id-token: write`, and an exact repository URL in `package.json`. No `NODE_AUTH_TOKEN` or long-lived npm publish secret is used.

Before final authorization, verify that npm permits the trusted-publisher configuration for `@agunal/convolve-wasm`. If registry setup cannot be completed before the first publication, stop. Do not silently fall back to a token. Any one-time bootstrap publication path requires a separate owner decision and a new review of credentials, provenance, artifact identity, and cleanup.

## Final release pull request gate

The draft final release pull request may contain:

- removal of `private: true`;
- approved package metadata and `publishConfig`;
- release notes;
- the candidate and publish workflows;
- the completed manual browser evidence.

It must not merge while any of these are true:

- a Chrome, Edge, or Safari matrix row remains blank or `Not run`;
- current-head CI is not green;
- npm trusted-publisher and GitHub environment setup have not been verified;
- the diff contains DSP, worker, public API, generated WASM, private audio, or unrelated changes;
- the owner has not explicitly approved merging the final release candidate.

## Exact-artifact candidate workflow

After the final release pull request merges, run **Build Release Candidate** with the exact resulting commit SHA.

The workflow must:

1. check out that exact commit;
2. verify a clean tree and completed manual browser matrix;
3. validate the publishable manifest;
4. run Rust format, Clippy, native tests, WASM build, TypeScript/package-consumer tests, library/demo build, Chrome WASM tests, and Chromium/WebKit E2E;
5. run `npm pack` exactly once;
6. inspect packed filenames and extracted contents;
7. prove `@ffmpeg/core` is absent from both the dependency tree and artifact;
8. create `pack.json`, `CONTENTS.txt`, `RELEASE-METADATA.txt`, and `SHA256SUMS`;
9. upload the exact `.tgz` and evidence as the `npm-release-candidate` artifact.

Record:

```text
source commit:
candidate workflow run ID:
tarball filename:
package name/version:
packed size:
unpacked size:
file count:
SHA-256:
inspector:
inspection date:
```

## Final authorization gate

After the candidate artifact exists, obtain a separate explicit authorization that names:

- exact source commit;
- candidate workflow run ID;
- tarball filename;
- exact lowercase SHA-256;
- approved tag `v0.1.0`;
- approval to publish to npm;
- approval or refusal to create the GitHub release.

No earlier `DO`, merge approval, release-decision approval, or general instruction substitutes for this artifact-specific authorization.

## Tag and publication sequence

1. Complete and record the Chrome, Edge, and Safari HE-AAC matrix.
2. Verify the draft final release pull request and current-head CI.
3. Verify npm trusted publishing and the protected `npm` GitHub environment.
4. Obtain explicit approval to merge the final release pull request.
5. Merge it through the approved method.
6. Run **Build Release Candidate** against the exact resulting commit.
7. Review the uploaded `.tgz`, contents, metadata, and SHA-256.
8. Obtain artifact-specific final authorization.
9. Create `v0.1.0` on that exact commit.
10. Run **Publish Inspected npm Artifact** with the exact commit, candidate run ID, and SHA-256.
11. Confirm npm shows version `0.1.0` and provenance.
12. Create the GitHub release only if separately authorized.
13. Stop immediately if the commit, tag, workflow run, tarball, SHA-256, browser matrix, or registry configuration does not match.

Until all applicable steps complete, the repository is release-prepared but not release-authorized.
