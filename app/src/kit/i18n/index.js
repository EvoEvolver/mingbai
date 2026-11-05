import { book } from "virtual:book";
import { MESSAGES, DEFAULT_LANG, langOf } from "./messages.js";

// 组件界面文字的多语言。语言按书决定（book.js 的 lang，缺省 zh），一本书只有一种界面语言；书的内容本身不做多语言。
// book 要在调用时读取（模块初始化时可能还处在循环导入中），所以不要在模块顶层调用 t() / lang()。
export const lang = () => langOf(book);

// t("nav.prev")；带参数的句子：t("ch.no", 3)。当前语言缺这个键时退回默认语言。
export function t(key, ...args) {
  const m = MESSAGES[lang()][key] ?? MESSAGES[DEFAULT_LANG][key];
  if (m === undefined) return key;
  return typeof m === "function" ? m(...args) : m;
}
