---
paths:
  - "db/data/**"
---
# Test data (db/data/)

## Rules
- File name `<namespace>-<Entity>.csv`, for example `my.catalog-Products.csv`. For texts: `<namespace>-<Entity>.texts.csv`.
- Files are created with the command `cds add data --filter <Entity> --records <N>`, then the placeholders (`name-29894036`) are replaced with meaningful values. Generated IDs and foreign keys are kept.
- Separator `;`, as in the existing file. The header matches the element names exactly; foreign keys in the form `<assoc>_<key>` (`currency_code`, `category_ID`).
- All keys and foreign keys in UUID format (`4b7e1d2a-3c9f-4e5d-8b6a-1f2e3d4c5b6a`), except code lists with the key `code`.
- Dates in ISO 8601, decimals with a dot, booleans `true`/`false`, an empty value is an empty cell.
- `managed` fields (`createdAt`, `createdBy`, `modifiedAt`, `modifiedBy`) are not set in CSV.
- Data must be consistent across files: every foreign key references an existing row.
- Before editing, check `docs/registry/DOMAIN-MODEL.md` for the current list of elements.

## After editing
- `cds deploy --to sqlite::memory:` or `npm test`: the CSV loads without `valid-csv-header` warnings.
- Update `app/<app>/webapp/localService/mockdata/<EntitySet>.json` if the frontend mock should reflect the data (an array of objects, keys as in OData).

## Forbidden
- Hand-made UUIDs "11111111-..." in CSV; production or personal data.
