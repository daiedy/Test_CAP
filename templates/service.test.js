// Template: service tests in test/<service>.test.js (Vitest + @cap-js/cds-test).
// cds.test() must be the first cds call. Data comes from db/data/*.csv. Assert subsets, not whole payloads.
// cds 10: Decimal and Int64 arrive as strings; write operations return { affected }.
import cds from '@sap/cds';

const { GET, POST, PATCH, DELETE, expect, defaults } = cds.test(import.meta.dirname + '/..');
defaults.auth = { username: 'alice' };
const base = '/odata/v4/catalog';

describe('CatalogService.Products', () => {
  it('lists seeded products with price as string', async () => {
    const { data } = await GET(`${base}/Products?$top=2&$orderby=name`);
    expect(data.value).to.have.length(2);
    expect(data.value).to.containSubset([
      { name: 'Backpack', price: '59.99', currency_code: 'USD' },
    ]);
  });

  it('creates a product with mandatory fields', async () => {
    // ADR-0012: on a draft-enabled entity a POST without IsActiveEntity creates a draft, so
    // an active record is requested explicitly.
    const { status, data } = await POST(`${base}/Products`, {
      IsActiveEntity: true,
      name: 'Test Lamp',
      price: '10.00',
      currency_code: 'USD',
      stock: 5,
      category_code: 'FURNITURE',
    });
    expect(status).to.equal(201);
    expect(data).to.containSubset({ name: 'Test Lamp', stock: 5 });
    await DELETE(`${base}/Products(ID=${data.ID},IsActiveEntity=true)`);
  });

  it('rejects a product without a name', async () => {
    await expect(
      POST(`${base}/Products`, {
        IsActiveEntity: true,
        price: '1.00',
        currency_code: 'USD',
        stock: 1,
        category_code: 'X',
      })
    ).to.be.rejectedWith(/400/);
  });

  it('rejects negative stock via @assert.range', async () => {
    const { data } = await GET(`${base}/Products?$top=1`);
    // ADR-0012: PATCH addresses the active record explicitly by its (ID, IsActiveEntity) key.
    await expect(
      PATCH(`${base}/Products(ID=${data.value[0].ID},IsActiveEntity=true)`, { stock: -1 })
    ).to.be.rejectedWith(/400/);
  });
});

describe('authorization', () => {
  it('denies anonymous access', async () => {
    await expect(
      GET(`${base}/Products`, { auth: { username: 'nobody', password: '' } })
    ).to.be.rejectedWith(/40[13]/);
  });
});
