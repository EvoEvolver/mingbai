import zh from "./zh.js";
import en from "./en.js";

// 已支持的界面语言。book.js 的 lang 取这里的键；缺省为 zh。
export const MESSAGES = { zh, en };
export const DEFAULT_LANG = "zh";
export const langOf = book => (MESSAGES[book?.lang] ? book.lang : DEFAULT_LANG);
