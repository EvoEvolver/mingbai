import { t, lang } from "../i18n/index.js";
import { useEffect, useState } from "react";
import { book } from "../book.jsx";
import { Progress, Toc, TopBar, ChapterNav } from "../layout.jsx";
import { ChapterProvider } from "../core.jsx";
import { TextbookProvider, Tx, TxI, Rich } from "../math/tex.jsx";
import { KeyEquations, Notation } from "../math/env.jsx";

// 论文导读组件。论文的叙事骨架与教科书不同：缺口（Gap）→ 动机（Motivation）→ 方案（Solution）→ 结果（Result），
// 再加局限与编者评注。公式、符号词典、交互图沿用 math/ 下的组件（Eq、Plot、Derivation…）。见 framework/spec/PAPER.md。

export const ROLES = {
  gap: { zh: "缺口", en: "Gap", icon: "🕳️" },
  motivation: { zh: "动机", en: "Motivation", icon: "🎯" },
  solution: { zh: "方案", en: "Solution", icon: "🛠️" },
  result: { zh: "结果", en: "Result", icon: "📊" },
  limits: { zh: "局限", en: "Limits", icon: "⚠️" },
  background: { zh: "背景", en: "Background", icon: "📚" },
  editor: { zh: "编者评注", en: "Editor", icon: "🧐" },
};
// 角色名：英文界面只显示一种名称，中文界面附英文副标
const roleName = r => (lang() === "zh" ? r.zh : r.en);
const rich = x => (typeof x === "string" ? <TxI>{x}</TxI> : x);
// 块级内容：字符串（或字符串与 JSX 混排的子节点）中的字符串部分按 Tx 渲染（支持 $…$、段落）
const block = c => (typeof c === "string" ? <Tx>{c}</Tx> : Array.isArray(c) ? c.map((x, i) => (typeof x === "string" ? (x.trim() ? <Tx key={i}>{x}</Tx> : null) : x)) : c);

// 论文页外壳。meta 除 TextbookPage 的字段外，另有 paper: { title, authors, venue, year, arxiv, doi, code, license }、
// tldr（一句话说清这篇论文）、gmsr: { gap, motivation, solution, result }（四格速读，各 1–2 句）。
export function PaperPage({ meta: m, notation = [], groups, concepts, relations, children, keyEquations = true }) {
  useEffect(() => { document.title = `${m.title_zh || m.title_en} · ${book.title}`; }, [m]);
  const p = m.paper || book.paper || {};
  return (
    <ChapterProvider meta={m} groups={groups} concepts={concepts} relations={relations}>
      <TextbookProvider chapterId={m.id} notation={notation}>
        <Progress />
        <TopBar id={m.id} />
        <Toc />
        <main className="tb pp">
          <header className="tb-hero pp-hero" id="b-top" data-toc={t("toc.quick")}>
            <div className="kicker">{t("pp.kicker")}{m.label ? ` · ${m.label}` : ""}</div>
            <h1>{m.title_zh || m.title_en}</h1>
            {p.title && p.title !== (m.title_zh || m.title_en) && <div className="en">{p.title}</div>}
            <PaperCite p={p} />
            {m.tldr && <div className="pp-tldr"><small>{t("pp.tldr")}</small><TxI>{m.tldr}</TxI></div>}
            {m.gmsr && <GMSR {...m.gmsr} />}
            {m.overview && <div className="tb-overview"><Tx>{m.overview}</Tx></div>}
            {m.prereq?.length > 0 && <div className="tb-meta-row"><div className="tb-pre"><b>{t("pp.prereq")}</b><ul>{m.prereq.map((x, i) => <li key={i}><TxI>{x.what || x}</TxI></li>)}</ul></div></div>}
            <div className="tb-tip">{t("pp.tip")}</div>
          </header>
          {children}
          {keyEquations && <section className="tb-sec" id="b-keyeq" data-toc={t("toc.keyFormulas")}>
            <h2 className="tb-h2">{t("pp.keyeq")}</h2>
            <KeyEquations />
          </section>}
          {notation?.length > 0 && <section className="tb-sec" id="b-notation" data-toc={t("toc.notation")}>
            <h2 className="tb-h2">{t("pp.notation")}</h2>
            <Notation rows={notation} />
          </section>}
          <ChapterNav id={m.id} />
          <footer>{book.footer ?? t("footer.paper")}</footer>
        </main>
      </TextbookProvider>
    </ChapterProvider>);
}

