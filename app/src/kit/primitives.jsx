import { t } from "./i18n/index.js";
import { useState } from "react";
import { useReveal } from "./core.jsx";

// Building blocks for custom visualizations.

// Callout. tone: info | warn | key | quote
export const Callout = ({ tone = "info", title, children }) => (
  <div className={"callout " + tone}>{title && <b>{title}</b>}<div>{children}</div></div>);

// White card
export const Card = ({ children, style, className = "", onClick }) => (
  <div className={"card " + className} style={style} onClick={onClick}>{children}</div>);

// Responsive grid
export const Grid = ({ min = 240, gap = 16, children }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${min}px,1fr))`, gap }}>{children}</div>);

// Fade in and rise on entering the viewport
export function Reveal({ children, delay = 0 }) {
  const [ref, vis] = useReveal(.3);
  return <div ref={ref} className={"reveal" + (vis ? " vis" : "")} style={{ transitionDelay: delay + "ms" }}>{children}</div>;
}

// Tabs. tabs: [{label, content}]
export function Tabs({ tabs }) {
  const [i, setI] = useState(0);
  return <div className="card">
    <div className="tabs">{tabs.map((t, j) => <button key={j} className={i === j ? "on" : ""} onClick={() => setI(j)}>{t.label}</button>)}</div>
    <div className="tabpane">{tabs[i].content}</div>
  </div>;
}

// Stepper: walk through a process with previous/next. steps: [{label, content}]
// render(i) is optional: renders a step-dependent figure (e.g. SVG) above the step content; i is the current step.
export function StepThrough({ steps, render }) {
  const [i, setI] = useState(0);
  return <div className="card stepthrough">
    {render && <div className="st-visual">{render(i)}</div>}
    <div className="st-dots">{steps.map((s, j) => <button key={j} className={j === i ? "on" : j < i ? "done" : ""} onClick={() => setI(j)}>{j + 1}. {s.label}</button>)}</div>
    <div className="st-body">{steps[i].content}</div>
    <div className="st-ctrl">
      <button disabled={i === 0} onClick={() => setI(i - 1)}>{t("ui.prevStep")}</button>
      <span>{i + 1} / {steps.length}</span>
      <button disabled={i === steps.length - 1} onClick={() => setI(i + 1)}>{t("ui.nextStep")}</button>
    </div>
  </div>;
}

// Two-state toggle (e.g. classical ⇄ modern); children(state) renders the content
export function Toggle({ options, children }) {
  const [v, setV] = useState(0);
  return <div className="card">
    <div className="seg">{options.map((o, j) => <button key={j} className={v === j ? "on" : ""} onClick={() => setV(j)}>{o}</button>)}</div>
    <div className="seg-body">{children(v)}</div>
  </div>;
}

// Horizontal timeline. events: [{year, label, note}]; click to see the note
export function Timeline({ events }) {
  const [i, setI] = useState(null);
  return <div className="card">
    <div className="tl">{events.map((e, j) =>
      <button key={j} className={"tl-ev" + (i === j ? " on" : "")} onClick={() => setI(i === j ? null : j)}>
        <span className="tl-y">{e.year}</span><span className="tl-dot" /><span className="tl-l">{e.label}</span>
      </button>)}</div>
    {i !== null && events[i].note && <div className="tl-note">{events[i].note}</div>}
  </div>;
}
