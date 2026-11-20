// Template: service tests in test/<service>.test.js (Vitest + @cap-js/cds-test).
// cds.test() must be the first cds call. Data comes from db/data/*.csv. Assert subsets, not whole payloads.
// cds 10: Decimal and Int64 arrive as strings; write operations return { affected }.
import cds from '@sap/cds';

const { GET, POST, PATCH, DELETE, expect, defaults } = cds.test(import.meta.dirname + '/..');
defaults.auth = { username: 'alice' };
const base = '/odata/v4/orders';

describe('OrdersService.Orders', () => {
  it('lists seeded orders with the total as string', async () => {
    const { data } = await GET(`${base}/Orders?$top=2&$orderby=orderNo`);
    expect(data.value).to.have.length(2);
    expect(data.value).to.containSubset([
      { orderNo: 'ORD-000001', total: '59.99', currency_code: 'USD' },
    ]);
  });

  it('creates an order with mandatory fields', async () => {
    // On a draft-enabled entity a POST without IsActiveEntity creates a draft, so an active
    // record is requested explicitly; an entity without drafts takes no IsActiveEntity.
    const { status, data } = await POST(`${base}/Orders`, {
      IsActiveEntity: true,
      orderNo: 'ORD-900001',
      customer: 'Test Customer',
      currency_code: 'USD',
      quantity: 5,
    });
    expect(status).to.equal(201);
    expect(data).to.containSubset({ orderNo: 'ORD-900001', quantity: 5 });
    await DELETE(`${base}/Orders(ID=${data.ID},IsActiveEntity=true)`);
  });

  it('rejects an order without a customer', async () => {
    await expect(
      POST(`${base}/Orders`, {
        IsActiveEntity: true,
        orderNo: 'ORD-900002',
        currency_code: 'USD',
        quantity: 1,
      })
    ).to.be.rejectedWith(/400/);
  });

  it('rejects a negative quantity via @assert.range', async () => {
    const { data } = await GET(`${base}/Orders?$top=1`);
    // PATCH addresses the active record explicitly by its (ID, IsActiveEntity) key.
    await expect(
      PATCH(`${base}/Orders(ID=${data.value[0].ID},IsActiveEntity=true)`, { quantity: -1 })
    ).to.be.rejectedWith(/400/);
  });
});

describe('authorization', () => {
  it('denies anonymous access', async () => {
    // { auth: null } overrides defaults.auth and sends no Authorization header;
    // the error carries a numeric status/code 401.
    const err = await expect(GET(`${base}/Orders`, { auth: null })).to.be.rejectedWith(/401/);
    expect(err.status).to.equal(401);
  });

  it('denies a user without the required role', async () => {
    // A denied role carries a string code '403', unlike the numeric 401 above.
    const err = await expect(
      GET(`${base}/Orders`, { auth: { username: 'carol' } })
    ).to.be.rejectedWith(/403/);
    expect(err).to.containSubset({ code: '403' });
  });
});
