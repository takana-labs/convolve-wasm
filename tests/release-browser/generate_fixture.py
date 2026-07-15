#!/usr/bin/env python3
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 48_000
DURATION_SECONDS = 4
SOURCE_FRAMES = SAMPLE_RATE * DURATION_SECONDS
IMPULSE_FRAMES = 2_400
CLICK_PERIOD = SAMPLE_RATE // 2
CLICK_FRAMES = 240


def pcm16(value: float) -> int:
    return max(-32768, min(32767, round(value * 32767.0)))


def write_source(path: Path) -> None:
    with wave.open(str(path), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for index in range(SOURCE_FRAMES):
            click_offset = index % CLICK_PERIOD
            click = 0.0
            if click_offset < CLICK_FRAMES:
                phase = click_offset / (CLICK_FRAMES - 1)
                click = 0.65 * (0.5 - 0.5 * math.cos(2.0 * math.pi * phase))
            tone = 0.04 * math.sin(2.0 * math.pi * 440.0 * index / SAMPLE_RATE)
            left = pcm16(click + tone)
            right = pcm16(click - tone)
            frames.extend(struct.pack("<hh", left, right))
        output.writeframes(frames)


def write_impulse(path: Path) -> None:
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        samples = [pcm16(0.5)] + [0] * (IMPULSE_FRAMES - 1)
        output.writeframes(struct.pack(f"<{len(samples)}h", *samples))


def main() -> None:
    destination = Path("release-browser-fixture")
    destination.mkdir(parents=True, exist_ok=True)
    write_source(destination / "source.wav")
    write_impulse(destination / "impulse.wav")
    print(f"source frames={SOURCE_FRAMES}")
    print(f"impulse frames={IMPULSE_FRAMES}")


if __name__ == "__main__":
    main()
