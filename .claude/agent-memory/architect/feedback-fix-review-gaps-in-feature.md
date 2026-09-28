---
name: feedback-fix-review-gaps-in-feature
description: The user prefers closing correctness and security gaps found in review inside the running feature (small extra phase) over recording them as open debt
metadata:
  type: feedback
---

When a phase 5 review finds a silent-wrong-data or resource-exhaustion gap in the feature under work, the user chose to fix it in the same feature with a small extra phase, not to record open debt: 2026-09-28, `products-excel-upload` decisions 18 (repeated header column, option (a)) and 19 (zip bomb, "protect now", although the caller is an authenticated editor and no deployment exists).

**Why:** the user rejected "debt now, decide at deployment" even when the architect recommended it; a feature is not done while it knowingly writes wrong data or can exhaust memory.

**How to apply:** for such findings, recommend the in-feature fix with a costed phase (steps, test count per phase, no contract change stated), and offer debt only as the alternative. Stop conditions the user set for such amendments: a new npm dependency, a contract or UI change, or a pattern deviation without an obvious row go back to the user as options first. See [[excel-import-mechanism]].
