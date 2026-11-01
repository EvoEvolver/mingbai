import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { book } from "./book.jsx";
import { FEEDBACK_EMAIL, SITE_NAME } from "./site.js";

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
  const sel = panel ? (panel.text.length > MAX_SEL ? panel.text.slice(0, MAX_SEL) + "…（已截断）" : panel.text) : "";
  const body = () => [
    `页面：${location.href}`,
    `标题：${document.title}`,
    "",
    "【选中的内容】",
    sel,
    "",
    "【反馈】",
    msg.trim() || "（未填写）",
    ...(contact.trim() ? ["", `【联系方式】${contact.trim()}`] : []),
  ].join("\n");
  const send = () => {
    const subject = `[${SITE_NAME} 反馈] ${document.title}`;
    location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body())}`;
  };
  const copy = () => { navigator.clipboard?.writeText(`收件人：${to}\n${body()}`).then(() => setCopied(true)); };

  const below = btn && btn.top < 56;
  return createPortal(<>
    {btn && !panel && (
      <button className="fb-float" style={{ left: btn.x, top: below ? btn.bottom + 8 : btn.top - 40 }}
        onMouseDown={e => e.preventDefault()} onClick={open} title="对选中的内容提出反馈或纠错">
        ✎ 反馈
      </button>
    )}
    {panel && (
      <div className="fb-panel" role="dialog" aria-label="反馈">
        <div className="fb-head">
          <b>反馈 / 纠错</b>
          <button className="fb-x" onClick={() => setPanel(null)} aria-label="关闭">×</button>
        </div>
        <div className="fb-label">选中的内容</div>
        <blockquote className="fb-sel">{sel}</blockquote>
        <div className="fb-label">你的反馈</div>
        <textarea ref={area} value={msg} onChange={e => setMsg(e.target.value)} rows={5}
          placeholder="哪里有误、哪里看不懂、有什么建议……" />
        <input value={contact} onChange={e => setContact(e.target.value)} placeholder="联系方式（可选）" />
        <div className="fb-actions">
          <button className="fb-send" onClick={send} disabled={!msg.trim()}>用邮件发送</button>
          <button onClick={copy}>{copied ? "已复制" : "复制内容"}</button>
        </div>
        <div className="fb-note">点击"用邮件发送"会打开你的邮件程序，内容已填好，确认后发送即可；没有邮件程序时可复制内容，发送到 {to}。页面地址会一并附上。</div>
      </div>
    )}
  </>, document.body);
}
