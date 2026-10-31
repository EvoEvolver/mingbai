#!/usr/bin/env python3
"""教科书章节完整性校验：把原书文字层里的公式编号、图号、习题号与章节 JSX 逐一比对。
用法: tb_check.py <BOOK_DIR> <chapterId>
- 公式：原书每个带编号的行间公式在文字层中以行末 "(n.m)" 出现；JSX 中应有 <Eq n="n.m">
- 图：public/figures/figures.json 中属于本章的图；JSX 中应有 <Figure n="n.m">
- 习题：文字层 "Exercises" 之后的 "n.m" 编号；JSX 中应有 <Exercise n="n.m">
- 引用：JSX 中 \\eqref{x} 指向的本章公式必须存在
可选的书级配置 <BOOK>/check.json（定理–证明型教科书，如 Nakahara）：
  {"problems_heading": "Problems",           章末习题小节的标题（默认 "Exercises"）
   "problem_prefix": "P",                    章末习题在 JSX 中的编号前缀：<Exercise n="P5.1">
   "inline_exercise": "Exercise",            正文中的 "Exercise 5.1." → <Exercise n="5.1">
   "statements": {"Definition": "D", ...},   正文中的 "Definition 5.1." → <Stmt id="D5.1">
   "examples": "Example",                    正文中的 "Example 5.1." → <Box kind="example" n="5.1">
   "eq_regex": "…"}                          文字层中公式编号的正则（一个捕获组），缺省为 (章.号)
"""
import json, re, sys, os
book, cid = sys.argv[1], sys.argv[2]
chs = {c["id"]: c for c in json.load(open(os.path.join(book, "chapters.json")))}
c = chs[cid]
text = open(os.path.join(book, "text", cid + ".txt"), encoding="utf-8").read()
for a, b in {"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl"}.items(): text = text.replace(a, b)   # 排版连字还原
jsx = open(os.path.join(book, "chapters", cid + ".jsx"), encoding="utf-8").read()
for f in os.listdir(os.path.join(book, "chapters")):
    if f.startswith(f"_{cid}_") and f.endswith(".jsx"):
        jsx += open(os.path.join(book, "chapters", f), encoding="utf-8").read()
prefix = cid[2:].lstrip("0") if cid.startswith("ch") else cid[3:]
P = re.escape(prefix)

def natkey(s): return [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", s)]

cfg_path = os.path.join(book, "check.json")
cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else {}
# 正文与习题分开（习题部分的公式编号形如 (2.xx) 也算本章）
ex_split = re.split(rf"\n\s*{re.escape(cfg.get('problems_heading', 'Exercises'))}\s*\n", text, maxsplit=1)
body, exer = (ex_split + [""])[:2]
eq_book = set(re.findall(cfg["eq_regex"] if cfg.get("eq_regex") else rf"\(({P}\.\d+[a-z]?)\)\s*$", text, re.M))   # check.json 的 eq_regex 可覆盖编号格式
eq_jsx = set(re.findall(r'<Eq\b[^>]*\bn="([^"]+)"', jsx))
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
    print(f"{name}: 原书 {len(want)}，页面 {len(have)}，缺 {len(miss)}" + (f" → {', '.join(miss)}" if miss else "") + (f"；多出 {', '.join(extra)}" if extra else ""))
    return len(miss)
if cfg.get("inline_exercise"):   # 正文习题与章末习题合并比对
    ex_book |= set(re.findall(rf"^[^\w\n]{{0,4}}\s*{cfg['inline_exercise']}\s+({P}\.\d+)\.", body, re.M))
bad = report("公式", eq_book, eq_jsx) + report("插图", fig_book, fig_jsx) + report("习题", ex_book, ex_jsx)
if cfg.get("statements"):
    st_book = set()
    for word, pre in cfg["statements"].items():
        st_book |= {pre + x for x in re.findall(rf"^[^\w\n]{{0,4}}\s*{word}\s+({P}\.\d+)\.", body, re.M)}
    st_jsx = set(re.findall(r'<Stmt\b[^>]*\bid="([^"]+)"', jsx))
    bad += report("陈述（定义/定理等）", st_book, st_jsx)
if cfg.get("examples"):
    exm_book = set(re.findall(rf"^[^\w\n]{{0,4}}\s*{cfg['examples']}\s+({P}\.\d+)\.", body, re.M))
    exm_jsx = set(re.findall(r'<Box\b[^>]*\bkind="example"[^>]*\bn="([^"]+)"', jsx)) | set(re.findall(r'<Box\b[^>]*\bn="([^"]+)"[^>]*\bkind="example"', jsx))
    bad += report("例子", exm_book, exm_jsx)
if bad_refs: print("悬空引用（本章不存在的公式）:", ", ".join(sorted(bad_refs, key=natkey))); bad += len(bad_refs)
# ---- 结构检查（高层理解层 + 公式读法 + 节要点）----
eq_tags = re.findall(r"<Eq\b([^>]*)>", jsx)
no_say = [re.search(r'n="([^"]+)"', a).group(1) for a in eq_tags if re.search(r'\bn="', a) and "say=" not in a]
if no_say: print(f"缺 say 的公式 {len(no_say)} 个: {', '.join(sorted(no_say, key=natkey)[:30])}{' …' if len(no_say) > 30 else ''}"); bad += len(no_say)
secs = re.findall(r"<Sec\b([^>]*)>", jsx)
no_gist = [re.search(r'n="([^"]+)"', a).group(1) for a in secs if 'n="' in a and "gist=" not in a and "习题" not in a and ".E" not in a]
if no_gist: print("缺 gist 的节:", ", ".join(no_gist)); bad += len(no_gist)
for comp in ["Hook", "Roadmap", "EqMap", "ConceptGrid", "Takeaways", "Quiz", "Bridge"]:
    if not re.search(rf"<{comp}\b", jsx): print(f"缺少组件 <{comp}>"); bad += 1
for f in ["one_liner", "big_question", "why_it_matters"]:
    if not re.search(rf"\b{f}\s*:", jsx): print(f"meta 缺少 {f}"); bad += 1
if not re.search(r"export const concepts\b", jsx): print("缺少 export const concepts"); bad += 1
# ---- 读者可见文字中的 Unicode 数学（应写成 $…$）----
import subprocess, glob as _g
_files = [os.path.join(book, "chapters", cid + ".jsx")] + sorted(_g.glob(os.path.join(book, "chapters", f"_{cid}_*.jsx")))
_r = subprocess.run([sys.executable, "-I", os.path.join(os.path.dirname(os.path.abspath(__file__)), "unicode_math.py"), *_files, "--quiet"], capture_output=True, text=True)
_n = int(re.search(r"(\d+) 处", _r.stdout).group(1)) if re.search(r"(\d+) 处", _r.stdout) else 0
if _n:
    print(f"Unicode 拼写的数学 {_n} 处（应改为 $…$；明细：python3 -I spec/unicode_math.py <文件>）"); bad += _n
print("OK" if not bad else f"共 {bad} 处问题")
sys.exit(1 if bad else 0)