export function PaperCite({ p }) {
  if (!p?.title && !p?.authors) return null;
  const links = [p.arxiv && ["arXiv", `https://arxiv.org/abs/${p.arxiv}`], p.doi && ["DOI", `https://doi.org/${p.doi}`], p.code && [t("pp.code"), p.code]].filter(Boolean);
  return (
    <div className="pp-cite">
      <span>{Array.isArray(p.authors) ? p.authors.join(", ") : p.authors}</span>
      {(p.venue || p.year) && <span> · {[p.venue, p.year].filter(Boolean).join(" ")}</span>}
      {links.map(([t, u]) => <a key={t} href={u} target="_blank" rel="noreferrer">{t} ↗</a>)}
      {p.license && <span className="pp-lic">{p.license}</span>}
    </div>);
}

// 四格速读：Gap / Motivation / Solution / Result。点击跳到对应 <PaperSec role>。
export function GMSR({ gap, motivation, solution, result }) {
  const items = [["gap", gap], ["motivation", motivation], ["solution", solution], ["result", result]].filter(([, v]) => v);
  return (
    <div className="pp-gmsr">
      {items.map(([r, v], i) => (
        <a key={r} className={"pp-g pp-r-" + r} href={"#role-" + r}>
          <div className="pp-g-h"><span className="pp-g-n">{i + 1}</span>{ROLES[r].icon} {roleName(ROLES[r])}{lang() === "zh" && <small>{ROLES[r].en}</small>}</div>
          <div className="pp-g-b">{rich(v)}</div>
        </a>))}
    </div>);
}

// 按论证角色着色的大节。role ∈ gap | motivation | solution | result | limits | background | editor。
// 每种 role 的第一节获得锚点 role-<role>（供 GMSR 跳转）。
const seenRoles = new Map();   // 本页各角色已出现次数（每个页面是独立的静态页，模块级计数即可）
export function PaperSec({ role, id, title, lead, children }) {
  const r = ROLES[role] || ROLES.background;
  const [autoId] = useState(() => { const k = (seenRoles.get(role) || 0) + 1; seenRoles.set(role, k); return k === 1 ? "role-" + role : `role-${role}-${k}`; });
  return (
    <section className={"tb-sec pp-sec pp-r-" + role} id={id || autoId} data-toc={`${roleName(r)}${title ? t("p.colon") + title.replace(/\$[^$]*\$/g, "") : ""}`}>
      <div className="pp-sec-tag">{r.icon} {lang() === "zh" ? `${r.zh} · ${r.en}` : r.en}</div>
      {title && <h2 className="tb-h2"><TxI>{title}</TxI></h2>}
      {lead && <p className="lead"><TxI>{lead}</TxI></p>}
      {children}
    </section>);
}

