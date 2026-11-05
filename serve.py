#!/usr/bin/env python3
"""Mingbai.js static server: serves <BOOK_DIR>/dist (npm run build output). Usage: serve.py BOOK_DIR PORT"""
import sys, os, http.server, functools
DIST = os.path.join(os.path.abspath(sys.argv[1]), "dist")
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache"); super().end_headers()
http.server.ThreadingHTTPServer(("0.0.0.0", int(sys.argv[2])), functools.partial(H, directory=DIST)).serve_forever()
