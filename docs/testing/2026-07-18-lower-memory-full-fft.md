# v0.1.2 lower-memory full-FFT Android evidence

## Status

**Physical Android status:** Not run

This is the required physical-device template for the v0.1.2 candidate. It must remain `Not run`, `Failed`, or `Pass`; release workflows admit only an exact `Pass` here **and** in the immutable v0.1.1 record. Do not commit the private audio or output files.

## Private input identity and planning result

| Input | SHA-256 | v0.1.2 estimate | 4 GB browser budget | Required outcome |
|---|---|---:|---:|---|
| Supplied WAV | `B72090BD221ECCC2AF1A59206C40BC279E0790CD2AFBD7C163409C4CF8A28FC9` (`B72090…FC9`) | 235,793,987 bytes (224.87 MiB), plain | 201,326,592 bytes (192 MiB) | readable pre-worker `INPUT_TOO_LARGE` |
| Supplied M4A | `33A2AD19C95CDA18E59CD7D2745A138BA91B011ECC0606A30F4C22B0CE684059` (`33A2AD…059`) | 250,835,531 bytes (239.22 MiB), reverse plus beat-pan | 201,326,592 bytes (192 MiB) | readable pre-worker `INPUT_TOO_LARGE` |

These corrected streaming estimates use `E + 3D + F + X + W + 2C + 32 MiB`, with the 68-byte WAVE_FORMAT_EXTENSIBLE header and two 393,216-byte PCM24 chunks. The pair must not be used to bypass the browser budget: on a reported 4 GB device both cases are expected to reject safely. Record actual decoded frame counts and error details below.

## Required device record

- Device model and physical RAM: `Not run`
- Android version/build: `Not run`
- Chrome stable version: `Not run`
- Reported `navigator.deviceMemory`: `Not run`
- App/package commit and options: `Not run`
- Resolved behavior/engine: `Not run` (v0.1.2 full FFT only; no processing-mode selector)
- Runtime, output frames, and metadata or structured error: `Not run`
- Playback and download verification: `Not run`
- Page survival, worker state, and console errors: `Not run`

## Required runs before marking Pass

1. On a documented physical 4 GB Android Chrome device, run the two private identities above with the exact options. Record their structured rejection details, including estimated bytes, budget, decoded/output/FFT frames, reverse and beat-pan state, reported device-memory class, runtime, and the fact that the page did not reload.
2. Run a public deterministic multi-chunk fixture that produces more than 65,536 stereo PCM24 frames. Record options, runtime, frame count, peak metadata, WAV playback, download, worker health, and a clean console.
3. Exercise plain, reverse, and beat-pan requests. Beat modes may return the existing `BEAT_DETECTION_FAILED` only when no confident grid exists; otherwise record the successful metadata.
4. Keep the exact audio private. Commit only hashes, device/browser facts, options, measurements, and outcomes.

`Pass` means the private pair behaved safely, the public multi-chunk fixture completed and played/downloaded, and no page reload, worker failure, or console error occurred. Official Android support remains blocked until this record and the v0.1.1 physical Android record both say Pass.