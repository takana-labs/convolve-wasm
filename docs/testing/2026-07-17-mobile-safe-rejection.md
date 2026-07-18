# v0.1.1 mobile safe-rejection evidence

## Scope

This record covers the v0.1.1 cross-layer memory preflight. It does not claim completion of the v0.1.2 lower-memory full engine or the v0.2.0 bounded engine.

The preflight runs after browser decode, when exact frame counts are known, and before worker creation. A rejected job keeps the page alive and reports estimated memory, the device-class safe limit, decoded/output frame counts, reverse state, and the reported device-memory class.

## Private input identity

The audio remains uncommitted. Only identity, size, decoded-frame, and planner evidence is recorded.

| Input | SHA-256 | Encoded bytes | Decoded frames |
|---|---|---:|---:|
| Supplied WAV | `B72090BD221ECCC2AF1A59206C40BC279E0790CD2AFBD7C163409C4CF8A28FC9` | 4,624,148 | 770,684 |
| Supplied M4A | `33A2AD19C95CDA18E59CD7D2745A138BA91B011ECC0606A30F4C22B0CE684059` | 893,355 | 1,736,481 |

For the pair:

- forward output: 2,507,164 frames;
- FFT size: 4,194,304 frames;
- plain v0.1.1 estimate: 300,193,927 bytes (about 286.3 MiB);
- reverse plus beat-pan estimate: 390,444,151 bytes (about 372.4 MiB);
- reported 4 GB device budget: 201,326,592 bytes (192 MiB).

Both planner cases therefore reject before worker creation on a reported 4 GB device. The reverse/beat case remains below an unknown-desktop browser budget of 384 MiB, but it is still subject to the independent Rust/WASM 256 MiB guard.

## Automated evidence

The focused unit coverage verifies:

- 64 MiB, 192 MiB, and 384 MiB budget derivation;
- exact plain and reverse/beat estimates for the private pair;
- saturating rejection on arithmetic overflow;
- rejection before worker creation;
- serialization of concurrent decode-plan-process lifecycles so admitted peaks cannot overlap;
- option-aware actionable MiB copy while preserving other error semantics;
- lifecycle command parsing, launch identity, full-build startup, occupied-port detection, bounded log tails, and confirmed teardown.

The repository E2E case overrides `navigator.deviceMemory` to 1 GB and uses deterministic eight-second WAV fixtures. It expects an error state containing `INPUT_TOO_LARGE`, about 105 MiB required, a 64 MiB safe limit, and shorter-file guidance, with no page or console errors.

## Environment limitation

The Codex Windows sandbox used for this implementation isolates detached localhost processes. The project lifecycle completed its full WASM/package/demo build and launched the owned hidden server, which logged readiness on `127.0.0.1:4173`; the lifecycle parent, Playwright, and the in-app browser all timed out crossing into that detached process. The failed readiness probe safely verified ownership, stopped the process, waited for port release, and removed its PID record. Browser E2E and a successful hidden-start readiness probe must still be rerun in a normal desktop terminal or CI environment.

No physical Android device was attached to this workspace. Therefore the required documented 4 GB Android result is not recorded here, and v0.1.1 remains a candidate rather than a completed mobile-support release.

## Physical Android gate

**Physical Android status:** Not run

Record all of the following on a current stable Chrome physical device before release review:

- device model, RAM, Android and Chrome versions;
- reported `navigator.deviceMemory`;
- exact options and resolved outcome;
- elapsed runtime, output frames, peak metadata, and error code;
- confirmation that the page did not reload and no worker or console error occurred.

For v0.1.1, the exact pair above must show a readable pre-worker rejection on a documented 4 GB Android phone. Later milestone gates replace this safe-rejection expectation with completion-or-rejection and then bounded completion as specified by their release plans.
