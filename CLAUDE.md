# Project Conventions

## Arabic language conventions — FINAL, PERMANENT, NO EXCEPTIONS

EVERY piece of Arabic text anywhere in this project — code comments (backend
AND frontend), backend strings, frontend UI text (labels, toasts, messages,
tooltips, placeholders, confirm dialogs), AI prompts, seed/migration data
shown through the UI, log messages, documentation — whether currently
user-visible or not, whether new or existing — MUST ALWAYS be:

1. **Modern Standard Arabic (الفصحى / Fusha) — never colloquial/dialect
   (عامية)**, Iraqi or otherwise.
2. **Masculine grammatical form only — never feminine.**

There is no "comments are exempt" carve-out, no "only user-facing text"
carve-out, no partial scope of any kind. This is the complete, final rule —
it applies to every file in this repository, every existing string, and
every new piece of Arabic text written in this project from now on.

The two example lines directly below intentionally show the WRONG form for
illustration — do not "fix" them, and do not use their presence as a
precedent for leaving any other dialect/feminine text in place elsewhere in
the codebase.

Examples — masculine vs. feminine (never use the feminine form marked ✗):
  "حاول" ✓ not "حاولي" ✗, "تأكد" ✓ not "تأكدي" ✗, "أضف" ✓ not "أضيفي" ✗,
  "راجع" ✓ not "راجعي" ✗.

Examples — Fusha vs. dialect (never use the dialect form marked ✗):
  - "شنو" ✗ (what) → "ماذا" ✓
  - "هسه" ✗ (now) → "الآن" ✓
  - "وين" ✗ (where) → "أين" ✓
  - "شلون" ✗ (how) → "كيف" ✓
  - "اللي" ✗ (relative pronoun) → "الذي" / "التي" / "الذين" ✓ (agree in
    gender/number with what it refers to)
  - "مو" ✗ (not) → "ليس" / "لا" ✓ (conjugate as needed)
  - "بس" ✗ (only/but) → "فقط" / "لكن" ✓
  - "خلص" ✗ (done/finished) → "انتهى" / "تم" ✓
  - "اكو" / "ماكو" ✗ (there is / isn't) → "يوجد" / "لا يوجد" ✓
  - "شغّال" ✗ (working/functioning) → "يعمل" ✓
  - "هذي" / "هاي" ✗ (this) → "هذه" / "هذا" ✓ (per gender)
  - "يشوف" / "تشوف" ✗ (sees) → "يرى" / "ترى" ✓
  - "يقدر" / "تقدر" ✗ (can) → "يستطيع" / "يمكنه" ✓
  - "بعدين" ✗ (then/later) → "لاحقاً" / "بعد ذلك" ✓
  - "يخلص" / "تخلص" ✗ (finishes) → "ينتهي" / "تنتهي" ✓

If you're ever unsure whether a piece of Arabic text (new or existing) is in
dialect or feminine form, check it before shipping — do not guess or leave
it for later. When writing any new Arabic string anywhere in this project —
a comment, a UI label, an AI prompt, a log message, anything — always use
Fusha and masculine form from the start.
