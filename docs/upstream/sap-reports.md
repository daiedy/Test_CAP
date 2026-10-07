# Defect reports to SAP

Reports of upstream defects the project found and works around. Channel for the CAP Node.js runtime (`@sap/cds`, closed source, no public issue tracker): an incident in the SAP Support Portal (SAP for Me), component `BC-XS-CDX-NJS`, per https://cap.cloud.sap/docs/resources/ "Support Channels"; a question in the SAP Community with the tag "SAP Cloud Application Programming Model" is the fallback without an S-user. Each report below is written so that it can be pasted as is. The LESSONS entries of the two defects stay `Pending upstream` until the fix lands; `upstream-check` reads this table.

| Date | Report | Channel | Reference | Status |
|---|---|---|---|---|
| 2026-10-07 | 1. Positional `req.error(status, message)` returns the HTTP status as the OData `code` | SAP Community, Technology Q&A (no S-user at hand; the Support Portal channel stays open) | https://community.sap.com/t5/technology-q-a/positional-req-error-409-key-details-code-is-quot-409-quot-not-the-message/qaq-p/14498999 | posted 2026-10-07, awaiting an answer |
| 2026-10-07 | 2. `sap-messages` header texts ignore `Accept-Language` | SAP Community, Technology Q&A (no S-user at hand; the Support Portal channel stays open) | https://community.sap.com/t5/technology-q-a/sap-messages-header-texts-ignore-accept-language-while-the-error-body-is/qaq-p/14498987 | posted 2026-10-07, awaiting an answer |

## How to submit

1. SAP Support Portal: https://me.sap.com/getsupport ("Get Support" in SAP for Me), with an S-user that holds the "Create Cases" authorization (field details: SAP KBA 1296527). One case per report: component `BC-XS-CDX-NJS`, priority Low (a workaround exists, no productive system affected), subject = the report's **Title**, description = the report section plus the "Shared reproduction" section below; the five reproduction files may go in as a zip attachment.
2. Without an S-user: SAP Community, product page https://community.sap.com/t5/c-khhcw49343/SAP+Cloud+Application+Programming+Model/pd-p/9f13aee1-834c-4105-8e43-ee442775e5ce, "Ask a Question", tag "SAP Cloud Application Programming Model", same subject and body.
3. Put the case number or the question URL into the table above and into the matching LESSONS entry.

## Shared reproduction (both reports)

Verified on 2026-10-07 with a throwaway project outside the application: `@sap/cds` 10.1.1, `@cap-js/sqlite` 3.1.1, `@sap/cds-dk` 10.1.0, Node.js 22.23.2, macOS 26. The behaviour was first seen on `@sap/cds` 10.0.6 (2026-09-29).

`package.json`

```json
{ "name": "probe", "private": true, "dependencies": { "@sap/cds": "^10", "@cap-js/sqlite": "^3" } }
```

`srv/probe.cds`

```cds
service ProbeService {
  entity Things { key ID : Integer; name : String; }
  action boomPositional() returns String;
  action boomObject() returns String;
  action info() returns String;
}
```

`srv/probe.js`

```js
const cds = require('@sap/cds');
module.exports = class ProbeService extends cds.ApplicationService {
  init() {
    this.on('boomPositional', (req) => {
      req.error(409, 'PROBE_CONFLICT');
      req.error(400, 'PROBE_BAD');
    });
    this.on('boomObject', (req) => {
      req.error({ status: 409, code: 'PROBE_CONFLICT' });
      req.error({ status: 400, code: 'PROBE_BAD' });
    });
    this.on('info', (req) => {
      req.info('PROBE_INFO');
      return 'ok';
    });
    return super.init();
  }
};
```

`_i18n/messages.properties`

```properties
PROBE_CONFLICT=EN conflict text
PROBE_BAD=EN bad text
PROBE_INFO=EN info text
```

`_i18n/messages_ru.properties`

```properties
PROBE_CONFLICT=RU conflict text
PROBE_BAD=RU bad text
PROBE_INFO=RU info text
```

Start: `npx cds serve all --in-memory --port 4099`.

## Report 1: positional `req.error(status, message)` returns the HTTP status as the OData `code`

**Title:** `req.error(status, messageKey)` positional form sends the HTTP status as `error.details[].code` instead of the message key

