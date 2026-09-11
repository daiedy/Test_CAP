// OData contract test: the compiled EDMX of CatalogService must match the committed snapshot.
// Update deliberately with `npx vitest -u` and explain the change in docs/CHANGELOG.md.
import cds from '@sap/cds';
import { readFileSync } from 'node:fs';

const test = cds.test(import.meta.dirname + '/..');
// @requires on CatalogService also protects $metadata, so even the contract test needs a user (ADR-0013).
test.defaults.auth = { username: 'alice' };

describe('OData contract of CatalogService', () => {
  it('matches the EDMX snapshot', async () => {
    const csn = await cds.load('*');
    const edmx = cds.compile.to.edmx(csn, { service: 'CatalogService', version: 'v4' });
    expect(edmx).toMatchSnapshot();
  });

  it('keeps app/products/webapp/localService/metadata.xml in sync with the model', async () => {
    // Mock mode serves this file; regenerate it with
    // cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml
    const csn = await cds.load('*');
    const edmx = cds.compile.to.edmx(csn, { service: 'CatalogService', version: 'v4' });
    const localized = cds.localize(csn, 'en', edmx);
    const snapshot = readFileSync(
      import.meta.dirname + '/../app/products/webapp/localService/metadata.xml',
      'utf8'
    );
    expect(snapshot.trim()).toBe(localized.trim());
  });

  it('serves $metadata over HTTP with English labels', async () => {
    const { status, data } = await test.get('/odata/v4/catalog/$metadata', {
      headers: { 'Accept-Language': 'en' },
    });
    expect(status).toBe(200);
    expect(data).toContain('Common.Label" String="Product Name"');
  });

  it('exposes the semantic key of Products in the contract', async () => {
    // ADR-0015: FE V4 renders the draft/lock marker in the first semantic-key LineItem column.
    const { status, data } = await test.get('/odata/v4/catalog/$metadata', {
      headers: { 'Accept-Language': 'en' },
    });
    expect(status).toBe(200);
    expect(data).toContain('Term="Common.SemanticKey"');
    expect(data).toContain('<PropertyPath>name</PropertyPath>');
  });

  it('exposes the Permissions singleton', async () => {
    // ADR-0013: the UI reads its edit permission from a read-only singleton, not from a row.
    const { status, data } = await test.get('/odata/v4/catalog/$metadata', {
      headers: { 'Accept-Language': 'en' },
    });
    expect(status).toBe(200);
    expect(data).toContain('<Singleton Name="Permissions"');
  });

  // Skipped on purpose until step 9 of docs/features/catalog-authorization/PLAN.md: the three
  // UI.*Hidden annotations are added by fiori-app-dev in phase 3 (app/products/annotations/Products.cds).
  // The assertion is complete; step 9 only removes the `.skip` and regenerates metadata.xml plus the snapshot.
  it.skip('hides the editing actions of Products from anyone who is not a CatalogEditor', async () => {
    const { status, data } = await test.get('/odata/v4/catalog/$metadata', {
      headers: { 'Accept-Language': 'en' },
    });
    expect(status).toBe(200);
    // The EDMX is pretty-printed, so compare without the whitespace between the tags.
    const compact = data.replace(/>\s+</g, '><');
    for (const term of ['UI.CreateHidden', 'UI.UpdateHidden', 'UI.DeleteHidden']) {
      expect(compact).toContain(
        `<Annotation Term="${term}"><Not><Path>/CatalogService.EntityContainer/Permissions/isEditor</Path></Not></Annotation>`
      );
    }
  });
});
