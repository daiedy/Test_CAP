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
Errors: N. Warnings: N. List of significant messages.

## Verdict
Ready for review | rework required (list).
