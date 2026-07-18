import {
  decodeInputPair,
  type AudioDecodeBackend,
  type DecodedInputPair,
} from "./decode";
import { ConvolveError } from "./errors";
import {
  browserMemoryBudget,
  estimateFullPipelineMemory,
  millisecondsToFrames,
  type MemoryBudget,
} from "./memory-plan";
import { normalizeOptions, type NormalizedConvolveOptions } from "./options";
import type { ConvolveOptions, ConvolveResult } from "./types";

export interface ConvolverWorkerClient {
  process(
    decoded: DecodedInputPair,
    appendReverse: boolean,
    options: NormalizedConvolveOptions,
  ): Promise<ConvolveResult>;
}

export interface ConvolverDependencies {
  getDecodeBackend(): AudioDecodeBackend;
  getMemoryBudget?(): MemoryBudget;
  workerClient: ConvolverWorkerClient;
}

function isFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export function validateAudioInputObject(
  audio: unknown,
): asserts audio is { a: File; b: File } {
  if (
    typeof audio !== "object" ||
    audio === null ||
    !("a" in audio) ||
    !("b" in audio) ||
    !isFile(audio.a) ||
    !isFile(audio.b)
  ) {
    throw new ConvolveError(
      "INVALID_INPUT",
      "audio must contain File values named a and b",
    );
  }
}

export function createConvolver(dependencies: ConvolverDependencies) {
  let renderQueue: Promise<void> = Promise.resolve();

  async function convolveOnce(
    audio: { a: File; b: File },
    appendReverse: boolean,
    normalized: NormalizedConvolveOptions,
  ): Promise<ConvolveResult> {
    const decoded = await decodeInputPair(
      audio,
      dependencies.getDecodeBackend(),
      normalized.onProgress,
    );
    const reverseCrossfadeFrames = millisecondsToFrames(
      normalized.reverseCrossfadeMs,
    );
    const memoryPlan = estimateFullPipelineMemory({
      aFrames: decoded.a.frames,
      bFrames: decoded.b.frames,
      encodedInputBytes: audio.a.size + audio.b.size,
      appendReverse,
      reverseCrossfadeFrames,
      beatPan: normalized.beatPan !== null,
    });
    const memoryBudget =
      dependencies.getMemoryBudget?.() ?? browserMemoryBudget();
    if (memoryPlan.estimatedBytes > memoryBudget.budgetBytes) {
      throw new ConvolveError(
        "INPUT_TOO_LARGE",
        `Estimated peak memory ${memoryPlan.estimatedBytes} bytes exceeds this device's safe limit of ${memoryBudget.budgetBytes} bytes`,
        {
          estimatedBytes: memoryPlan.estimatedBytes,
          limitBytes: memoryBudget.budgetBytes,
          aFrames: decoded.a.frames,
          bFrames: decoded.b.frames,
          outputFrames: memoryPlan.outputFrames,
          finalFrames: memoryPlan.finalFrames,
          fftFrames: memoryPlan.fftFrames,
          appendReverse,
          reverseCrossfadeFrames,
          beatPan: normalized.beatPan,
          deviceMemoryGiB: memoryBudget.deviceMemoryGiB,
        },
      );
    }
    return dependencies.workerClient.process(
      decoded,
      appendReverse,
      normalized,
    );
  }

  return async function convolve(
    audio: { a: File; b: File },
    appendReverse = false,
    options: ConvolveOptions = {},
  ): Promise<ConvolveResult> {
    validateAudioInputObject(audio);
    if (typeof appendReverse !== "boolean") {
      throw new ConvolveError(
        "INVALID_INPUT",
        "appendReverse must be a boolean",
        { appendReverse },
      );
    }

    const normalized = normalizeOptions(options);
    const submittedAudio = {
      a: audio.a,
      b: audio.b,
    };
    const result = renderQueue.then(() =>
      convolveOnce(submittedAudio, appendReverse, normalized),
    );
    renderQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
