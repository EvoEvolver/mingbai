import zh from "./zh.js";
import en from "./en.js";

// Supported UI languages. book.js sets `lang` to one of these keys; the default is en.
export const MESSAGES = { zh, en };
export const DEFAULT_LANG = "en";
export const langOf = book => (MESSAGES[book?.lang] ? book.lang : DEFAULT_LANG);
