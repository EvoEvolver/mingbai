#!/usr/bin/env python3
"""Textbook chapter completeness check: compares equation, figure, and exercise numbers in the source book's text layer against the chapter JSX.
Usage: tb_check.py <BOOK_DIR> <chapterId>
- Equations: each numbered display equation appears in the text layer as "(n.m)" at the end of a line; the JSX should have <Eq n="n.m">
- Figures: figures of this chapter in public/figures/figures.json; the JSX should have <Figure n="n.m">
- Exercises: "n.m" numbers after "Exercises" in the text layer; the JSX should have <Exercise n="n.m">
- References: this-chapter equations targeted by \\eqref{x} in the JSX must exist
Optional per-book config <BOOK>/check.json (theorem-proof textbooks, e.g. Nakahara):
  {"problems_heading": "Problems",           heading of the end-of-chapter problems section (default "Exercises")
   "problem_prefix": "P",                    JSX number prefix of end-of-chapter problems: <Exercise n="P5.1">
   "inline_exercise": "Exercise",            "Exercise 5.1." in the body → <Exercise n="5.1">
   "statements": {"Definition": "D", ...},   "Definition 5.1." in the body → <Stmt id="D5.1">
   "examples": "Example",                    "Example 5.1." in the body → <Box kind="example" n="5.1">
   "eq_regex": "…"}                          regex for equation numbers in the text layer (one capture group), defaults to (chapter.number)
"""
import json, re, sys, os
book, cid = sys.argv[1], sys.argv[2]
chs = {c["id"]: c for c in json.load(open(os.path.join(book, "chapters.json")))}
c = chs[cid]
text = open(os.path.join(book, "text", cid + ".txt"), encoding="utf-8").read()
for a, b in {"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl"}.items(): text = text.replace(a, b)   # restore typographic ligatures
jsx = open(os.path.join(book, "chapters", cid + ".jsx"), encoding="utf-8").read()
for f in os.listdir(os.path.join(book, "chapters")):
    if f.startswith(f"_{cid}_") and f.endswith(".jsx"):
        jsx += open(os.path.join(book, "chapters", f), encoding="utf-8").read()
prefix = cid[2:].lstrip("0") if cid.startswith("ch") else cid[3:]
P = re.escape(prefix)

