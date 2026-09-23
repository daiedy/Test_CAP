# <Feature name>: verification

Date: YYYY-MM-DD. Agent: `ui-verifier` and `test-backend`.

Working rule: fill this file incrementally, one scenario row as soon as it completes, and budget the agent's turns per scenario before the first one; the network evidence of Fiori Elements V4 lives inside `POST $batch` bodies (`list_network_requests`, then `get_network_request`). After typing into or clearing a field, blur it and confirm the `PATCH` landed in `$batch` before pressing Save or Create; a click right after `fill("")` can be processed before UI5 fires `change`.

## Automated tests
```
<npm test output>
```
```
<ui5lint / ui5-test-runner output>
```

## Manual scenario check
| Scenario from PLAN | Steps | Result | Screenshot |
|---|---|---|---|
| ... | ... | passed / failed | `screenshots/<name>.png` |

## Network evidence (`$batch` request lines)
```
<METHOD path → status, per scenario>
```

## Browser console
Baseline: the console section of the latest `VERIFICATION.md` on `main` (known sandbox 404s, ushell deprecation, FE i18n asserts). New errors: N. New warnings: N. List every new message with the action that triggers it and how often it fires; name the known noise once instead of re-listing it. A visibility mechanism (`UI.*Hidden`) is checked on the List Report and the Object Page separately.

## Verdict
Ready for review | rework required (list).
