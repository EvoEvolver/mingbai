#!/usr/bin/env python3
"""Scan chapter JSX for "math spelled in Unicode" (should be rewritten as $…$ KaTeX).
Usage: unicode_math.py FILE... [--quiet]   → prints file:line: snippet; exit code is 1 if there are any hits, otherwise 0
Rules:
- Only reader-visible text in strings/template strings is checked; the inside of `$…$` and `$$…$$`, and TeX written with backslash commands in R`…`, don't count.
- Matched characters: Greek letters, superscript/subscript digits and letters, math operators (∝ ≈ ≤ ≥ ≪ ≫ √ ∫ ∑ ∏ ∂ ∇ · × ± ∓ → ⟶ ⟨ ⟩ ∞ ′ ″ ⁻ ∈ ⊗ ≡ …), combining diacritics (p̂, ä, etc.).
- Chinese punctuation, quotation marks, and dashes (— – and the · interpunct in Chinese text) don't count; µ in units of measure doesn't count.
"""
import re, sys, unicodedata

GREEK = "α-ωΑ-Ωϑϕϵϱϖ"
MATHOPS = "∝≈≃≤≥≪≫√∫∮∑∏∂∇×±∓⟨⟩∞′″‴⁻⁺∈∉⊂⊆⊗⊕≡≠∼∗∘⋅∣∥ℓℏ∀∃∅⌊⌋⌈⌉"
SUPSUB = "⁰¹²³⁴⁵⁶⁷⁸⁹ⁱⁿ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₔₕₖₗₘₙₚₛₜᵢⱼᵣᵤᵥᵦᵧᵨᵩᵪ"
PAT = re.compile(f"[{GREEK}{MATHOPS}{SUPSUB}]|[a-zA-Z][\u0300-\u036f]")
STRINGS = re.compile(r"`(?:\\.|[^`\\])*`|\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'")
MATH = re.compile(r"\$\$[\s\S]*?\$\$|\$[^$]*\$")
# Things that appear only in code/comments don't count: skip import lines and // comments
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
                break      # report once per string
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
