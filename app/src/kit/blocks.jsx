import { Children, useState } from "react";
import { Paras, useReveal, useChapter, ConceptChip } from "./core.jsx";
import { Rich } from "./math/tex.jsx";

// 开场钩子：深色故事卡
// children 中的字符串片段按（富）文本分段渲染，元素原样保留——允许「字符串 + JSX」混写
const richKids = kids => Children.map(kids, c => (typeof c === "string" ? <Paras text={c} /> : c));

export const Hook = ({ title, children }) => (
  <div className="hook"><h2><Rich>{title}</Rich></h2>{richKids(children)}</div>);

// 原著小节卡片，点击展开概述 + 相关概念
// sections: [{id,no,title_zh,title_en,gist,summary,concept_ids}]
export function SectionCards({ sections }) {
  const [open, setOpen] = useState(null);
  const s = sections.find(x => x.id === open);
  return <>
    <div className="secs">{sections.map(x =>
      <div key={x.id} className={"sec" + (x.id === open ? " open" : "")} onClick={() => setOpen(x.id === open ? null : x.id)}>
        <div className="no">{x.no}</div><h3>{x.title_zh}</h3><div className="t-en">{x.title_en}</div><div className="gist"><Rich>{x.gist}</Rich></div>
      </div>)}
    </div>
    <div className={"secdetail" + (s ? " open" : "")}>
      {s && <><b>{s.no} · {s.title_zh}</b><Paras text={s.summary} />
        <div className="chips">{(s.concept_ids || []).map(id => <ConceptChip key={id} id={id} />)}</div></>}
    </div>
  </>;
}

// 论证主线：竖向时间线，滚动逐步点亮。steps: [{claim, detail}]
function Step({ n, s }) {
  const [ref, vis] = useReveal(.6);
  return <div ref={ref} className={"step" + (vis ? " vis" : "")}><div className="dot">{n}</div><b><Rich>{s.claim}</Rich></b>{s.detail && <p><Rich>{s.detail}</Rich></p>}</div>;
}
export const ArgumentFlow = ({ steps }) => <div className="flow">{steps.map((s, i) => <Step key={i} n={i + 1} s={s} />)}</div>;

// 概念卡片网格（读取 ChapterPage 的 concepts/groups），带分组筛选
export function ConceptGrid() {
  const { concepts, groups, open, color, groupLabel } = useChapter();
  const [g, setG] = useState("*");
  const used = groups.length ? groups.map(x => x.id) : [...new Set(concepts.map(c => c.group))];
  return <>
    {used.length > 1 && <div className="filters">
      {["*", ...used].map(x => <button key={x} className={g === x ? "on" : ""} onClick={() => setG(x)}>{x === "*" ? "全部" : groupLabel(x)}</button>)}
    </div>}
    <div className="cgrid">{concepts.filter(c => g === "*" || c.group === g).map(c =>
      <div key={c.id} className="ccard" style={{ "--g": color(c.group) }} onClick={() => open(c.id)}>
        <div className="ic">{c.icon}</div><h3><Rich>{c.name_zh}</Rich></h3><div className="en"><Rich>{c.name_en}</Rich></div>
        <div className="plain"><Rich>{c.plain}</Rich></div><div className="more">展开 →</div>
      </div>)}
    </div>
  </>;
}

// 例子压缩器：一串原著例子 → 一句话。items: [{examples:[...], says}]
// examples 每项可以是字符串（仅标签），或 {tag, detail}：detail 用 2-4 句讲清这个例子在原著里是什么、怎么回事；
// 有 detail 的标签可点击展开，另有「全部展开」。
const exTag = e => typeof e === "string" ? e : e.tag;
const exDetail = e => typeof e === "string" ? null : e.detail;
function CompGroup({ g }) {
  const [done, setDone] = useState(false);
  const [sel, setSel] = useState(null);
  const [all, setAll] = useState(false);
  const rich = g.examples.some(exDetail);
  if (!rich) return (
    <div className={"cgroup" + (done ? " done" : "")} onClick={() => setDone(!done)}>
      <div className="lbl">原著例子 ×{g.examples.length} · {done ? "点击还原" : "点击压缩"}</div>
      <div className="ex">{g.examples.map((e, i) => <span key={i}>{exTag(e)}</span>)}</div>
      <div className="says">💡 <Rich>{g.says}</Rich></div>
    </div>);
  const cur = sel !== null ? g.examples[sel] : null;
  return (
    <div className={"cgroup rich" + (done ? " done" : "")}>
      <div className="lbl">原著例子 ×{g.examples.length} · 点标签看这个例子讲了什么
        <span className="cbtns">
          <button className={all ? "on" : ""} onClick={() => { setAll(!all); setSel(null); }}>{all ? "收起全部" : "全部展开"}</button>
          <button className={done ? "on" : ""} onClick={() => setDone(!done)}>{done ? "还原" : "压缩成一句话 →"}</button>
        </span>
      </div>
      <div className="ex">{g.examples.map((e, i) => exDetail(e)
        ? <button key={i} className={"tag" + (sel === i && !all ? " on" : "")} onClick={() => { setAll(false); setSel(sel === i ? null : i); }}>{exTag(e)}<i>{sel === i && !all ? "▾" : "▸"}</i></button>
        : <span key={i}>{exTag(e)}</span>)}
      </div>
      {!all && cur && <div className="exd" key={sel}><b>{exTag(cur)}</b><Rich>{exDetail(cur)}</Rich></div>}
      {all && <div className="exall">{g.examples.filter(exDetail).map((e, i) => <div className="exd" key={i}><b>{exTag(e)}</b><Rich>{exDetail(e)}</Rich></div>)}</div>}
      <div className="says">💡 <Rich>{g.says}</Rich></div>
    </div>);
}
export const ExampleCompression = ({ items }) => <div className="comp">{items.map((g, i) => <CompGroup key={i} g={g} />)}</div>;