// 缺口图：已有方法各自能做到 / 做不到什么，最后一行是本文。
// rows: [{ name, does, misses, ours? }]；criteria（可选）: ["可扩展", "刻画相关噪声", …] 与 rows[i].marks: [true,false,"partial"]
export function GapMap({ rows, criteria, gap }) {
  return (
    <div className="pp-gap">
      {criteria ? (
        <div className="pp-gap-tw"><table className="pp-gap-t">
          <thead><tr><th>{t("pp.method")}</th>{criteria.map((c, i) => <th key={i}><TxI>{c}</TxI></th>)}</tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i} className={r.ours ? "ours" : ""}>
              <td><b>{rich(r.name)}</b>{r.note && <div className="pp-gap-note">{rich(r.note)}</div>}</td>
              {r.marks.map((x, j) => <td key={j} className={"mk " + (x === true ? "y" : x === false ? "n" : "p")}>{x === true ? "✓" : x === false ? "✗" : "△"}</td>)}
            </tr>))}</tbody>
        </table></div>
      ) : (
        <div className="pp-gap-rows">{rows.map((r, i) => (
          <div key={i} className={"pp-gap-row" + (r.ours ? " ours" : "")}>
            <div className="nm">{rich(r.name)}</div>
            <div className="does"><small>{t("pp.does")}</small>{rich(r.does)}</div>
            <div className="miss"><small>{r.ours ? t("pp.oursFills") : t("pp.misses")}</small>{rich(r.misses)}</div>
          </div>))}</div>
      )}
      {gap && <div className="pp-gap-stmt"><small>{t("pp.gap")}</small>{rich(gap)}</div>}
    </div>);
}

// 动机的因果链：如果 … → 就 …。chain: [{ if, then }] 或字符串数组（依次以箭头相连）。
export function Stakes({ chain, payoff }) {
  return (
    <div className="pp-stakes">
      {chain.map((c, i) => (
        <div key={i} className="pp-st">
          {typeof c === "string" ? <div className="pp-st-b">{rich(c)}</div>
            : <><div className="pp-st-if"><small>{t("pp.if")}</small>{rich(c.if)}</div><div className="pp-st-then"><small>{t("pp.then")}</small>{rich(c.then)}</div></>}
          {i < chain.length - 1 && <div className="pp-st-arr">↓</div>}
        </div>))}
      {payoff && <div className="pp-st-pay"><small>{t("pp.payoff")}</small>{rich(payoff)}</div>}
    </div>);
}

// 一句话核心想法（全文最该记住的那一招），可附类比。
export const KeyIdea = ({ title = t("pp.keyIdea"), children, analogy }) => (
  <div className="pp-key">
    <div className="pp-key-h">💡 {title}</div>
    <div className="pp-key-b">{block(children)}</div>
    {analogy && <div className="pp-key-an"><small>{t("pp.analogy")}</small>{rich(analogy)}</div>}
  </div>);

// 方法流程：steps [{ title, what, why, out, detail? }]；点一步展开 detail（任意 JSX，可放 Eq / 交互图）。
export function Pipeline({ steps, open: open0 = -1, layout = "wrap" }) {
  const [open, setOpen] = useState(open0);
  return (
    <div className="pp-pipe">
      <div className={"pp-pipe-row pp-pipe-" + layout}>
        {steps.map((s, i) => (
          <button key={i} className={"pp-step" + (open === i ? " on" : "")} onClick={() => setOpen(open === i ? -1 : i)}>
            <span className="pp-step-n">{i + 1}</span>
            <b><TxI>{s.title}</TxI></b>
            <span className="pp-step-w">{rich(s.what)}</span>
            {s.out && <span className="pp-step-o">→ {rich(s.out)}</span>}
          </button>))}
      </div>
      {open >= 0 && steps[open] && (
        <div className="pp-pipe-d">
          <div className="pp-pipe-dh">{t("pp.step", open + 1)} · <TxI>{steps[open].title}</TxI></div>
          {steps[open].why && <p><b>{t("pp.whyThis")}</b><TxI>{steps[open].why}</TxI></p>}
          {steps[open].detail && block(steps[open].detail)}
        </div>)}
      <div className="pp-pipe-hint">{t("pp.pipeHint")}</div>
    </div>);
}

