#!/usr/bin/env python3
"""图书讲明白 静态服务：提供 <BOOK_DIR>/dist（npm run build 产物）。用法: serve.py BOOK_DIR PORT"""
import sys, os, http.server, functools
DIST = os.path.join(os.path.abspath(sys.argv[1]), "dist")
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache"); super().end_headers()
http.server.ThreadingHTTPServer(("0.0.0.0", int(sys.argv[2])), functools.partial(H, directory=DIST)).serve_forever()
