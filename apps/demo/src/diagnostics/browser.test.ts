import { describe, expect, it, vi } from "vitest";

import {
  createBrowserDiagnostics,
  type BrowserDiagnosticsDependencies,
} from "./browser";
import type { DiagnosticSnapshot } from "./recorder";

class FakeElement extends EventTarget {
  hidden = false;
  textContent: string | null = "";
}

class FakeAnchor extends FakeElement {
  href = "";
  download = "";
  click = vi.fn();
  remove = vi.fn();
}

function emptySnapshot(): DiagnosticSnapshot {
  return {
    storageState: "available",
    sessions: [],
    activeSessionId: null,
    recoveredSessionId: null,
  };
}

function fakeRecorder(
  snapshot: DiagnosticSnapshot = emptySnapshot(),
) {
  return {
    startSession: vi.fn(),
    checkpoint: vi.fn(),
    recordProgress: vi.fn(),
    finish: vi.fn(),
    recordIncident: vi.fn(),
    snapshot: vi.fn(() => snapshot),
    subscribe: vi.fn((listener: (value: DiagnosticSnapshot) => void) => {
      listener(snapshot);
      return vi.fn();
    }),
    exportJson: vi.fn(() => '{\n  "safe": true\n}\n'),
    clear: vi.fn(),
  };
}

function validAttempt() {
  return {
    inputs: [
      { slot: "a" as const, mimeType: "audio/wav", encodedBytes: 44 },
      { slot: "b" as const, mimeType: "audio/mp4", encodedBytes: 88 },
    ],
    options: {
      appendReverse: false,
      beatPan: null,
      panTransitionMs: 20,
      reverseCrossfadeMs: 5,
      targetDbtp: -1,
    },
  };
}

function browserDependencies(
  recorder = fakeRecorder(),
): BrowserDiagnosticsDependencies & {
  windowTarget: EventTarget;
  documentTarget: EventTarget & { visibilityState: DocumentVisibilityState };
  previewTarget: EventTarget & { error: unknown };
  anchor: FakeAnchor;
  ui: {
    storage: FakeElement;
    recovered: FakeElement;
    summary: FakeElement;
    download: FakeElement;
    copy: FakeElement;
    clear: FakeElement;
    failureDownload: FakeElement;
  };
} {
  const anchor = new FakeAnchor();
  const ui = {
    storage: new FakeElement(),
    recovered: new FakeElement(),
    summary: new FakeElement(),
    download: new FakeElement(),
    copy: new FakeElement(),
    clear: new FakeElement(),
    failureDownload: new FakeElement(),
  };
  return {
    recorder,
    windowTarget: new EventTarget(),
    documentTarget: Object.assign(new EventTarget(), {
      visibilityState: "visible" as DocumentVisibilityState,
    }),
    previewTarget: Object.assign(new EventTarget(), { error: null as unknown }),
    app: { version: "0.1.0", buildCommit: "test-build" },
    environment: {
      userAgent: "Test Browser",
      platform: "Test OS",
      deviceMemoryGiB: 4,
      hardwareConcurrency: 8,
      capabilities: {
        webAssembly: true,
        worker: true,
        offlineAudioContext: true,
        readableStream: true,
        responseBlob: true,
        randomUUID: true,
        localStorage: true,
        clipboard: true,
      },
    },
    clipboardWrite: vi.fn(async () => undefined),
    createJsonBlob: vi.fn(() => new Blob()),
    createObjectUrl: vi.fn(() => "blob:diagnostics"),
    revokeObjectUrl: vi.fn(),
    createDownloadAnchor: vi.fn(() => anchor),
    attachDownloadAnchor: vi.fn(),
    confirmClear: vi.fn(() => true),
    defer: vi.fn((task: () => void) => task()),
    ui,
    anchor,
  };
}

function allThrowingDependencies(): BrowserDiagnosticsDependencies {
  const throwing = () => {
    throw new Error("diagnostic dependency failed");
  };
  const recorder = fakeRecorder();
  recorder.startSession.mockImplementation(throwing);
  recorder.checkpoint.mockImplementation(throwing);
  recorder.recordProgress.mockImplementation(throwing);
  recorder.finish.mockImplementation(throwing);
  recorder.recordIncident.mockImplementation(throwing);
  recorder.snapshot.mockImplementation(throwing);
  recorder.subscribe.mockImplementation(throwing);
  recorder.exportJson.mockImplementation(throwing);
  recorder.clear.mockImplementation(throwing);
  const dependencies = browserDependencies(recorder);
  return {
    ...dependencies,
    clipboardWrite: vi.fn(async () => {
      throw new Error("clipboard failed");
    }),
    createJsonBlob: throwing,
    createObjectUrl: throwing,
    revokeObjectUrl: throwing,
    createDownloadAnchor: throwing,
    attachDownloadAnchor: throwing,
    confirmClear: throwing,
    defer: throwing,
  };
}

