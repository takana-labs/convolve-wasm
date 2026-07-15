const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const fixtureDir = path.resolve(process.env.FIXTURE_DIR || 'release-browser-fixture');
const captureDir = path.resolve(process.env.CAPTURE_DIR || 'release-browser-results/windows');
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
fs.mkdirSync(captureDir, { recursive: true });

function fail(message) {
  throw new Error(message);
}

function parseWav(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF') fail(`${filePath}: missing RIFF`);
  if (bytes.subarray(8, 12).toString('ascii') !== 'WAVE') fail(`${filePath}: missing WAVE`);
  let offset = 12;
  let format;
  let data;
  while (offset + 8 <= bytes.length) {
    const id = bytes.subarray(offset, offset + 4).toString('ascii');
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ') {
      format = {
        audioFormat: bytes.readUInt16LE(start),
        channels: bytes.readUInt16LE(start + 2),
        sampleRate: bytes.readUInt32LE(start + 4),
        blockAlign: bytes.readUInt16LE(start + 12),
        bitsPerSample: bytes.readUInt16LE(start + 14),
      };
    } else if (id === 'data') {
      data = bytes.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }
  if (!format || !data) fail(`${filePath}: missing fmt or data chunk`);
  if (format.audioFormat !== 1) fail(`${filePath}: expected PCM format`);
  if (format.channels !== 2 || format.sampleRate !== 48000 || format.bitsPerSample !== 24) {
    fail(`${filePath}: unexpected format ${JSON.stringify(format)}`);
  }
  const frames = data.length / format.blockAlign;
  if (!Number.isInteger(frames)) fail(`${filePath}: partial frame`);
  let maxAbs = 0;
  let nonzero = 0;
  for (let index = 0; index < data.length; index += 3) {
    let value = data[index] | (data[index + 1] << 8) | (data[index + 2] << 16);
    if (value & 0x800000) value |= 0xff000000;
    const absolute = Math.abs(value);
    if (absolute > maxAbs) maxAbs = absolute;
    if (value !== 0) nonzero += 1;
  }
  if (nonzero === 0) fail(`${filePath}: silent output`);
  if (maxAbs >= 8388607) fail(`${filePath}: clipped PCM24 output (${maxAbs})`);
  return { ...format, frames, maxAbs, nonzero, bytes: bytes.length };
}

async function decodedFrames(page) {
  return page.evaluate(async () => {
    async function decode(selector) {
      const input = document.querySelector(selector);
      if (!input?.files?.[0]) throw new Error(`missing file for ${selector}`);
      const bytes = await input.files[0].arrayBuffer();
      const context = new OfflineAudioContext(2, 1, 48000);
      const decoded = await context.decodeAudioData(bytes.slice(0));
      return { frames: decoded.length, channels: decoded.numberOfChannels, sampleRate: decoded.sampleRate };
    }
    return { a: await decode('#audio-a'), b: await decode('#audio-b') };
  });
}

async function runMode(page, browserName, mode, expectedFrames) {
  const isReverse = mode === 'beatpan-reverse';
  await page.selectOption('#beat-pan', isReverse ? 'a' : '');
  await page.locator('#append-reverse').setChecked(isReverse);
  await page.click('#run');
  await page.waitForFunction(() => document.querySelector('#status')?.dataset.state === 'done', null, { timeout: 180000 });

  const state = await page.evaluate(async () => {
    const status = document.querySelector('#status');
    const audio = document.querySelector('#preview');
    const download = document.querySelector('#download');
    if (!status || !audio || !download) throw new Error('missing result elements');
    await new Promise((resolve, reject) => {
      if (audio.readyState >= 2) return resolve();
      const timer = setTimeout(() => reject(new Error('audio did not become playable')), 30000);
      audio.addEventListener('loadeddata', () => { clearTimeout(timer); resolve(); }, { once: true });
      audio.addEventListener('error', () => { clearTimeout(timer); reject(new Error('audio element error')); }, { once: true });
    });
    let playResult = 'started';
    try {
      await audio.play();
      audio.pause();
    } catch (error) {
      playResult = `failed: ${error?.message || String(error)}`;
    }
    return {
      text: status.textContent,
      outputFrames: Number(status.dataset.outputFrames),
      detectedBeats: Number(status.dataset.detectedBeats),
      detectedBpm: status.dataset.detectedBpm || '',
      readyState: audio.readyState,
      playResult,
      href: download.getAttribute('href'),
      filename: download.getAttribute('download'),
      disabled: download.getAttribute('aria-disabled'),
    };
  });

  if (state.outputFrames !== expectedFrames) fail(`${browserName}/${mode}: expected ${expectedFrames} frames, got ${state.outputFrames}`);
  if (state.readyState < 2) fail(`${browserName}/${mode}: audio not playable`);
  if (state.playResult !== 'started') fail(`${browserName}/${mode}: ${state.playResult}`);
  if (!state.href?.startsWith('blob:') || state.disabled !== 'false') fail(`${browserName}/${mode}: download link not enabled`);
  if (state.filename !== 'convolved-audio.wav') fail(`${browserName}/${mode}: wrong download filename`);
  if (isReverse && (!(state.detectedBeats > 0) || !state.detectedBpm)) fail(`${browserName}/${mode}: missing beat metadata`);
  const peakMatch = state.text.match(/(-?\d+(?:\.\d+)?) dBTP/);
  if (!peakMatch || Number(peakMatch[1]) > -0.95) fail(`${browserName}/${mode}: unsafe peak text ${state.text}`);

  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.click('#download');
  const download = await downloadPromise;
  const outputPath = path.join(captureDir, `${browserName}-${mode}.wav`);
  await download.saveAs(outputPath);
  const wav = parseWav(outputPath);
  if (wav.frames !== expectedFrames) fail(`${browserName}/${mode}: downloaded WAV frame mismatch`);
  return { ...state, wav };
}

async function runBrowser(channel, browserName) {
  const errors = [];
  const browser = await chromium.launch({
    channel,
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.setInputFiles('#audio-a', path.join(fixtureDir, 'fixture.m4a'));
    await page.setInputFiles('#audio-b', path.join(fixtureDir, 'impulse.wav'));
    const decoded = await decodedFrames(page);
    if (decoded.a.sampleRate !== 48000 || decoded.a.channels !== 2) fail(`${browserName}: HE-AAC decoded shape mismatch`);
    if (decoded.b.sampleRate !== 48000 || decoded.b.channels !== 1) fail(`${browserName}: impulse decoded shape mismatch`);
    const forwardFrames = decoded.a.frames + decoded.b.frames - 1;
    const plain = await runMode(page, browserName, 'plain', forwardFrames);
    const reverse = await runMode(page, browserName, 'beatpan-reverse', 2 * forwardFrames - 240);
    if (errors.length) fail(`${browserName}: page errors: ${errors.join(' | ')}`);
    return {
      channel,
      browserName,
      browserVersion: browser.version(),
      os: `${process.platform} ${process.arch}`,
      decoded,
      forwardFrames,
      plain,
      reverse,
      errors,
      status: 'Pass',
    };
  } finally {
    await browser.close();
  }
}

(async () => {
  const results = [];
  for (const [channel, browserName] of [['chrome', 'chrome'], ['msedge', 'edge']]) {
    results.push(await runBrowser(channel, browserName));
  }
  const output = path.join(captureDir, 'windows-matrix.json');
  fs.writeFileSync(output, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
