import { book } from "virtual:book";
import { MESSAGES, DEFAULT_LANG, langOf } from "./messages.js";

// UI strings for components. The language is per book (`lang` in book.js, en by default), so a book has one UI language.
// Book content itself is not translated. `book` must be read at call time because it may still be in a circular import
// while modules initialize, so don't call t() or lang() at module top level.
export const lang = () => langOf(book);

// t("nav.prev"); sentences with arguments: t("ch.no", 3). A key missing from the current language falls back to the default language.
export function t(key, ...args) {
  const m = MESSAGES[lang()][key] ?? MESSAGES[DEFAULT_LANG][key];
  if (m === undefined) return key;
  return typeof m === "function" ? m(...args) : m;
}
