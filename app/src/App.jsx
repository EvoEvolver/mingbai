import { useEffect, useState } from "react";
import { book, modules } from "virtual:book";
import Shelf from "./Shelf.jsx";

// hash 路由：#/ 书架，#/<chapterId> 章节，#/<chapterId>/<anchor> 章节内定位（如 #/ch02/eq-2.23），#/connections 全书脉络
function useRoute() {
  const get = () => location.hash.replace(/^#\/?/, "").split("/");
  const [r, setR] = useState(get);
  useEffect(() => {
    let prev = get()[0];
    const f = () => { const n = get(); if (n[0] !== prev) scrollTo(0, 0); prev = n[0]; setR(n); };
    addEventListener("hashchange", f); return () => removeEventListener("hashchange", f);
  }, []);
  return r;
}

// 渲染后滚动到锚点并闪烁高亮。公式/插图渲染过程中页面会持续变高，
// 因此在约 2.5 秒内多次校正位置；用户一旦自己滚动（滚轮/触摸/按键）就停止校正。
function useAnchor(id, anchor) {
  useEffect(() => {
    if (!anchor) return;
    let stop = false, flashed = false;
    const cancel = () => { stop = true; };
    addEventListener("wheel", cancel, { passive: true }); addEventListener("touchstart", cancel, { passive: true }); addEventListener("keydown", cancel);
    const go = () => {
      if (stop) return;
      const el = document.getElementById(decodeURIComponent(anchor));
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (Math.abs(r.top + r.height / 2 - innerHeight / 2) > 40) el.scrollIntoView({ block: r.height > innerHeight * .8 ? "start" : "center", behavior: "instant" });
      if (!flashed) { flashed = true; if (el.matches(".tb-sec, .tb-sub")) return; el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
    };
    const timers = [30, 150, 400, 800, 1300, 1900, 2500].map(t => setTimeout(go, t));
    return () => { timers.forEach(clearTimeout); removeEventListener("wheel", cancel); removeEventListener("touchstart", cancel); removeEventListener("keydown", cancel); };
  }, [id, anchor]);
}

export default function App() {
  const [id, anchor] = useRoute();
  useAnchor(id, anchor);
  const M = modules[id]?.default;
  if (M) return <M key={id} />;
  if (id) return <p className="loading">「{id}」尚未上线。<br /><a href="#/">← 返回 {book.title}</a></p>;
  return <Shelf />;
}
