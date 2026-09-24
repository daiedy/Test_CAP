---
name: docs-cyrillic-code-points
description: How to give a Russian i18n value inside SCREENS.md (or a memory file) without tripping the Cyrillic hook - the Write/Edit tools decode backslash-u escapes into the real character, so use U+XXXX code points instead
metadata:
  type: feedback
---

In `docs/**`, in `.claude/agent-memory/**` and in any other English-only file, give a Russian text as space-separated code points (`U+0420 U+0435 ...`), never as the word itself and never as backslash-u escapes.

**Why:** CLAUDE.md invariant 10 forbids Cyrillic outside i18n bundles, `.texts.csv`, asserted test values and quoted UI evidence in `VERIFICATION.md`; `scripts/lib/file-checks.mjs` (`checkCyrillic`) flags every line that contains a character of the Cyrillic Unicode block (U+0400 to U+04FF) on each Write/Edit in that scope. The Write and Edit tools decode a single-backslash `u` escape followed by four hex digits in their parameters into the real character before writing (observed 2026-09-25 on `products-rating-column/SCREENS.md` and on this very memory file, where a quoted regex character class turned into two Cyrillic letters), while a doubled backslash lands as two literal backslashes. There is no way to put a single-backslash escape on disk through these tools.

**How to apply:** in the Texts section write the `ru` value as `U+XXXX` code points plus a Latin transliteration in parentheses, and say that the bundle holds the plain word and the OPA `data/` file holds backslash-u escapes (the project convention for `ru` test data, `CategoryTexts.js`). `test-ui` converts code points to escapes trivially. The same applies to Open questions that offer alternative Russian wordings, and to any regex or example that would spell out a Cyrillic range.
