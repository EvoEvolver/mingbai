import { t } from "./i18n/index.js";
import { Children, useState } from "react";
import { Paras, useReveal, useChapter, ConceptChip } from "./core.jsx";
import { Rich } from "./math/tex.jsx";
import { titleOf, nameOf } from "./book.jsx";

// Opening hook: dark story card
// String pieces in children render as (rich) text split into paragraphs; elements are kept as is, so strings and JSX can be mixed
const richKids = kids => Children.map(kids, c => (typeof c === "string" ? <Paras text={c} /> : c));

export const Hook = ({ title, children }) => (
  <div className="hook"><h2><Rich>{title}</Rich></h2>{richKids(children)}</div>);

// Source-book section card; click to expand the summary + related concepts
// sections: [{id,no,title_zh,title_en,gist,summary,concept_ids}]
export function SectionCards({ sections }) {
  const [open, setOpen] = useState(null);
  const s = sections.find(x => x.id === open);
  return <>
    <div className="secs">{sections.map(x =>
      <div key={x.id} className={"sec" + (x.id === open ? " open" : "")} onClick={() => setOpen(x.id === open ? null : x.id)}>
        <div className="no">{x.no}</div><h3>{titleOf(x)}</h3>{x.title_zh && <div className="t-en">{x.title_en}</div>}<div className="gist"><Rich>{x.gist}</Rich></div>
      </div>)}
    </div>
    <div className={"secdetail" + (s ? " open" : "")}>
      {s && <><b>{s.no} · {titleOf(s)}</b><Paras text={s.summary} />
        <div className="chips">{(s.concept_ids || []).map(id => <ConceptChip key={id} id={id} />)}</div></>}
    </div>
  </>;
}

// Line of argument: vertical timeline that lights up step by step on scroll. steps: [{claim, detail}]
function Step({ n, s }) {
  const [ref, vis] = useReveal(.6);
  return <div ref={ref} className={"step" + (vis ? " vis" : "")}><div className="dot">{n}</div><b><Rich>{s.claim}</Rich></b>{s.detail && <p><Rich>{s.detail}</Rich></p>}</div>;
}
export const ArgumentFlow = ({ steps }) => <div className="flow">{steps.map((s, i) => <Step key={i} n={i + 1} s={s} />)}</div>;

// Concept card grid (reads ChapterPage's concepts/groups), with group filters
export function ConceptGrid() {
  const { concepts, groups, open, color, groupLabel } = useChapter();
  const [g, setG] = useState("*");
  const used = groups.length ? groups.map(x => x.id) : [...new Set(concepts.map(c => c.group))];
  return <>
    {used.length > 1 && <div className="filters">
      {["*", ...used].map(x => <button key={x} className={g === x ? "on" : ""} onClick={() => setG(x)}>{x === "*" ? t("blk.all") : groupLabel(x)}</button>)}
    </div>}
    <div className="cgrid">{concepts.filter(c => g === "*" || c.group === g).map(c =>
      <div key={c.id} className="ccard" style={{ "--g": color(c.group) }} onClick={() => open(c.id)}>
        <div className="ic">{c.icon}</div><h3><Rich>{nameOf(c)}</Rich></h3>{c.name_zh && <div className="en"><Rich>{c.name_en}</Rich></div>}
        <div className="plain"><Rich>{c.plain}</Rich></div><div className="more">{t("blk.more")}</div>
      </div>)}
    </div>
  </>;
}

