// Template: OData contract test in test/metadata.test.js. Compiles the service to EDMX V4 and compares
// with a snapshot in test/__snapshots__/. Update deliberately with `npx vitest -u` and a CHANGELOG entry.
import cds from '@sap/cds';

const test = cds.test(import.meta.dirname + '/..');

describe('OData contract', () => {
  it('CatalogService $metadata matches the snapshot', async () => {
    const csn = await cds.load(['db', 'srv', 'app'], { root: cds.root });
    const edmx = cds.compile.to.edmx(csn, { service: 'CatalogService', version: 'v4' });
    expect(edmx).toMatchSnapshot();
  });

  it('serves the same metadata over HTTP', async () => {
    const { status, headers } = await test.get('/odata/v4/catalog/$metadata');
    expect(status).toBe(200);
    expect(headers['content-type']).toMatch(/xml/);
  });
});
