#!/usr/bin/env python3
"""Combine a batch of images into a numbered thumbnail overview, for checking crops by hand. Usage: contact_sheet.py OUT.png img1 img2 ..."""
import sys, os
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
T, cols = 300, 4
cells = []
for f in files:
    im = Image.open(f).convert("RGB"); im.thumbnail((T, T))
    c = Image.new("RGB", (T, T + 22), "white"); c.paste(im, ((T - im.width) // 2, 22))
    ImageDraw.Draw(c).text((4, 4), os.path.basename(f), fill="red"); cells.append(c)
rows = (len(cells) + cols - 1) // cols
sheet = Image.new("RGB", (cols * T + (cols + 1) * 6, rows * (T + 22) + (rows + 1) * 6), "#888")
for i, c in enumerate(cells):
    sheet.paste(c, (6 + (i % cols) * (T + 6), 6 + (i // cols) * (T + 28)))
sheet.save(out)
