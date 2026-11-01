import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Feedback from "./kit/Feedback.jsx";
import { setPage, legacyHashUrl } from "./kit/book.jsx";
import "./kit/style.css";

// 每个页面的入口（由 vite.config.js 生成的 virtual:page/<id> 调用）。id 为 null 表示书架。
export function mount(id, mod) {
  // 兼容旧式哈希路由：#/ch02/eq-2.23 → ../ch02/#eq-2.23
  if (location.hash.startsWith("#/")) {
    setPage(id, null);
    const u = legacyHashUrl(location.hash);
    if (u && !u.startsWith("#")) { location.replace(u); return; }
    if (u) history.replaceState(null, "", u);
  }
  setPage(id, mod);
  // 内容里残留的旧式链接 href="#/…" 统一改写为路径链接
  const fix = root => root.querySelectorAll?.('a[href^="#/"]').forEach(a => { const u = legacyHashUrl(a.getAttribute("href")); if (u) a.setAttribute("href", u); });
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && (n.matches?.('a[href^="#/"]') ? fix(n.parentNode) : fix(n))))).observe(document.body, { childList: true, subtree: true });
  createRoot(document.getElementById("root")).render(<><App id={id} mod={mod} /><Feedback /></>);
}
