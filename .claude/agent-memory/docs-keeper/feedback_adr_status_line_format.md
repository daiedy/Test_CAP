---
name: feedback-adr-status-line-format
description: ADR acceptance must replace the whole Status sentence, never append to what the architect wrote as "proposed".
metadata:
  type: feedback
---

When an ADR moves from proposed to accepted, the `Status:` sentence on line 3 must be fully replaced with the `templates/adr.md` form used by every accepted ADR in this project: `Date: YYYY-MM-DD. Status: accepted (user, YYYY-MM-DD, feature \`<name>\`).` (see ADR-0010, ADR-0011).

**Why:** in `products-draft-edit`, the acceptance step appended to the existing "proposed" sentence instead of replacing it, producing a self-contradicting line ("accepted ... decision by the user pending"). The reviewer flagged this as a Major finding and it had to be fixed by docs-keeper in the documentation phase. See `docs/LESSONS.md`, entry dated 2026-09-07 under `products-draft-edit`.

**How to apply:** whenever a task says "ADR-NNNN status: accepted", read line 3 first and do a full-sentence `Edit` replacement (old_string = the entire current sentence), not an append. Also tick the `## Consequences` bullets that are actually done (checkbox style `- [x]`), matching the pattern used when closing out a feature's ADR in the documentation phase.