// Example compressor: a series of source-book examples → one sentence. items: [{examples:[...], says}]
// Each examples item can be a string (label only) or {tag, detail}: detail explains in 2-4 sentences what the example is in the source book and what happens in it;
// tags with a detail can be clicked to expand, and there is an "expand all" control.
const exTag = e => typeof e === "string" ? e : e.tag;
const exDetail = e => typeof e === "string" ? null : e.detail;
function CompGroup({ g }) {
  const [done, setDone] = useState(false);
  const [sel, setSel] = useState(null);
  const [all, setAll] = useState(false);
  const rich = g.examples.some(exDetail);
  if (!rich) return (
    <div className={"cgroup" + (done ? " done" : "")} onClick={() => setDone(!done)}>
      <div className="lbl">{t("blk.exLabel", g.examples.length)} · {done ? t("blk.clickRestore") : t("blk.clickCompress")}</div>
      <div className="ex">{g.examples.map((e, i) => <span key={i}>{exTag(e)}</span>)}</div>
      <div className="says">💡 <Rich>{g.says}</Rich></div>
    </div>);
  const cur = sel !== null ? g.examples[sel] : null;
  return (
    <div className={"cgroup rich" + (done ? " done" : "")}>
      <div className="lbl">{t("blk.exLabel", g.examples.length)} · {t("blk.tagHint")}
        <span className="cbtns">
          <button className={all ? "on" : ""} onClick={() => { setAll(!all); setSel(null); }}>{all ? t("blk.collapseAll") : t("blk.expandAll")}</button>
          <button className={done ? "on" : ""} onClick={() => setDone(!done)}>{done ? t("blk.restore") : t("blk.compress")}</button>
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

// Two-column comparison table. rows: [{aspect, left, right}]
export const CompareTable = ({ left, right, rows }) => (
  <div className="ctable">
    <div className="crow head"><div /><div>{left}</div><div>{right}</div></div>
    {rows.map((r, i) => <div className="crow" key={i}><div className="asp"><Rich>{r.aspect}</Rich></div><div className="l"><Rich>{r.left}</Rich></div><div className="r"><Rich>{r.right}</Rich></div></div>)}
  </div>);

// Carousel of source quotes. quotes: [{en, zh, meaning}] (each en ≤ 25 words, at most 4 items)
export function QuoteCarousel({ quotes }) {
  const [i, setI] = useState(0), q = quotes[i], n = quotes.length;
  const go = d => setI((i + d + n) % n);
  return <>
    <div className="quotewrap">
      {n > 1 && <button className="qarrow l" onClick={() => go(-1)} aria-label={t("blk.prevQuote")}>‹</button>}
      <div className="quote" onClick={() => go(1)} title={n > 1 ? t("blk.clickNextQuote") : undefined}>
        <div className="en">“{q.en}”</div>{q.zh && <div className="zh"><Rich>{q.zh}</Rich></div>}<div className="meaning"><Rich>{q.meaning}</Rich></div>
        {n > 1 && <div className="qhint">{i + 1} / {n} · {t("blk.quoteHint")}</div>}
      </div>
      {n > 1 && <button className="qarrow r" onClick={() => go(1)} aria-label={t("blk.nextQuote")}>›</button>}
    </div>
    {n > 1 && <div className="qnav">{quotes.map((_, j) => <button key={j} className={j === i ? "on" : ""} aria-label={t("blk.quoteN", j + 1)} onClick={() => setI(j)} />)}</div>}
  </>;
}

// Comprehension quiz. questions: [{q, options, answer(index), why}]
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
    {answered === questions.length && <div className="score">{t("blk.score", right, answered)}{right === answered ? t("blk.scoreAll") : t("blk.scoreSome")}</div>}
  </>;
}

export const Takeaways = ({ items }) => <div className="takeaways">{items.map((t, i) => <div className="tk" key={i}><Rich>{t}</Rich></div>)}</div>;

// Transition to the next chapter
export const Bridge = ({ title = t("blk.bridge"), children }) => (
  <div className="bridge"><b>{title}</b>{richKids(children)}</div>);

// Glossary (searchable). terms: [{term, zh, def}]
export function Glossary({ terms }) {
  const [q, setQ] = useState("");
  const list = terms.filter(g => !q || (g.term + (g.zh || "") + g.def).toLowerCase().includes(q.toLowerCase()));
  return <>
    <input className="search" placeholder={t("blk.searchTerm")} value={q} onChange={e => setQ(e.target.value)} />
    <div className="gloss">{list.map((g, i) => <div key={i}><b>{g.term}</b> <i>{g.zh}</i><br /><Rich>{g.def}</Rich></div>)}</div>
  </>;
}
