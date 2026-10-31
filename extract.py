#!/usr/bin/env python3
"""epub 章节 xhtml -> 纯文本（保留段落与小节标题）。用法: extract.py in.xhtml out.txt"""
import sys, re, html
src = open(sys.argv[1], encoding="utf-8").read()
src = re.sub(r"(?s)<head.*?</head>", "", src)
src = re.sub(r"(?i)<h[1-6][^>]*>", "\n\n## ", src)
src = re.sub(r"(?i)</(p|h[1-6]|div|blockquote|li)>", "\n\n", src)
src = re.sub(r"(?i)<sup[^>]*>.*?</sup>", "", src)
txt = html.unescape(re.sub(r"<[^>]+>", "", src))
txt = re.sub(r"\n\s*\n+", "\n\n", txt).strip()
open(sys.argv[2], "w", encoding="utf-8").write(txt + "\n")
