import { t } from "./i18n/index.js";
import { useEffect, useMemo, useState } from "react";
import { shuffle } from "./core.jsx";

// 拖拽分类游戏（也支持先点卡片再点格子）。
// categories: [{id,label}]；items: [{text, answer(category id), why}]
export function DragSort({ categories, items }) {
  const order = useMemo(() => shuffle(items.map((_, i) => i)), [items]);
  const [placed, setPlaced] = useState({});      // item index -> category id
  const [sel, setSel] = useState(null);
  const [bad, setBad] = useState(null);
  const [over, setOver] = useState(null);
  const [tries, setTries] = useState(0);
  const [toast, setToast] = useState(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);

  const place = (i, cat) => {
    if (i == null || placed[i]) return;
    setTries(t => t + 1); setSel(null);
    if (items[i].answer === cat) { setPlaced(p => ({ ...p, [i]: cat })); setToast("✅ " + items[i].why); }
    else {
      setBad(null); requestAnimationFrame(() => setBad(i));
      setToast(t("sort.wrong", categories.find(c => c.id === cat)?.label));
    }
  };
  const ok = Object.keys(placed).length;
  const Item = ({ i }) => (
    <div className={"item" + (placed[i] ? " ok" : "") + (sel === i ? " sel" : "") + (bad === i ? " bad" : "")}
      draggable={!placed[i]} onDragStart={e => e.dataTransfer.setData("text/plain", String(i))}
      onClick={e => { e.stopPropagation(); if (!placed[i]) setSel(i); }}>{items[i].text}</div>);

  return (
    <div className="sorter">
      <div className="pool">{order.filter(i => !placed[i]).map(i => <Item key={i} i={i} />)}
        {ok === items.length && <span style={{ color: "var(--muted)" }}>{t("sort.done")}</span>}</div>
      <div className="bins">{categories.map(c =>
        <div key={c.id} className={"bin" + (over === c.id ? " over" : "")}
          onDragOver={e => { e.preventDefault(); setOver(c.id); }} onDragLeave={() => setOver(null)}
          onDrop={e => { e.preventDefault(); setOver(null); place(+e.dataTransfer.getData("text/plain"), c.id); }}
          onClick={() => place(sel, c.id)}>
          <h4>{c.label}</h4>
          {order.filter(i => placed[i] === c.id).map(i => <Item key={i} i={i} />)}
        </div>)}
      </div>
      <div className="score">{t("sort.score", ok, items.length, tries)}{ok === items.length ? t("sort.allRight") : ""}</div>
      {toast && <div className="toast">{toast}</div>}
    </div>);
}