describe("browser diagnostics", () => {
  it.each([
    ["worker-error", "worker-error"],
    ["worker-messageerror", "worker-messageerror"],
    ["wasm-init-failure", "wasm-init-failure"],
  ] as const)(
    "maps %s package events to approved %s checkpoints",
    (eventType, checkpoint) => {
      const recorder = fakeRecorder();
      const diagnostics = createBrowserDiagnostics(
        browserDependencies(recorder),
      );

      diagnostics.handlePackageEvent({
        type: eventType,
        error: { message: "worker failed", unknownErrorSecret: "DROP" },
        unknownSecret: "DROP",
      });

      expect(recorder.checkpoint).toHaveBeenCalledWith(
        checkpoint,
        expect.not.objectContaining({ unknownSecret: expect.anything() }),
      );
      expect(JSON.stringify(recorder.checkpoint.mock.calls)).not.toContain(
        "unknownErrorSecret",
      );
    },
  );

  it("defers package request outcomes to the application completion boundary", () => {
    const recorder = fakeRecorder();
    const diagnostics = createBrowserDiagnostics(browserDependencies(recorder));

    diagnostics.handlePackageEvent({
      type: "request-success",
      outputFrames: 48_000,
      durationSeconds: 1,
    });
    diagnostics.handlePackageEvent({
      type: "request-failure",
      error: { message: "worker failed" },
    });

    expect(recorder.checkpoint).not.toHaveBeenCalled();
    expect(recorder.finish).not.toHaveBeenCalled();
  });

  it("defers worker cancellation cleanup to the application failure boundary", () => {
    const recorder = fakeRecorder();
    const diagnostics = createBrowserDiagnostics(browserDependencies(recorder));

    diagnostics.handlePackageEvent({ type: "worker-cancelled" });

    expect(recorder.finish).not.toHaveBeenCalled();

    diagnostics.finishFailure({ message: "render failed" });

    expect(recorder.finish).toHaveBeenCalledTimes(1);
    expect(recorder.finish).toHaveBeenCalledWith(
      "failed",
      "error",
      expect.objectContaining({ message: "render failed" }),
    );
  });

  it("captures window and promise errors without preventing defaults", () => {
    const recorder = fakeRecorder();
    const diagnostics = createBrowserDiagnostics(
      browserDependencies(recorder),
    );

    diagnostics.handleWindowError({
      message: "C:\\private\\secret.wav failed",
      lineno: 9,
      colno: 2,
      error: { stack: "DROP_STACK" },
    });
    diagnostics.handleUnhandledRejection({
      reason: { message: "/private/secret.wav", unknown: "DROP" },
    });

    expect(recorder.recordIncident).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(recorder.recordIncident.mock.calls)).not.toContain(
      "secret.wav",
    );
    expect(JSON.stringify(recorder.recordIncident.mock.calls)).not.toContain(
      "DROP_STACK",
    );
  });

  it("swallows recorder, clipboard, URL, and download failures", async () => {
    const diagnostics = createBrowserDiagnostics(allThrowingDependencies());

    expect(() => diagnostics.startAttempt(validAttempt())).not.toThrow();
    await expect(diagnostics.copy()).resolves.toBe(false);
    expect(() => diagnostics.download()).not.toThrow();
    expect(() => diagnostics.clear()).not.toThrow();
  });

  it("records page lifecycle events and keeps bfcache sessions active", () => {
    const recorder = fakeRecorder();
    const dependencies = browserDependencies(recorder);
    const diagnostics = createBrowserDiagnostics(dependencies);

    const cached = new Event("pagehide");
    Object.defineProperty(cached, "persisted", { value: true });
    dependencies.windowTarget.dispatchEvent(cached);
    expect(recorder.recordIncident).toHaveBeenLastCalledWith(
      "pagehide",
      { persisted: true },
    );
    expect(recorder.finish).not.toHaveBeenCalled();

    const closed = new Event("pagehide");
    Object.defineProperty(closed, "persisted", { value: false });
    dependencies.windowTarget.dispatchEvent(closed);
    expect(recorder.recordIncident).toHaveBeenLastCalledWith(
      "pagehide",
      { persisted: false },
    );
    expect(recorder.finish).toHaveBeenCalledWith(
      "clean-shutdown",
      "clean-shutdown",
    );

    diagnostics.dispose();
    dependencies.windowTarget.dispatchEvent(closed);
    expect(recorder.finish).toHaveBeenCalledTimes(1);
  });

  it("copies and downloads the same formatted recorder export", async () => {
    const recorder = fakeRecorder();
    const dependencies = browserDependencies(recorder);
    const diagnostics = createBrowserDiagnostics(dependencies);

    expect(await diagnostics.copy()).toBe(true);
    diagnostics.download();

    expect(dependencies.clipboardWrite).toHaveBeenCalledWith(
      '{\n  "safe": true\n}\n',
    );
    expect(dependencies.createJsonBlob).toHaveBeenCalledWith(
      '{\n  "safe": true\n}\n',
    );
    expect(recorder.exportJson).toHaveBeenCalledTimes(1);
    expect(dependencies.revokeObjectUrl).toHaveBeenCalledWith(
      "blob:diagnostics",
    );
  });

  it("refreshes the shared export after a recording mutation", async () => {
    const recorder = fakeRecorder();
    const dependencies = browserDependencies(recorder);
    const diagnostics = createBrowserDiagnostics(dependencies);

    await diagnostics.copy();
    recorder.exportJson.mockReturnValue('{"revision":2}\n');
    diagnostics.startAttempt(validAttempt());
    diagnostics.download();

    expect(recorder.exportJson).toHaveBeenCalledTimes(2);
    expect(dependencies.createJsonBlob).toHaveBeenLastCalledWith(
      '{"revision":2}\n',
    );
  });

  it("renders recovery, storage, summaries, clipboard support, and confirmed clear", () => {
    const recovered = {
      ...emptySnapshot(),
      storageState: "quota-exceeded" as const,
      recoveredSessionId: "recovered",
      sessions: [
        {
          schemaVersion: 1 as const,
          id: "recovered",
          startedAt: "2026-07-23T20:00:00.000Z",
          updatedAt: "2026-07-23T20:00:03.000Z",
          status: "unexpected-termination" as const,
          app: { version: "0.1.0", buildCommit: "test" },
          environment: null,
          checkpoints: [],
          droppedCheckpoints: 0,
        },
      ],
    };
    const recorder = fakeRecorder(recovered);
    const dependencies = browserDependencies(recorder);
    const diagnostics = createBrowserDiagnostics(dependencies);

    expect(dependencies.ui.storage.textContent).toMatch(/quota|current tab/i);
    expect(dependencies.ui.recovered.hidden).toBe(false);
    expect(dependencies.ui.summary.textContent).toContain(
      "unexpected-termination",
    );
    expect(dependencies.ui.copy.hidden).toBe(false);

    dependencies.ui.clear.dispatchEvent(new Event("click"));
    expect(dependencies.confirmClear).toHaveBeenCalledWith(
      "Clear all crash diagnostics stored by convolve-wasm on this device?",
    );
    expect(recorder.clear).toHaveBeenCalledOnce();
    diagnostics.showFailureAction(true);
    expect(dependencies.ui.failureDownload.hidden).toBe(false);
  });

  it("maps attempt, progress, metadata, and audio failures through fresh allowlists", () => {
    const recorder = fakeRecorder();
    const dependencies = browserDependencies(recorder);
    const diagnostics = createBrowserDiagnostics(dependencies);

    diagnostics.startAttempt(validAttempt());
    diagnostics.recordProgress({ stage: "decode-a", fraction: 0.1 });
    diagnostics.previewAssigned(1_024);
    diagnostics.finishSuccess({
      sampleRate: 48_000,
      channels: 2,
      durationSeconds: 1,
      outputFrames: 48_000,
      detectedBeats: 1,
      detectedBpm: 120,
      beatConfidence: 0.9,
      appliedGainDb: -2,
      estimatedTruePeakDbtp: -1,
    });

    expect(recorder.startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        app: { version: "0.1.0", buildCommit: "test-build" },
        inputs: validAttempt().inputs,
        options: validAttempt().options,
      }),
    );
    expect(recorder.recordProgress).toHaveBeenCalledWith({
      stage: "decode-a",
      fraction: 0.1,
    });
    expect(recorder.checkpoint).toHaveBeenCalledWith(
      "preview-assigned",
      { wavBytes: 1_024 },
    );
    expect(recorder.finish).toHaveBeenCalledWith(
      "succeeded",
      "success",
      expect.objectContaining({ outputFrames: 48_000 }),
    );

    dependencies.previewTarget.error = {
      code: 3,
      message: "C:\\private\\preview.wav",
      secret: "DROP",
    };
    dependencies.previewTarget.dispatchEvent(new Event("error"));
    expect(recorder.recordIncident).toHaveBeenCalledWith(
      "audio-error",
      expect.not.objectContaining({ secret: expect.anything() }),
    );
    expect(JSON.stringify(recorder.recordIncident.mock.calls)).not.toContain(
      "preview.wav",
    );
  });
});