// 两栏对照表。rows: [{aspect, left, right}]
export const CompareTable = ({ left, right, rows }) => (
  <div className="ctable">
    <div className="crow head"><div /><div>{left}</div><div>{right}</div></div>
    {rows.map((r, i) => <div className="crow" key={i}><div className="asp"><Rich>{r.aspect}</Rich></div><div className="l"><Rich>{r.left}</Rich></div><div className="r"><Rich>{r.right}</Rich></div></div>)}
  </div>);

// 原文金句轮播。quotes: [{en, zh, meaning}]（每条 en ≤25 词，最多 4 条）
export function QuoteCarousel({ quotes }) {
  const [i, setI] = useState(0), q = quotes[i], n = quotes.length;
  const go = d => setI((i + d + n) % n);
  return <>
    <div className="quotewrap">
      {n > 1 && <button className="qarrow l" onClick={() => go(-1)} aria-label="上一句">‹</button>}
      <div className="quote" onClick={() => go(1)} title={n > 1 ? "点击看下一句" : undefined}>
        <div className="en">“{q.en}”</div><div className="zh"><Rich>{q.zh}</Rich></div><div className="meaning"><Rich>{q.meaning}</Rich></div>
        {n > 1 && <div className="qhint">{i + 1} / {n} · 点击卡片或两侧箭头切换 →</div>}
      </div>
      {n > 1 && <button className="qarrow r" onClick={() => go(1)} aria-label="下一句">›</button>}
    </div>
    {n > 1 && <div className="qnav">{quotes.map((_, j) => <button key={j} className={j === i ? "on" : ""} aria-label={`第${j + 1}句`} onClick={() => setI(j)} />)}</div>}
  </>;
}

// 理解自测。questions: [{q, options, answer(index), why}]
export function Quiz({ questions }) {
  const [picked, setPicked] = useState({});
  const answered = Object.keys(picked).length;
  const right = questions.filter((q, i) => picked[i] === q.answer).length;
  return <>
    {questions.map((q, qi) => {
      const p = picked[qi];
      return (
        <div className="qcard" key={qi}>
          <div className="q">{qi + 1}. <Rich>{q.q}</Rich></div>
          {q.options.map((o, oi) => {
            const cls = p === undefined ? "" : oi === q.answer ? " right" : oi === p ? " wrong" : "";
            return <button key={oi} className={"opt" + cls} disabled={p !== undefined} onClick={() => setPicked(s => ({ ...s, [qi]: oi }))}><Rich>{o}</Rich></button>;
          })}
          {p !== undefined && <div className="qwhy">{p === q.answer ? "✅ " : "❌ "}<Rich>{q.why}</Rich></div>}
        </div>);
    })}
    {answered === questions.length && <div className="score">得分 {right}/{answered}{right === answered ? " —— 完全掌握 🎉" : " —— 回到概念卡片再看看错题涉及的概念"}</div>}
  </>;
}

export const Takeaways = ({ items }) => <div className="takeaways">{items.map((t, i) => <div className="tk" key={i}><Rich>{t}</Rich></div>)}</div>;

// 下一章衔接
export const Bridge = ({ title = "→ 下一章预告", children }) => (
  <div className="bridge"><b>{title}</b>{richKids(children)}</div>);

// 术语表（可搜索）。terms: [{term, zh, def}]
export function Glossary({ terms }) {
  const [q, setQ] = useState("");
  const list = terms.filter(g => !q || (g.term + g.zh + g.def).toLowerCase().includes(q.toLowerCase()));
  return <>
    <input className="search" placeholder="搜索术语…" value={q} onChange={e => setQ(e.target.value)} />
    <div className="gloss">{list.map((g, i) => <div key={i}><b>{g.term}</b> <i>{g.zh}</i><br /><Rich>{g.def}</Rich></div>)}</div>
  </>;
}
