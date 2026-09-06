// OData contract test: the compiled EDMX of CatalogService must match the committed snapshot.
// Update deliberately with `npx vitest -u` and explain the change in docs/CHANGELOG.md.
import cds from '@sap/cds';

const test = cds.test(import.meta.dirname + '/..');

describe('OData contract of CatalogService', () => {
  it('matches the EDMX snapshot', async () => {
    const csn = await cds.load('*');
    const edmx = cds.compile.to.edmx(csn, { service: 'CatalogService', version: 'v4' });
    expect(edmx).toMatchSnapshot();
  });

  it('serves $metadata over HTTP with English labels', async () => {
    const { status, data } = await test.get('/odata/v4/catalog/$metadata', {
      headers: { 'Accept-Language': 'en' },
    });
    expect(status).toBe(200);
    expect(data).toContain('Common.Label" String="Product Name"');
  });
});
