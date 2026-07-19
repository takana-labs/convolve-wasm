<p align="center">
  <img src="https://raw.githubusercontent.com/takana-labs/convolve-wasm/main/docs/assets/convolve-wasm-logo.png" alt="convolve-wasm logo" width="192" />
</p>

# @takana-labs/convolve-wasm

Browser-side stereo audio convolution backed by a Rust/WebAssembly DSP core and a dedicated module worker.

## Install from JSR

```bash
npx jsr add @takana-labs/convolve-wasm
```

```ts
import { CONVOLVE } from "@takana-labs/convolve-wasm";

const result = await CONVOLVE({ a: fileA, b: fileB });
const url = URL.createObjectURL(result.wav);
```

v0.1.2 retains device-aware, post-decode rejection before worker creation and reduces full-FFT peak memory with incremental beat panning, a virtual reverse view, exact-length convolution output, reused scratch, and pull-based PCM24 streaming. Unsafe work still rejects with `INPUT_TOO_LARGE` and byte/frame details; the independent 256 MiB Rust/WASM guard remains active. Android Chrome is a candidate target while both physical Android evidence gates remain pending; iOS is best effort.

The package includes its worker and WebAssembly assets. Consumers should import only from the package root; no CDN, upload service, or server-side audio processing is required.