def natkey(s): return [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", s)]

cfg_path = os.path.join(book, "check.json")
cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else {}
# Split body and exercises (equation numbers like (2.xx) in the exercises also count for this chapter)
ex_split = re.split(rf"\n\s*{re.escape(cfg.get('problems_heading', 'Exercises'))}\s*\n", text, maxsplit=1)
body, exer = (ex_split + [""])[:2]
eq_book = set(re.findall(cfg["eq_regex"] if cfg.get("eq_regex") else rf"\(({P}\.\d+[a-z]?)\)\s*$", text, re.M))   # eq_regex in check.json can override the number format
eq_jsx = set(re.findall(r'<(?:Eq|FormulaMap)\b[^>]*\bn="([^"]+)"', jsx))
_fj = os.path.join(book, "public/figures/figures.json")
fig_book = {f["num"] for f in json.load(open(_fj)) if f["num"].split(".")[0] == prefix} if os.path.exists(_fj) else set()
fig_jsx = set(re.findall(r'<Figure\b[^>]*\bn="([^"]+)"', jsx))
PP = cfg.get("problem_prefix", "")
ex_book = {PP + x for x in re.findall(rf"^\s*({P}\.\d+)\.?\s", exer, re.M)} if exer else set()
ex_jsx = set(re.findall(r'<Exercise\b[^>]*\bn="([^"]+)"', jsx))
refs = set(re.findall(r"\\eqref\{([^}]+)\}", jsx)) | set(re.findall(r'<EqRef\b[^>]*n="([^"]+)"', jsx))
bad_refs = {r for r in refs if r.split(".")[0] == prefix and r not in eq_jsx}

def report(name, want, have):
    miss, extra = sorted(want - have, key=natkey), sorted(have - want, key=natkey)
    print(f"{name}: book {len(want)}, page {len(have)}, missing {len(miss)}" + (f" → {', '.join(miss)}" if miss else "") + (f"; extra {', '.join(extra)}" if extra else ""))
    return len(miss)
if cfg.get("inline_exercise"):   # merge in-text exercises with end-of-chapter exercises
    ex_book |= set(re.findall(rf"^[^\w\n]{{0,4}}\s*{cfg['inline_exercise']}\s+({P}\.\d+)\.", body, re.M))
bad = report("Equations", eq_book, eq_jsx) + report("Figures", fig_book, fig_jsx) + report("Exercises", ex_book, ex_jsx)
if cfg.get("statements"):
    st_book = set()
    for word, pre in cfg["statements"].items():
        st_book |= {pre + x for x in re.findall(rf"^[^\w\n]{{0,4}}\s*{word}\s+({P}\.\d+)\.", body, re.M)}
    st_jsx = set(re.findall(r'<Stmt\b[^>]*\bid="([^"]+)"', jsx))
    bad += report("Statements (definitions, theorems, etc.)", st_book, st_jsx)
if cfg.get("examples"):
    exm_book = set(re.findall(rf"^[^\w\n]{{0,4}}\s*{cfg['examples']}\s+({P}\.\d+)\.", body, re.M))
    exm_jsx = set(re.findall(r'<Box\b[^>]*\bkind="example"[^>]*\bn="([^"]+)"', jsx)) | set(re.findall(r'<Box\b[^>]*\bn="([^"]+)"[^>]*\bkind="example"', jsx))
    bad += report("Examples", exm_book, exm_jsx)
if bad_refs: print("Dangling references (equations not in this chapter):", ", ".join(sorted(bad_refs, key=natkey))); bad += len(bad_refs)
# ---- Structure checks (high-level understanding layer + equation readings + section key points) ----
eq_tags = re.findall(r"<(?:Eq|FormulaMap)\b([^>]*)>", jsx)
no_say = [re.search(r'n="([^"]+)"', a).group(1) for a in eq_tags if re.search(r'\bn="', a) and "say=" not in a]
if no_say: print(f"Equations without say ({len(no_say)}): {', '.join(sorted(no_say, key=natkey)[:30])}{' …' if len(no_say) > 30 else ''}"); bad += len(no_say)
secs = re.findall(r"<Sec\b([^>]*)>", jsx)
no_gist = [re.search(r'n="([^"]+)"', a).group(1) for a in secs if 'n="' in a and "gist=" not in a and "习题" not in a and "Exercises" not in a and ".E" not in a]
if no_gist: print("Sections without gist:", ", ".join(no_gist)); bad += len(no_gist)
for comp in ["Hook", "Roadmap", "EqMap", "ConceptGrid", "Takeaways", "Quiz", "Bridge"]:
    if not re.search(rf"<{comp}\b", jsx): print(f"Missing component <{comp}>"); bad += 1
for f in ["one_liner", "big_question", "why_it_matters"]:
    if not re.search(rf"\b{f}\s*:", jsx): print(f"meta is missing {f}"); bad += 1
if not re.search(r"export const concepts\b", jsx): print("Missing export const concepts"); bad += 1
# ---- Math spelled in Unicode in reader-visible text (should be written as $…$) ----
import subprocess, glob as _g
_files = [os.path.join(book, "chapters", cid + ".jsx")] + sorted(_g.glob(os.path.join(book, "chapters", f"_{cid}_*.jsx")))
_r = subprocess.run([sys.executable, "-I", os.path.join(os.path.dirname(os.path.abspath(__file__)), "unicode_math.py"), *_files, "--quiet"], capture_output=True, text=True)
_n = int(re.search(r"(\d+) 处", _r.stdout).group(1)) if re.search(r"(\d+) 处", _r.stdout) else 0
if _n:
    print(f"Math spelled in Unicode: {_n} (use $…$ instead; details: python3 -I spec/unicode_math.py <file>)"); bad += _n
print("OK" if not bad else f"{bad} problems in total")
sys.exit(1 if bad else 0)
