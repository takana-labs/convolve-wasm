#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


class CaptureHandler(SimpleHTTPRequestHandler):
    static_root: Path
    capture_root: Path

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(self.static_root), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/capture/"):
            self.send_error(404)
            return
        filename = Path(unquote(parsed.path.removeprefix("/capture/"))).name
        if not filename.endswith(".wav"):
            self.send_error(400, "capture filename must end in .wav")
            return
        length = int(self.headers.get("Content-Length", "0"))
        payload = self.rfile.read(length)
        self.capture_root.mkdir(parents=True, exist_ok=True)
        destination = self.capture_root / filename
        destination.write_bytes(payload)
        self.send_response(201)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"ok")
        print(f"captured {destination} ({len(payload)} bytes)", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("static_root")
    parser.add_argument("capture_root")
    parser.add_argument("port", type=int)
    args = parser.parse_args()

    CaptureHandler.static_root = Path(args.static_root).resolve()
    CaptureHandler.capture_root = Path(args.capture_root).resolve()
    os.chdir(CaptureHandler.static_root)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), CaptureHandler)
    print(f"serving {CaptureHandler.static_root} on {args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
