#!/usr/bin/env python3
"""扫描章节 JSX 中「用 Unicode 拼写的数学」（应改写为 $…$ KaTeX）。
用法: unicode_math.py FILE... [--quiet]   → 打印 文件:行: 片段，并以出现处数作为退出码上限 1
规则：
- 只检查字符串/模板字符串中的读者可见文字；`$…$`、`$$…$$` 内部与 R`…` 中以反斜杠命令写成的 TeX 不算。
- 命中字符：希腊字母、上下标数字/字母、数学运算符（∝ ≈ ≤ ≥ ≪ ≫ √ ∫ ∑ ∏ ∂ ∇ · × ± ∓ → ⟶ ⟨ ⟩ ∞ ′ ″ ⁻ ∈ ⊗ ≡ …）、组合附加符（p̂ ä 等）。
- 中文标点、引号、破折号（— – ·间隔号 在中文语境）不算；度量单位里的 µ 不算。
"""
import re, sys, unicodedata

GREEK = "α-ωΑ-Ωϑϕϵϱϖ"
MATHOPS = "∝≈≃≤≥≪≫√∫∮∑∏∂∇×±∓⟨⟩∞′″‴⁻⁺∈∉⊂⊆⊗⊕≡≠∼∗∘⋅∣∥ℓℏ∀∃∅⌊⌋⌈⌉"
SUPSUB = "⁰¹²³⁴⁵⁶⁷⁸⁹ⁱⁿ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₔₕₖₗₘₙₚₛₜᵢⱼᵣᵤᵥᵦᵧᵨᵩᵪ"
PAT = re.compile(f"[{GREEK}{MATHOPS}{SUPSUB}]|[a-zA-Z][\u0300-\u036f]")
STRINGS = re.compile(r"`(?:\\.|[^`\\])*`|\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'")
MATH = re.compile(r"\$\$[\s\S]*?\$\$|\$[^$]*\$")
# 只出现在代码/注释里的不算：跳过 import 行与 // 注释
def scan(path):
    hits = []
    for ln, line in enumerate(open(path, encoding="utf-8"), 1):
        code = re.sub(r"(^|[^:])//.*$", r"\1", line)
        if code.lstrip().startswith(("import ", "*", "/*")):
            continue
        for m in STRINGS.finditer(code):
            s = m.group(0)[1:-1]
            if s.startswith(("http", "#")) or re.fullmatch(r"[\w\s.,-]*", s):
                continue
            text = MATH.sub("", s)
            for h in PAT.finditer(text):
                a = max(0, h.start() - 18); b = min(len(text), h.end() + 18)
                hits.append((ln, text[a:b].replace("\n", " ")))
                break      # 每个字符串报一次
    return hits

files = [f for f in sys.argv[1:] if not f.startswith("--")]
total = 0
for f in files:
    hs = scan(f)
    total += len(hs)
    if "--quiet" not in sys.argv:
        for ln, frag in hs:
            print(f"{f}:{ln}: …{frag}…")
print(f"Unicode 数学：{total} 处")
sys.exit(1 if total else 0)
