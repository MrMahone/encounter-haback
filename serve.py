#!/usr/bin/env python3
"""Kleiner Server zum lokalen Ausprobieren:  py serve.py  ->  http://localhost:8123

Warum nicht einfach `py -m http.server`? Auf Windows liest Python die MIME-Typen
aus der Registry und liefert .js dann als text/plain aus. Der Browser weigert sich
dann, den Service Worker zu registrieren - offline ginge lokal also nicht zu testen.
Auf GitHub Pages ist das kein Thema, da stimmen die Typen.
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

TYPEN = {
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.css': 'text/css',
    '.html': 'text/html',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
}


class Handler(SimpleHTTPRequestHandler):
    def guess_type(self, path):
        endung = Path(path).suffix.lower()
        if endung in TYPEN:
            return TYPEN[endung]
        return super().guess_type(path)

    def end_headers(self):
        # Beim Entwickeln nichts zwischenspeichern, sonst rätselt man ewig.
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    wurzel = Path(__file__).resolve().parent
    server = ThreadingHTTPServer(('127.0.0.1', port), partial(Handler, directory=str(wurzel)))
    print(f'HP-Zaehler laeuft auf http://localhost:{port}  (Strg+C beendet)')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nAus.')


if __name__ == '__main__':
    main()
