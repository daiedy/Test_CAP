// Service tests for CatalogService (Vitest + @cap-js/cds-test). Data comes from db/data/*.csv.
// cds 10: Decimal values arrive as strings; write operations return { affected }.
import cds from '@sap/cds';

const { GET, POST, PATCH, DELETE, expect, defaults } = cds.test(import.meta.dirname + '/..');
defaults.auth = { username: 'alice' };
const base = '/odata/v4/catalog';

describe('CatalogService.Products', () => {
  it('lists the 15 seeded products', async () => {
    const { data } = await GET(`${base}/Products?$count=true&$top=1`);
    expect(data['@odata.count']).to.equal(15);
  });

  it('returns price as a string with its currency code', async () => {
    const { data } = await GET(
      `${base}/Products?$filter=name eq 'Backpack'&$select=name,price,currency_code`
    );
    expect(data.value).to.have.length(1);
    expect(data.value).to.containSubset([
      { name: 'Backpack', price: '59.99', currency_code: 'USD' },
    ]);
  });

  it('filters by category', async () => {
    const { data } = await GET(`${base}/Products?$filter=category eq 'Kitchen'&$select=name`);
    expect(data.value.map((p) => p.name).sort()).to.deep.equal([
      'Coffee Maker',
      'Kitchen Knife Set',
      'Water Bottle',
    ]);
  });

  it('creates a product with the mandatory fields and fills managed fields', async () => {
    const { status, data } = await POST(`${base}/Products`, {
      name: 'Test Lamp',
      price: '10.00',
      currency_code: 'USD',
      stock: 5,
      category: 'Furniture',
    });
    expect(status).to.equal(201);
    expect(data).to.containSubset({ name: 'Test Lamp', stock: 5, createdBy: 'alice' });
    expect(data.ID).to.be.a('string');
    await DELETE(`${base}/Products(${data.ID})`);
  });

  it('rejects a product without a name (@mandatory)', async () => {
    await expect(
      POST(`${base}/Products`, { price: '1.00', currency_code: 'USD', stock: 1, category: 'Other' })
    ).to.be.rejectedWith(/400/);
  });

  it('rejects negative stock (@assert.range)', async () => {
    const { data } = await GET(`${base}/Products?$filter=name eq 'Yoga Mat'&$select=ID`);
    await expect(PATCH(`${base}/Products(${data.value[0].ID})`, { stock: -1 })).to.be.rejectedWith(
      /400/
    );
  });

  it('exposes Currencies as a code list for the value help', async () => {
    const { data } = await GET(`${base}/Currencies?$filter=code eq 'USD'&$select=code,name`);
    expect(data.value).to.containSubset([{ code: 'USD' }]);
  });
});
