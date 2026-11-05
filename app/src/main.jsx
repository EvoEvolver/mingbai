import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Feedback from "./kit/Feedback.jsx";
import { setPage, legacyHashUrl } from "./kit/book.jsx";
import "./kit/style.css";

// Entry point of each page (called by the virtual:page/<id> generated in vite.config.js). A null id means the shelf.
export function mount(id, mod) {
  // Support old-style hash routes: #/ch02/eq-2.23 → ../ch02/#eq-2.23
  if (location.hash.startsWith("#/")) {
    setPage(id, null);
    const u = legacyHashUrl(location.hash);
    if (u && !u.startsWith("#")) { location.replace(u); return; }
    if (u) history.replaceState(null, "", u);
  }
  setPage(id, mod);
  // Rewrite leftover old-style links href="#/…" in content to path links
  const fix = root => root.querySelectorAll?.('a[href^="#/"]').forEach(a => { const u = legacyHashUrl(a.getAttribute("href")); if (u) a.setAttribute("href", u); });
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && (n.matches?.('a[href^="#/"]') ? fix(n.parentNode) : fix(n))))).observe(document.body, { childList: true, subtree: true });
  createRoot(document.getElementById("root")).render(<><App id={id} mod={mod} /><Feedback /></>);
}
