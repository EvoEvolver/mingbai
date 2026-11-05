import { t } from "./i18n/index.js";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { book } from "./book.jsx";
import { FEEDBACK_EMAIL } from "./site.js";

// 选中文字 → 悬浮"反馈"按钮 → 反馈面板 → mailto: 打开读者的邮件客户端（收件人、标题、正文已填好）。
// 正文包含：页面地址、页面标题、选中的纯文本、读者的反馈与（可选）联系方式。纯静态，无需后端。
// 收件地址：kit/site.js 的 FEEDBACK_EMAIL，单本书可在 book.js 用 feedbackEmail 覆盖；为空则不启用。
const MAX_SEL = 600;   // mailto 链接过长时部分邮件客户端会截断，选中内容只带前 600 字

function selectionInfo() {
  const s = window.getSelection();
  if (!s || s.isCollapsed || !s.rangeCount) return null;
  const text = s.toString().replace(/\s+\n/g, "\n").trim();
  if (!text) return null;
  const n = s.anchorNode, el = n?.nodeType === 1 ? n : n?.parentElement;
  if (el?.closest?.(".fb-panel, input, textarea, [contenteditable]")) return null;
  const r = s.getRangeAt(0).getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { text, x: r.left + r.width / 2, top: r.top, bottom: r.bottom };
}

export default function Feedback() {
  const to = book?.feedbackEmail ?? FEEDBACK_EMAIL;
  const [btn, setBtn] = useState(null);       // 悬浮按钮 {text, x, top, bottom}
  const [panel, setPanel] = useState(null);   // 面板 {text}
  const [msg, setMsg] = useState("");
  const [contact, setContact] = useState("");
  const [copied, setCopied] = useState(false);
  const area = useRef(null);

  useEffect(() => {
    if (!to) return;
    const update = () => setTimeout(() => setBtn(selectionInfo()), 0);
    const hide = () => setBtn(null);
    document.addEventListener("mouseup", update);
    document.addEventListener("keyup", update);
    document.addEventListener("touchend", update);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("mouseup", update);
      document.removeEventListener("keyup", update);
      document.removeEventListener("touchend", update);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [to]);

  useEffect(() => {
    if (!panel) return;
    area.current?.focus();
    const onKey = e => { if (e.key === "Escape") setPanel(null); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [panel]);

  if (!to) return null;

  const open = () => { setPanel({ text: btn.text }); setBtn(null); setMsg(""); setCopied(false); window.getSelection()?.removeAllRanges(); };
  const sel = panel ? (panel.text.length > MAX_SEL ? panel.text.slice(0, MAX_SEL) + t("fb.truncated") : panel.text) : "";
  const body = () => [
    `${t("fb.page")}${location.href}`,
    `${t("fb.pageTitle")}${document.title}`,
    "",
    t("fb.selected"),
    sel,
    "",
    t("fb.feedback"),
    msg.trim() || t("fb.empty"),
    ...(contact.trim() ? ["", `${t("fb.contact")}${contact.trim()}`] : []),
  ].join("\n");
  const send = () => {
    const subject = t("fb.subject", document.title);
    location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body())}`;
  };
  const copy = () => { navigator.clipboard?.writeText(`${t("fb.to")}${to}\n${body()}`).then(() => setCopied(true)); };

  const below = btn && btn.top < 56;
  return createPortal(<>
    {btn && !panel && (
      <button className="fb-float" style={{ left: btn.x, top: below ? btn.bottom + 8 : btn.top - 40 }}
        onMouseDown={e => e.preventDefault()} onClick={open} title={t("fb.floatTitle")}>
        {t("fb.float")}
      </button>
    )}
    {panel && (
      <div className="fb-panel" role="dialog" aria-label={t("fb.aria")}>
        <div className="fb-head">
          <b>{t("fb.head")}</b>
          <button className="fb-x" onClick={() => setPanel(null)} aria-label={t("ui.close")}>×</button>
        </div>
        <div className="fb-label">{t("fb.selLabel")}</div>
        <blockquote className="fb-sel">{sel}</blockquote>
        <div className="fb-label">{t("fb.yours")}</div>
        <textarea ref={area} value={msg} onChange={e => setMsg(e.target.value)} rows={5}
          placeholder={t("fb.placeholder")} />
        <input value={contact} onChange={e => setContact(e.target.value)} placeholder={t("fb.contactPh")} />
        <div className="fb-actions">
          <button className="fb-send" onClick={send} disabled={!msg.trim()}>{t("fb.send")}</button>
          <button onClick={copy}>{copied ? t("ui.copied") : t("fb.copy")}</button>
        </div>
        <div className="fb-note">{t("fb.note", to)}</div>
      </div>
    )}
  </>, document.body);
}
