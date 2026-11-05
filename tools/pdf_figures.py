#!/usr/bin/env python3
"""从（矢量排版的）PDF 教科书中自动裁出插图。

原理：找到以 "FIGURE n.m" 开头的图注文字块，取图注上方的矢量绘图/位图，
按竖直间距把它们聚成一簇（离图注最近的那簇就是该图），再并入落在簇内或紧邻的
文字（坐标轴标签、图例），最后按该区域高分辨率渲染成 PNG。

用法: pdf_figures.py BOOK.pdf OUT_DIR [--zoom 3] [--pages 1-497]
输出: OUT_DIR/fig-<n>.<m>.png 与 OUT_DIR/figures.json（编号、页码、图注、裁剪框）
无法自动处理的图可用 --manual "2.3:45:x0,y0,x1,y1"（PDF 坐标，pt）覆盖，可重复。
"""
import argparse, json, os, re
import pymupdf

HEADER = re.compile(r"^\s*\d+\s+\S|Chapter\s+\d+\s*•|Modern Cosmology")
CAP = re.compile(r"^\s*(?:FIGURE\s+(\d+|[A-Z])\.(\d+)\b|Figure\s+(\d+|[A-Z])\.(\d+)\.)")   # 两种图注：FIGURE 2.3 …（Dodelson）/ Figure 3.4. …（Nakahara；正文中的 "Figure 3.4 shows" 无句点，不算）


def rects_on_page(page):
    rs = [pymupdf.Rect(d["rect"]) for d in page.get_drawings() if d["rect"].width > 0.5 or d["rect"].height > 0.5]
    rs += [pymupdf.Rect(i["bbox"]) for i in page.get_image_info()]
    return [r for r in rs if not r.is_empty or r.width > 0 or r.height > 0]


def figure_box(page, cap):
    W = page.rect.width
    above = [r for r in rects_on_page(page) if r.y1 <= cap.y0 + 4 and r.width < W * 0.98
             and not (r.y1 > cap.y0 - 14 and r.height < 14)]   # 图注里公式的根号/分数线等细小矢量线
    if not above:
        return None
    # 从最靠近图注的绘图开始，向上合并竖直间距 < 28pt 的绘图
    above.sort(key=lambda r: -r.y1)
    box = pymupdf.Rect(above[0])
    changed = True
    while changed:
        changed = False
        for r in above:
            if r in box:
                continue
            gap = max(box.y0 - r.y1, r.y0 - box.y1, 0)
            if gap < 28 and not box.contains(r):
                nb = box | r
                if nb != box:
                    box = nb; changed = True
    if cap.y0 - box.y1 > 60:          # 离图注太远，多半不是这张图
        return None
    # 并入落在框内或贴边的短文字块（轴标签/图例），排除正文段落
    for b in page.get_text("blocks"):
        r = pymupdf.Rect(b[:4]); txt = b[4].strip()
        if CAP.match(txt) or r.y0 >= cap.y0 - 1:
            continue
        if r.y1 < page.rect.y0 + 50 and HEADER.search(txt):   # 页眉（页码 + 书名/章名）
            continue
        near = r.intersects(box + (-14, -14, 14, 14))
        body = r.width > W * 0.45      # 正文段落或图注碎片都很宽；轴标签、图例较窄
        if near and not body:
            box |= r
    box = box + (-4, -4, 4, 4)
    box.y1 = min(box.y1, cap.y0 - 1)
    return box


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf"); ap.add_argument("out")
    ap.add_argument("--zoom", type=float, default=3)
    ap.add_argument("--pages", default=None)
    ap.add_argument("--manual", action="append", default=[])
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    doc = pymupdf.open(a.pdf)
    lo, hi = (1, len(doc)) if not a.pages else map(int, a.pages.split("-"))
    manual = {}
    for m in a.manual:
        num, pg, bb = m.split(":"); manual[num] = (int(pg), pymupdf.Rect(*map(float, bb.split(","))))
    figs, seen = [], set()
    for pno in range(lo - 1, hi):
        page = doc[pno]
        for b in page.get_text("blocks"):
            mt = CAP.match(b[4])
            if not mt:
                continue
            num = f"{mt.group(1) or mt.group(3)}.{mt.group(2) or mt.group(4)}"
            if num in seen:
                continue
            seen.add(num)
            cap = pymupdf.Rect(b[:4])
            caption = re.sub(r"\s+", " ", b[4]).strip()
            box = figure_box(page, cap)
            if num in manual:
                pno2, box = manual[num]; page = doc[pno2 - 1]
            rec = {"num": num, "page": page.number + 1, "caption": caption, "box": None, "file": None}
            if box:
                box &= page.rect
                pix = page.get_pixmap(matrix=pymupdf.Matrix(a.zoom, a.zoom), clip=box)
                fn = f"fig-{num}.png"
                pix.save(os.path.join(a.out, fn))
                rec.update(box=[round(v, 1) for v in box], file=fn, w=pix.width, h=pix.height)
            figs.append(rec)
            print(f"{num:>6} p{rec['page']:>3} {'OK ' if box else 'MISS'} {caption[:70]}")
    json.dump(figs, open(os.path.join(a.out, "figures.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{sum(1 for f in figs if f['file'])}/{len(figs)} figures extracted")


if __name__ == "__main__":
    main()