// 关键数字。items: [{ value, label, note? }]
export const Headline = ({ items }) => (
  <div className="pp-head">{items.map((x, i) => (
    x.href ? <a key={i} className="pp-num" href={x.href}><b>{rich(x.value)}</b><span>{rich(x.label)}</span>{x.note && <small>{rich(x.note)}</small>}</a>
      : <div key={i} className="pp-num"><b>{rich(x.value)}</b><span>{rich(x.label)}</span>{x.note && <small>{rich(x.note)}</small>}</div>))}</div>);

// 主张 ↔ 证据。strength: "strong" | "moderate" | "weak"（编者对证据强度的判断）；caveat: 限定条件。
const STRENGTH_CLASS = { strong: "s", moderate: "m", weak: "w" };
const strengthOf = s => { const k = STRENGTH_CLASS[s] ? s : "moderate"; return [t("pp.strength")[k], STRENGTH_CLASS[k]]; };
export function Claim({ id, claim, strength = "moderate", caveat, where, children }) {
  const [lab, cls] = strengthOf(strength);
  return (
    <div className={"pp-claim pp-c-" + cls} id={id ? "claim-" + id : undefined}>
      <div className="pp-claim-h"><span className="pp-claim-tag">{t("pp.claim")}{id ? " " + id : ""}</span><b>{rich(claim)}</b><span className={"pp-badge " + cls}>{lab}</span></div>
      <div className="pp-claim-ev"><div className="pp-claim-evh">{t("pp.evidence")}{where ? <small>{t("pp.where", where)}</small> : null}</div>{block(children)}</div>
      {caveat && <div className="pp-claim-cv"><small>{t("pp.caveat")}</small>{rich(caveat)}</div>}
    </div>);
}

// 主张总览：claims [{ id, claim, strength }]，点击跳到对应 <Claim id>。
export const ClaimBoard = ({ claims }) => (
  <div className="pp-board">{claims.map(c => {
    const [lab, cls] = strengthOf(c.strength);
    return <a key={c.id} href={"#claim-" + c.id} className={"pp-bd pp-c-" + cls}><span className="pp-claim-tag">{c.id}</span><span>{rich(c.claim)}</span><span className={"pp-badge " + cls}>{lab}</span></a>;
  })}</div>);

// 局限与开放问题。
export const Limits = ({ limits = [], open = [] }) => (
  <div className="pp-limits">
    <div><h4>{t("pp.limits")}</h4><ul>{limits.map((x, i) => <li key={i}>{rich(x)}</li>)}</ul></div>
    {open.length > 0 && <div><h4>{t("pp.open")}</h4><ul>{open.map((x, i) => <li key={i}>{rich(x)}</li>)}</ul></div>}
  </div>);

// 编者评注（明确标注为本站观点）：strengths / concerns / questions。
export const EditorView = ({ strengths = [], concerns = [], questions = [] }) => (
  <div className="pp-editor">
    <div className="pp-ed-note">{t("pp.editorNote")}</div>
    <div className="pp-ed-cols">
      {strengths.length > 0 && <div className="s"><h4>{t("pp.strengths")}</h4><ul>{strengths.map((x, i) => <li key={i}>{rich(x)}</li>)}</ul></div>}
      {concerns.length > 0 && <div className="c"><h4>{t("pp.concerns")}</h4><ul>{concerns.map((x, i) => <li key={i}>{rich(x)}</li>)}</ul></div>}
      {questions.length > 0 && <div className="q"><h4>{t("pp.questions")}</h4><ul>{questions.map((x, i) => <li key={i}>{rich(x)}</li>)}</ul></div>}
    </div>
  </div>);

// 原文导航：本页各部分对应原文哪些节，以及不同目的该读哪里。rows: [{ goal, read, skip? }]
export const ReadingGuide = ({ rows }) => (
  <div className="pp-guide"><table><thead><tr><th>{t("pp.goal")}</th><th>{t("pp.read")}</th><th>{t("pp.skip")}</th></tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}><td>{rich(r.goal)}</td><td>{rich(r.read)}</td><td>{rich(r.skip || "—")}</td></tr>)}</tbody></table></div>);
