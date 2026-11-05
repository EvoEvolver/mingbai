#!/usr/bin/env python3
"""epub chapter xhtml -> plain text (keeps paragraphs and section headings). Usage: extract.py in.xhtml out.txt"""
import sys, re, html
src = open(sys.argv[1], encoding="utf-8").read()
src = re.sub(r"(?s)<head.*?</head>", "", src)
src = re.sub(r"(?i)<h[1-6][^>]*>", "\n\n## ", src)
src = re.sub(r"(?i)</(p|h[1-6]|div|blockquote|li)>", "\n\n", src)
src = re.sub(r"(?i)<sup[^>]*>.*?</sup>", "", src)
txt = html.unescape(re.sub(r"<[^>]+>", "", src))
txt = re.sub(r"\n\s*\n+", "\n\n", txt).strip()
open(sys.argv[2], "w", encoding="utf-8").write(txt + "\n")
