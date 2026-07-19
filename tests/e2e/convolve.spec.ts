import { createHash } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  CLICK_TRACK_FRAMES,
  IMPULSE_RESPONSE_FRAMES,
  SOURCE_A_FRAMES,
  makeClickTrackWav,
  makeImpulseResponseWav,
  makeSourceAWav,
  readWavHeader,
} from "./fixtures";

const BROWSER_WAV_SHA256 = {
  chromium: {
    plain: "58e72d8bb4e6585e26542dd164b44b7de7f2292973a4b9e4cfe5241df1facbc1",
    reverse: "60c2feda7455b07bb6be150e009823056f415c8d19cbb44dbf4ed73451fe5b85",
    beatPan: "8fced8928a444d6776a3962cdc63a4e406070ce43d12dc5c193af0b845fdb19d",
  },
  webkit: {
    plain: "301846c1872c07cf8dbc71d62d524cd2a9c7aa3d9aab921ff8c475702b707a3c",
    reverse: "85ba256457e2ec737e0418f31fdcd5347a8d92d1acc1b2b81d556fbd786b8074",
    beatPan: "c393693260a14edf78536cb0535a439cd9a57c59f0520f2bc5270f2f58b06162",
  },
} as const;

type GoldenMode = keyof (typeof BROWSER_WAV_SHA256)["chromium"];

function expectedBrowserHash(browserName: string, mode: GoldenMode): string {
  if (browserName !== "chromium" && browserName !== "webkit") {
    throw new Error(`No browser WAV golden is defined for ${browserName}`);
  }
  return BROWSER_WAV_SHA256[browserName][mode];
}

function sha256(output: Uint8Array): string {
  return createHash("sha256").update(output).digest("hex");
}

interface BrowserFailures {
  pageErrors: string[];
  consoleErrors: string[];
}

function watchFailures(page: Page): BrowserFailures {
  const failures: BrowserFailures = { pageErrors: [], consoleErrors: [] };
  page.on("pageerror", (error) => failures.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.consoleErrors.push(message.text());
  });
  return failures;
}

async function setAudioFiles(page: Page, a: Buffer, b: Buffer): Promise<void> {
  await page.locator("#audio-a").setInputFiles({
    name: "a.wav",
    mimeType: "audio/wav",
    buffer: a,
  });
  await page.locator("#audio-b").setInputFiles({
    name: "b.wav",
    mimeType: "audio/wav",
    buffer: b,
  });
}

async function runAndReadOutput(page: Page): Promise<Uint8Array> {
  await page.locator("#run").click();
  const status = page.locator("#status");
  await expect(status).toHaveAttribute("data-state", "done", {
    timeout: 90_000,
  });
  await expect(page.locator("#preview")).toHaveAttribute("src", /^blob:/);
  await expect
    .poll(() =>
      page.locator("#preview").evaluate((audio: HTMLAudioElement) => audio.readyState),
    )
    .toBeGreaterThanOrEqual(1);
  await expect(page.locator("#download")).toHaveAttribute("href", /^blob:/);
  await expect(page.locator("#download")).toHaveAttribute("download", /\.wav$/);
  const output = await page
    .locator("#download")
    .evaluate(async (link: HTMLAnchorElement) =>
      Array.from(new Uint8Array(await (await fetch(link.href)).arrayBuffer())),
    );
  return Uint8Array.from(output);
}

function expectPcm24WavLayout(output: Uint8Array, expectedFrames: number): void {
  const header = readWavHeader(output);
  expect(header.isPcm).toBe(true);
  expect(header.audioFormat).toBe(0xfffe);
  expect(header.channels).toBe(2);
  expect(header.sampleRate).toBe(48_000);
  expect(header.bitsPerSample).toBe(24);
  expect(header.frames).toBe(expectedFrames);
  expect(header.dataBytes).toBe(expectedFrames * 6);
  expect(output.byteLength).toBe(68 + header.dataBytes);
}

function expectNoBrowserFailures(failures: BrowserFailures): void {
  expect(failures.pageErrors).toEqual([]);
  expect(failures.consoleErrors).toEqual([]);
}

test("creates a playable PCM24 WAV with the full convolution length", async ({
  browserName,
  page,
}) => {
  const failures = watchFailures(page);
  await page.goto("/");
  await setAudioFiles(page, makeSourceAWav(), makeImpulseResponseWav());

  const output = await runAndReadOutput(page);
  expectPcm24WavLayout(
    output,
    SOURCE_A_FRAMES + IMPULSE_RESPONSE_FRAMES - 1,
  );
  expect(sha256(output)).toBe(expectedBrowserHash(browserName, "plain"));
  expectNoBrowserFailures(failures);
});

test("appends an exact reverse using the default five-millisecond overlap", async ({
  browserName,
  page,
}) => {
  const failures = watchFailures(page);
  await page.goto("/");
  await setAudioFiles(page, makeSourceAWav(), makeImpulseResponseWav());
  await page.locator("#append-reverse").check();

  const output = await runAndReadOutput(page);
  const forwardFrames = SOURCE_A_FRAMES + IMPULSE_RESPONSE_FRAMES - 1;
  expectPcm24WavLayout(output, 2 * forwardFrames - 240);
  expect(sha256(output)).toBe(expectedBrowserHash(browserName, "reverse"));
  expectNoBrowserFailures(failures);
});

test("reports detected beats for a 120 BPM click track", async ({
  browserName,
  page,
}) => {
  const failures = watchFailures(page);
  await page.goto("/");
  await setAudioFiles(page, makeClickTrackWav(), makeImpulseResponseWav());
  await page.locator("#beat-pan").selectOption("a");

  const output = await runAndReadOutput(page);
  const detectedBeats = Number(
    await page.locator("#status").getAttribute("data-detected-beats"),
  );
  expect(detectedBeats).toBeGreaterThan(0);
  const expectedFrames = CLICK_TRACK_FRAMES + IMPULSE_RESPONSE_FRAMES - 1;
  expect(expectedFrames).toBeGreaterThan(65_536);
  expectPcm24WavLayout(output, expectedFrames);
  expect(sha256(output)).toBe(expectedBrowserHash(browserName, "beatPan"));
  expectNoBrowserFailures(failures);
});

test("rejects risky mobile renders with actionable memory guidance", async ({
  page,
}) => {
  const failures = watchFailures(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "deviceMemory", {
      configurable: true,
      value: 1,
    });
  });
  await page.goto("/");
  const longAudio = makeClickTrackWav();
  await setAudioFiles(page, longAudio, longAudio);

  await page.locator("#run").click();
  const status = page.locator("#status");
  await expect(status).toHaveAttribute("data-state", "error");
  await expect(status).toContainText("INPUT_TOO_LARGE");
  await expect(status).toContainText(/needs about 86 MiB/i);
  await expect(status).toContainText(/64 MiB safe limit/i);
  await expect(status).toContainText(/shorter files/i);
  expectNoBrowserFailures(failures);
});
