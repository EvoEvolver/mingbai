// 公式局部高亮。KaTeX 元素的盒子高度只取决于行高，分式、求和这类内容会伸出盒子，小符号的盒子又偏大，
// 所以这里按实际字形量出范围，再把高亮块画在公式背后。

const INK = "svg, .frac-line, .hline, .overline-line, .underline-line";

// 元素内全部字形的外接矩形（视口坐标）
function inkRect(el) {
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

// 在 host（公式容器，需 position:relative）里给 els 画高亮；传空数组则全部淡出。
// 高亮层是 host 的子元素，容器横向滚动时会跟着走；React 重写公式 HTML 后这里会自动重建。
export function drawInk(host, els) {
  let layer = host.querySelector(":scope > .ink-layer");
  if (!layer) { layer = document.createElement("div"); layer.className = "ink-layer"; layer.setAttribute("aria-hidden", "true"); host.prepend(layer); }
  const outer = els.filter(el => !els.some(o => o !== el && o.contains(el)));   // 嵌套时只画最外层，避免颜色叠深
  const base = host.getBoundingClientRect(), PAD = 3;
  outer.forEach((el, i) => {
    const box = layer.children[i] || layer.appendChild(document.createElement("i")), r = inkRect(el);
    box.dataset.role = el.dataset.role || "const";
    box.style.cssText = `left:${r.left - base.left + host.scrollLeft - PAD}px;top:${r.top - base.top + host.scrollTop - PAD}px;width:${r.width + 2 * PAD}px;height:${r.height + 2 * PAD}px`;
    box.classList.add("on");
  });
  [...layer.children].slice(outer.length).forEach(box => box.classList.remove("on"));
}
