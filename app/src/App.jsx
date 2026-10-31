import { useEffect } from "react";
import Shelf from "./Shelf.jsx";

// 页内锚点（#eq-2.23、#sec-2.1 …）：渲染后滚动到位并闪烁高亮。公式/插图渲染过程中页面会持续变高，
// 因此在约 2.5 秒内多次校正位置；用户一旦自己滚动（滚轮/触摸/按键）就停止校正。
function useAnchor() {
  useEffect(() => {
    let stop = false, timers = [];
    const cancel = () => { stop = true; };
    const run = () => {
      timers.forEach(clearTimeout); stop = false;
      const anchor = decodeURIComponent(location.hash.slice(1));
      if (!anchor || anchor.startsWith("/")) return;
      let flashed = false;
      const go = () => {
        if (stop) return;
        const el = document.getElementById(anchor);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (Math.abs(r.top + r.height / 2 - innerHeight / 2) > 40) el.scrollIntoView({ block: r.height > innerHeight * .8 ? "start" : "center", behavior: "instant" });
        if (!flashed) { flashed = true; if (el.matches(".tb-sec, .tb-sub")) return; el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
      };
      timers = [30, 150, 400, 800, 1300, 1900, 2500].map(t => setTimeout(go, t));
    };
    addEventListener("wheel", cancel, { passive: true }); addEventListener("touchstart", cancel, { passive: true }); addEventListener("keydown", cancel);
    addEventListener("hashchange", run);
    run();
    return () => { timers.forEach(clearTimeout); removeEventListener("wheel", cancel); removeEventListener("touchstart", cancel); removeEventListener("keydown", cancel); removeEventListener("hashchange", run); };
  }, []);
}

export default function App({ id, mod }) {
  useAnchor();
  if (!id) return <Shelf />;
  const M = mod.default;
  return <M />;
}