**Component:** BC-XS-CDX-NJS. **Versions:** `@sap/cds` 10.1.1 (also 10.0.6), Node.js 22.23.2.

**Steps**

```bash
curl -s -X POST localhost:4099/odata/v4/probe/boomPositional -H 'Content-Type: application/json' -d '{}'
curl -s -X POST localhost:4099/odata/v4/probe/boomObject -H 'Content-Type: application/json' -d '{}'
```

**Actual**

Positional form, `req.error(409, 'PROBE_CONFLICT')` and `req.error(400, 'PROBE_BAD')`:

```json
{"error":{"message":"Multiple errors occurred, see details below.","code":"MULTIPLE_ERRORS","details":[{"message":"EN conflict text","code":"409","@Common.numericSeverity":4},{"message":"EN bad text","code":"400","@Common.numericSeverity":4}],"@Common.numericSeverity":4}}
```

Object form, `req.error({ status: 409, code: 'PROBE_CONFLICT' })`:

```json
{"error":{"message":"Multiple errors occurred, see details below.","code":"MULTIPLE_ERRORS","details":[{"message":"EN conflict text","code":"PROBE_CONFLICT","@Common.numericSeverity":4},{"message":"EN bad text","code":"PROBE_BAD","@Common.numericSeverity":4}],"@Common.numericSeverity":4}}
```

**Expected**

The same handler intent gives the same OData error. https://cap.cloud.sap/docs/node.js/events documents the positional variant as `req.error(status?, message?, target?, args?)` and says that the `code` is the i18n lookup key and that the `message` is used as the key when `code` is omitted. In the positional form the message key is resolved for the text (so it is recognised as the key) but the HTTP status is copied into `details[].code`, which carries no information for the client (the status is already the HTTP status) and loses the message key. Expected: `details[].code` is `PROBE_CONFLICT`, as in the object form, or the documentation states that the positional form cannot carry a message code.

**Impact**

A client that reacts to `code` (Fiori elements message handling, tests asserting `code`) cannot use the positional form. Workaround in our project: the object form only, fixed as a pattern.

## Report 2: `sap-messages` header texts ignore `Accept-Language`

**Title:** `req.info` / `req.warn` / `req.notify` messages in the `sap-messages` header are not localized by `Accept-Language`, while the error body is

**Component:** BC-XS-CDX-NJS. **Versions:** `@sap/cds` 10.1.1 (also 10.0.6), Node.js 22.23.2.

**Steps**

```bash
curl -s -i -X POST localhost:4099/odata/v4/probe/info -H 'Content-Type: application/json' -d '{}' | grep -i '^sap-messages'
curl -s -i -X POST localhost:4099/odata/v4/probe/info -H 'Content-Type: application/json' -H 'Accept-Language: ru' -d '{}' | grep -i '^sap-messages'
curl -s -X POST localhost:4099/odata/v4/probe/boomPositional -H 'Content-Type: application/json' -H 'Accept-Language: ru' -d '{}'
```

**Actual**

Without `Accept-Language` and with `Accept-Language: ru` the header is identical:

```
sap-messages: [{"code":"PROBE_INFO","message":"EN info text","numericSeverity":2}]
sap-messages: [{"code":"PROBE_INFO","message":"EN info text","numericSeverity":2}]
```

The error body of the same service under `Accept-Language: ru` is localized, including the framework text:

```json
{"error":{"message":"<the Russian MULTIPLE_ERRORS text of @sap/cds/_i18n/messages_ru.properties>","code":"MULTIPLE_ERRORS","details":[{"message":"RU conflict text","code":"409","@Common.numericSeverity":4},{"message":"RU bad text","code":"400","@Common.numericSeverity":4}],"@Common.numericSeverity":4}}
```

**Expected**

https://cap.cloud.sap/docs/node.js/events: `req.info`, `req.warn`, `req.notify` "accept identical arguments" to `req.reject` and are "returned in a HTTP response header (for example, `sap-messages`)", and "If an `Accept-Language` header is present in the request, a localized message is looked up in addition, using the preferred language specified in the header, and used for the `message` property in the HTTP response." Expected: `sap-messages[].message` is `RU info text` under `Accept-Language: ru`, consistent with the error body.

**Impact**

Success and information messages shown by Fiori elements after an action appear in the server default language for every user. Workaround in our project: `req.info(cds.i18n.messages.at(key, req.locale, args))`, fixed as a pattern.
