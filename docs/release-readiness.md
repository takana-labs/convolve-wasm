# v0.1.0 release readiness

**Status:** Draft release gate; not approved for tagging or publication.

**Verified baseline:** `main` at `a088b5bf57aa3f256da79de86a0de2d21a265684` on 2026-07-14.

This document makes the remaining release decisions and evidence requirements explicit. It does not authorize removal of `private: true`, creation of a tag or GitHub release, or publication to npm.

## Current evidence

- Pull request #1 is merged and closed at the verified baseline commit.
- GitHub Actions run `29374482569` completed successfully for the integrated implementation.
- The run passed Rust formatting, linting and tests; the WASM build and Chromium smoke tests; TypeScript/package tests; the library and demo build; Chromium and WebKit E2E; package inspection; and the `@ffmpeg/core` absence check.
- The package-consumer test creates an actual temporary npm tarball, confirms the package README and license are present, installs the tarball into a clean consumer, and verifies that the consumer build emits local worker and WASM assets.
- `packages/convolve-wasm/package.json` remains version `0.1.0` with `"private": true`.
- The manual desktop HE-AAC matrix is not complete and remains a release blocker.

Automated evidence is not a substitute for the manual M4A matrix. See [browser and codec support](browser-support.md) for the local-container record, GitHub Actions record, and the uncompleted Chrome/Edge/Safari table.

## Release decision record

The following defaults are recommendations for the first public release. Each owner decision must be approved explicitly before the corresponding repository or registry action is taken.

| Decision | Recommended v0.1.0 choice | Current state |
|---|---|---|
| Public version | Keep `0.1.0` as the first public version | Owner approval required |
| Package visibility | Remove `private: true` only in the final, reviewed release change | Intentionally unchanged in this draft |
| npm access | Publish `@agunal/convolve-wasm` as a public scoped package | Owner approval required |
| Provenance | Require verifiable registry provenance for the published artifact | Publishing workflow/auth method still to be approved |
| Registry authentication | Use an owner-controlled, least-privilege publication path | Not configured or exercised in this draft |
| Tag name | `v0.1.0` | Owner approval required; do not create yet |
| GitHub release | First-public-release notes tied to the approved tag | Not drafted or created yet |
| Generated WASM | Keep `packages/convolve-wasm/src/wasm/` ignored; publish only built distribution assets | Confirmed project boundary |
| FFmpeg boundary | Keep `@ffmpeg/core` absent | Confirmed project boundary |

Approval checklist:

- [ ] Confirm that `0.1.0` is the intended first public version.
- [ ] Confirm public npm access for the scoped package.
- [ ] Approve the provenance and registry-authentication method.
- [ ] Approve removal of `private: true` in a final release change.
- [ ] Approve tag name `v0.1.0` and the release-note text.
- [ ] Authorize tagging and npm publication only after every gate below passes.

## Manual HE-AAC blocker

Run the matrix in `docs/browser-support.md` with a known stereo 48 kHz HE-AAC `.m4a` and a WAV impulse on current desktop Chrome, Edge, and Safari.

Release acceptance requires, for every browser:

- exact browser and operating-system versions;
- exact M4A codec/profile identification;
- passing plain convolution;
- passing `beatPan: "a"` with reverse append;
- successful playback and download of both outputs;
- stereo 48 kHz PCM24 metadata;
- expected output-frame formulas;
- finite, non-silent peak metadata;
- no clipping and no page errors.

Do not convert a blank row, a Playwright WebKit result, or an assumed native-codec capability into a manual pass.

## Final packed-tarball inspection

The existing package-consumer test proves that an implementation tarball can be installed and bundled. The final release candidate still needs a recorded inspection after the approved manifest changes, because changing version, visibility, access, or publication metadata changes the artifact being released.

Run from a clean checkout of the exact release candidate:

```bash
rm -rf .release-pack
mkdir .release-pack

npm ci
npm run build:wasm
npm run build -w @agunal/convolve-wasm
npm pack --json --pack-destination .release-pack -w @agunal/convolve-wasm \
  > .release-pack/pack.json

cat .release-pack/pack.json
tar -tzf .release-pack/*.tgz | LC_ALL=C sort
sha256sum .release-pack/*.tgz
npm ls @ffmpeg/core
```

Record all of the following in the release PR or release issue:

```text
source commit:
tarball filename:
package name/version:
packed size:
unpacked size:
file count:
SHA-256:
inspector:
inspection date:
```

Acceptance criteria:

- package name, version, access policy, and provenance policy match the approved decisions;
- `private: true` is absent from the final publishable manifest;
- `package.json`, `README.md`, `LICENSE`, the root JavaScript entry, declarations, the module-worker asset, and the standalone WASM asset are present;
- source files, tests, demo files, repository-only documentation, private audio, and bootstrap transport artifacts are absent;
- `packages/convolve-wasm/src/wasm/` remains untracked in the repository;
- the packed tarball still passes the clean package-consumer build;
- `@ffmpeg/core` is absent from the dependency tree and packed contents;
- the recorded SHA-256 corresponds to the exact artifact approved for publication.

`npm ls @ffmpeg/core` may exit nonzero when the dependency is correctly absent. Inspect both its exit status and output rather than treating that nonzero result as a release failure by itself.

## Clean-room release verification

Run these gates from a fresh checkout of the exact release candidate:

```bash
git status --short
git rev-parse HEAD
node --version
npm --version
rustc --version
cargo --version
wasm-pack --version

npm ci
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npm run build:wasm
npm run test:ts
npm run build
npx playwright install --with-deps chromium webkit
wasm-pack test --headless --chrome crates/convolve-core
npm run test:e2e
npm pack -w @agunal/convolve-wasm --dry-run
npm ls @ffmpeg/core
git diff --check
git status --short
```

Expected outcome:

- every validation command succeeds, except that the intentional `npm ls @ffmpeg/core` absence may produce a nonzero exit status;
- the working tree is clean after generated ignored artifacts are removed or ignored as designed;
- the actual tarball inspection above is complete and recorded;
- no private audio, generated source-tree WASM, or transport artifact is committed.

## Release sequence and stop points

1. Complete and record the manual HE-AAC matrix.
2. Obtain explicit owner approval for version, npm access, provenance/authentication, visibility, tag name, and release notes.
3. Make the minimal final release metadata change, including removal of `private: true`, only after that approval.
4. Run the full clean-room gates on the exact release candidate.
5. Create and inspect the actual tarball; record its complete metadata and SHA-256.
6. Review and merge the release-readiness change through normal pull-request review.
7. Obtain a separate explicit authorization to tag, create a GitHub release, or publish to npm.
8. Stop immediately if the source commit, packed artifact, manual matrix, or approved decisions no longer match.

Until steps 1 through 7 are satisfied, the repository is release-prepared but not release-authorized.
