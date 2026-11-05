// Partial equation highlight. The box height of a KaTeX element depends only on line height: fractions and sums stick out of their boxes, and small symbols have oversized boxes,
// so this measures the actual extent of the glyphs and draws the highlight behind the equation.

const INK = "svg, .frac-line, .hline, .overline-line, .underline-line";

// Bounding rectangle of all glyphs in an element (viewport coordinates)
export function inkRect(el) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  const add = r => {
    if (r.width < 0.5 && r.height < 0.5) return;
    left = Math.min(left, r.left); top = Math.min(top, r.top);
    right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
  };
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), range = document.createRange();
  while (walker.nextNode()) {
    if (!walker.currentNode.nodeValue.trim()) continue;
    range.selectNode(walker.currentNode);
    for (const r of range.getClientRects()) add(r);
  }
  el.querySelectorAll(INK).forEach(n => add(n.getBoundingClientRect()));
  return left === Infinity ? el.getBoundingClientRect() : { left, top, right, bottom, width: right - left, height: bottom - top };
}

// Draw highlights for els in host (the equation container, which needs position:relative); an empty array fades them all out.
// The highlight layer is a child of host, so it moves with horizontal scrolling; it's rebuilt automatically after React rewrites the equation HTML.
export function drawInk(host, els) {
  let layer = host.querySelector(":scope > .ink-layer");
  if (!layer) { layer = document.createElement("div"); layer.className = "ink-layer"; layer.setAttribute("aria-hidden", "true"); host.prepend(layer); }
  const outer = els.filter(el => !els.some(o => o !== el && o.contains(el)));   // when nested, draw only the outermost, to avoid darkening the color
  const base = host.getBoundingClientRect(), PAD = 3;
  outer.forEach((el, i) => {
    const box = layer.children[i] || layer.appendChild(document.createElement("i")), r = inkRect(el);
    box.dataset.role = el.dataset.role || "const";
    box.style.cssText = `left:${r.left - base.left + host.scrollLeft - PAD}px;top:${r.top - base.top + host.scrollTop - PAD}px;width:${r.width + 2 * PAD}px;height:${r.height + 2 * PAD}px`;
    box.classList.add("on");
  });
  [...layer.children].slice(outer.length).forEach(box => box.classList.remove("on"));
}
