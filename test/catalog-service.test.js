// Service tests for CatalogService (Vitest + @cap-js/cds-test). Data comes from db/data/*.csv.
// cds 10: Decimal values arrive as strings; write operations return { affected }.
import cds from '@sap/cds';

const { GET, POST, PATCH, DELETE, expect, defaults } = cds.test(import.meta.dirname + '/..');
defaults.auth = { username: 'alice' };
const base = '/odata/v4/catalog';

// Valid payload for POST /Products; negative tests drop or replace one field at a time.
const newProduct = {
  name: 'Test Lamp',
  price: '10.00',
  currency_code: 'USD',
  stock: 5,
  category_code: 'FURNITURE',
};
// Copy of the valid payload without one field, for the @mandatory tests.
const without = (field) => {
  const payload = { ...newProduct };
  delete payload[field];
  return payload;
};

// Draft-enabled entity (ADR-0012): active records are addressed explicitly.
// A POST without IsActiveEntity creates a draft and skips @mandatory/@assert.target.
const active = (payload) => ({ IsActiveEntity: true, ...payload });
const activeKey = (id) => `${base}/Products(ID=${id},IsActiveEntity=true)`;
const draftKey = (id) => `${base}/Products(ID=${id},IsActiveEntity=false)`;

// Authorization (ADR-0013): alice and bob are CatalogEditors, viewer is a CatalogViewer,
// carol is a default mock user without any catalog role.
const as = (username) => ({ auth: { username } });
const anonymous = { auth: null }; // overrides defaults.auth, sends no Authorization header

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

  it('filters products by category code', async () => {
    const { data } = await GET(`${base}/Products?$filter=category_code eq 'KITCHEN'&$select=name`);
    expect(data.value.map((p) => p.name).sort()).to.deep.equal([
      'Coffee Maker',
      'Kitchen Knife Set',
      'Water Bottle',
    ]);
  });

  it('expands the category of a product', async () => {
    const { data } = await GET(
      `${base}/Products?$filter=name eq 'Backpack'&$expand=category($select=code,name)`
    );
    expect(data.value).to.have.length(1);
    expect(data.value).to.containSubset([
      { name: 'Backpack', category: { code: 'ACCESSORIES', name: 'Accessories' } },
    ]);
  });

  it('creates a product with the mandatory fields and fills managed fields', async () => {
    const { status, data } = await POST(`${base}/Products`, active(newProduct));
    expect(status).to.equal(201);
    expect(data).to.containSubset({
      IsActiveEntity: true,
      name: 'Test Lamp',
      stock: 5,
      category_code: 'FURNITURE',
      createdBy: 'alice',
    });
    expect(data.ID).to.be.a('string');
    await DELETE(activeKey(data.ID));
  });

  it('rejects a product without a name (@mandatory)', async () => {
    const err = await expect(POST(`${base}/Products`, active(without('name')))).to.be.rejectedWith(
      /400/
    );
    expect(err).to.containSubset({ code: 'ASSERT_MANDATORY', target: 'name' });
  });

  it('rejects a product without a category (@mandatory)', async () => {
    const err = await expect(
      POST(`${base}/Products`, active(without('category_code')))
    ).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'ASSERT_MANDATORY', target: 'category_code' });
  });

  it('rejects an unknown category code (@assert.target)', async () => {
    const err = await expect(
      POST(`${base}/Products`, active({ ...newProduct, category_code: 'UNKNOWN' }))
    ).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'ASSERT_TARGET', target: 'category_code' });
  });

  it('rejects negative stock (@assert.range)', async () => {
    const { data } = await GET(`${base}/Products?$filter=name eq 'Yoga Mat'&$select=ID`);
    const err = await expect(PATCH(activeKey(data.value[0].ID), { stock: -1 })).to.be.rejectedWith(
      /400/
    );
    expect(err).to.containSubset({ code: 'ASSERT_RANGE' });
  });

  it('returns the seeded rating of a product', async () => {
    const { data } = await GET(`${base}/Products?$select=name,rating`);
    expect(data.value).to.have.length(15);
    for (const { rating } of data.value) expect(rating).to.be.within(0, 5);
    expect(data.value).to.containSubset([{ name: 'Laptop Pro 15', rating: 5 }]);
  });

  it('rejects a rating above 5 (@assert.range)', async () => {
    const { data } = await GET(`${base}/Products?$filter=name eq 'Yoga Mat'&$select=ID`);
    const key = activeKey(data.value[0].ID);
    const err = await expect(PATCH(key, { rating: 6 })).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'ASSERT_RANGE' });
    expect(err.target).to.match(/rating$/);
    const { data: stored } = await GET(`${key}?$select=rating`);
    expect(stored).to.containSubset({ rating: 4 });
  });

  it('rejects a negative rating (@assert.range)', async () => {
    const { data } = await GET(`${base}/Products?$filter=name eq 'Yoga Mat'&$select=ID`);
    const err = await expect(PATCH(activeKey(data.value[0].ID), { rating: -1 })).to.be.rejectedWith(
      /400/
    );
    expect(err).to.containSubset({ code: 'ASSERT_RANGE' });
    expect(err.target).to.match(/rating$/);
  });

  it('exposes Currencies as a code list for the value help', async () => {
    const { data } = await GET(`${base}/Currencies?$filter=code eq 'USD'&$select=code,name`);
    expect(data.value).to.containSubset([{ code: 'USD' }]);
  });
});

// Draft lifecycle of the Fiori Elements edit flow (ADR-0012). Every test discards its draft;
// the active record created in beforeAll is deleted in afterAll, so the seeded rows stay unchanged.
describe('CatalogService.Products drafts', () => {
  let id;
  const draftEdit = (options) =>
    POST(`${activeKey(id)}/CatalogService.draftEdit`, { PreserveChanges: true }, options);
  const draftActivate = () => POST(`${draftKey(id)}/CatalogService.draftActivate`, {});
  const discard = () => DELETE(draftKey(id));
  // Cleanup where the draft may already be gone (after activation, after a failed test).
  const discardIfAny = () => discard().catch(() => {});

  beforeAll(async () => {
    const { data } = await POST(`${base}/Products`, active({ ...newProduct, name: 'Draft Lamp' }));
    id = data.ID;
  });

  afterAll(async () => {
    await discardIfAny();
    await DELETE(activeKey(id));
  });

  it('creates a draft when POST omits IsActiveEntity', async () => {
    const { status, data } = await POST(`${base}/Products`, newProduct);
    expect(status).to.equal(201);
    expect(data).to.containSubset({ IsActiveEntity: false, HasActiveEntity: false });
    let discarded;
    try {
      // $count sees active records only: 15 seeded plus the beforeAll record.
      const { data: page } = await GET(`${base}/Products?$count=true&$top=0`);
      expect(page['@odata.count']).to.equal(16);
      // A record that exists only as a draft cannot be deleted through the active key.
      const err = await expect(DELETE(`${base}/Products(${data.ID})`)).to.be.rejectedWith(/403/);
      expect(err).to.containSubset({ code: 'DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS' });
    } finally {
      discarded = await DELETE(draftKey(data.ID));
    }
    expect(discarded.status).to.equal(204);
  });

  it('edits an active product through draftEdit, PATCH and draftActivate', async () => {
    const edit = await draftEdit();
    expect(edit.status).to.equal(201);
    expect(edit.data).to.containSubset({ ID: id, IsActiveEntity: false, HasActiveEntity: true });
    try {
      const locked = await GET(
        `${activeKey(id)}?$select=HasDraftEntity&$expand=DraftAdministrativeData($select=InProcessByUser)`
      );
      expect(locked.data).to.containSubset({
        HasDraftEntity: true,
        DraftAdministrativeData: { InProcessByUser: 'alice' },
      });

      const patched = await PATCH(draftKey(id), { category_code: 'KITCHEN' });
      expect(patched.status).to.equal(200);

      const activated = await draftActivate();
      expect(activated.status).to.equal(200);
      expect(activated.data).to.containSubset({
        IsActiveEntity: true,
        category_code: 'KITCHEN',
        modifiedBy: 'alice',
      });
    } finally {
      await discardIfAny();
    }
    const { data } = await GET(`${activeKey(id)}?$select=category_code,HasDraftEntity`);
    expect(data).to.containSubset({ category_code: 'KITCHEN', HasDraftEntity: false });
  });

  it('reports an unknown category on the draft and rejects activation (@assert.target)', async () => {
    await draftEdit();
    try {
      // On a draft, @assert.* are messages (200), not errors.
      const { status, data } = await PATCH(draftKey(id), { category_code: 'UNKNOWN' });
      expect(status).to.equal(200);
      expect(data.DraftMessages).to.containSubset([{ code: 'ASSERT_TARGET' }]);
      // Activation enforces them; the target is prefixed with the action parameter `in/`.
      const err = await expect(draftActivate()).to.be.rejectedWith(/400/);
      expect(err).to.containSubset({ code: 'ASSERT_TARGET' });
      expect(err.target).to.match(/category_code$/);
    } finally {
      await discard();
    }
  });

  it('rejects activation of a draft without a name (@mandatory)', async () => {
    await draftEdit();
    try {
      // @mandatory is not checked on drafts at all: 200 and no message.
      const { status, data } = await PATCH(draftKey(id), { name: null });
      expect(status).to.equal(200);
      expect(data.DraftMessages ?? []).to.be.empty;
      const err = await expect(draftActivate()).to.be.rejectedWith(/400/);
      expect(err).to.containSubset({ code: 'ASSERT_MANDATORY' });
      expect(err.target).to.match(/name$/);
    } finally {
      await discard();
    }
  });

  it('rejects activation of a draft with a rating above 5 (@assert.range)', async () => {
    await draftEdit();
    let discarded;
    try {
      // On a draft, @assert.range is a message (200), not an error.
      const { status, data } = await PATCH(draftKey(id), { rating: 6 });
      expect(status).to.equal(200);
      expect(data.DraftMessages).to.containSubset([{ code: 'ASSERT_RANGE' }]);
      const err = await expect(draftActivate()).to.be.rejectedWith(/400/);
      expect(err).to.containSubset({ code: 'ASSERT_RANGE' });
      expect(err.target).to.match(/rating$/);
    } finally {
      discarded = await discard();
    }
    expect(discarded.status).to.equal(204);
    const { data } = await GET(`${activeKey(id)}?$select=rating,HasDraftEntity`);
    expect(data).to.containSubset({ rating: null, HasDraftEntity: false });
  });

  it("locks the active product while another user's draft exists", async () => {
    const asBob = { auth: { username: 'bob' } };
    await draftEdit();
    try {
      const edit = await expect(draftEdit(asBob)).to.be.rejectedWith(/409/);
      expect(edit).to.containSubset({ code: 'DRAFT_ALREADY_EXISTS' });
      const patch = await expect(PATCH(activeKey(id), { stock: 7 }, asBob)).to.be.rejectedWith(
        /409/
      );
      expect(patch).to.containSubset({ code: 'DRAFT_ALREADY_EXISTS' });
    } finally {
      await discard();
    }
  });

  it('discards a draft and leaves the active product unchanged', async () => {
    await draftEdit();
    let discarded;
    try {
      await PATCH(draftKey(id), { stock: 1 });
    } finally {
      discarded = await discard();
    }
    expect(discarded.status).to.equal(204);
    const { data } = await GET(`${activeKey(id)}?$select=stock,HasDraftEntity`);
    expect(data).to.containSubset({ stock: newProduct.stock, HasDraftEntity: false });
  });
});

describe('CatalogService.Categories', () => {
  it('lists the 6 seeded categories', async () => {
    const { data } = await GET(`${base}/Categories?$select=code&$orderby=code`);
    expect(data.value.map((c) => c.code)).to.deep.equal([
      'ACCESSORIES',
      'ELECTRONICS',
      'FURNITURE',
      'KITCHEN',
      'SPORTS',
      'STATIONERY',
    ]);
  });

  it('returns localized category names with English fallback', async () => {
    const url = `${base}/Categories?$filter=code eq 'KITCHEN'&$select=code,name`;
    const inLocale = (locale) => GET(url, { headers: { 'Accept-Language': locale } });

    const ru = await inLocale('ru');
    expect(ru.data.value).to.containSubset([{ code: 'KITCHEN', name: 'Кухня' }]);

    const en = await inLocale('en');
    expect(en.data.value).to.containSubset([{ code: 'KITCHEN', name: 'Kitchen' }]);

    // No German texts in Categories.texts.csv: the default (English) name is served.
    const de = await inLocale('de');
    expect(de.data.value).to.containSubset([{ code: 'KITCHEN', name: 'Kitchen' }]);
  });

  it('does not allow creating categories (@readonly)', async () => {
    await expect(POST(`${base}/Categories`, { code: 'OTHER', name: 'Other' })).to.be.rejectedWith(
      /405/
    );
  });
});

// Authorization (ADR-0013): @requires on the service and @restrict on Products.
// Anonymous requests are rejected with 401 (numeric `code`), a denied role with 403 (string `code`).
describe('CatalogService authorization', () => {
  it('rejects anonymous requests with 401', async () => {
    const products = await expect(GET(`${base}/Products?$top=1`, anonymous)).to.be.rejectedWith(
      /401/
    );
    expect(products.status).to.equal(401);

    const metadata = await expect(GET(`${base}/$metadata`, anonymous)).to.be.rejectedWith(/401/);
    expect(metadata.status).to.equal(401);
  });

  it('lets a CatalogViewer read products, categories, currencies and the metadata', async () => {
    const products = await GET(`${base}/Products?$top=1&$select=name`, as('viewer'));
    expect(products.status).to.equal(200);
    expect(products.data.value).to.have.length(1);

    const categories = await GET(`${base}/Categories?$top=1&$select=code`, as('viewer'));
    expect(categories.status).to.equal(200);

    const currencies = await GET(`${base}/Currencies?$top=1&$select=code`, as('viewer'));
    expect(currencies.status).to.equal(200);

    const metadata = await GET(`${base}/$metadata`, as('viewer'));
    expect(metadata.status).to.equal(200);
  });

  it('forbids a CatalogViewer to create products, active or as a draft', async () => {
    const asActive = await expect(
      POST(`${base}/Products`, active(newProduct), as('viewer'))
    ).to.be.rejectedWith(/403/);
    expect(asActive).to.containSubset({ code: '403' });

    // A POST without IsActiveEntity would create a draft; the grant covers that path too.
    const asDraft = await expect(
      POST(`${base}/Products`, newProduct, as('viewer'))
    ).to.be.rejectedWith(/403/);
    expect(asDraft).to.containSubset({ code: '403' });

    // Nothing was written: neither an active record nor a draft exists afterwards.
    const { data: actives } = await GET(
      `${base}/Products?$filter=name eq 'Test Lamp'&$select=name`
    );
    expect(actives.value).to.have.length(0);
    const { data: drafts } = await GET(
      `${base}/Products?$filter=name eq 'Test Lamp' and IsActiveEntity eq false&$select=name`
    );
    expect(drafts.value).to.have.length(0);
  });

  it('forbids a CatalogViewer to edit, delete or start a draft on a product', async () => {
    const { data } = await GET(`${base}/Products?$filter=name eq 'Yoga Mat'&$select=ID,stock`);
    const seeded = data.value[0];

    const patch = await expect(
      PATCH(activeKey(seeded.ID), { stock: 3 }, as('viewer'))
    ).to.be.rejectedWith(/403/);
    expect(patch).to.containSubset({ code: '403' });

    const remove = await expect(DELETE(activeKey(seeded.ID), as('viewer'))).to.be.rejectedWith(
      /403/
    );
    expect(remove).to.containSubset({ code: '403' });

    const edit = await expect(
      POST(
        `${activeKey(seeded.ID)}/CatalogService.draftEdit`,
        { PreserveChanges: true },
        as('viewer')
      )
    ).to.be.rejectedWith(/403/);
    expect(edit).to.containSubset({ code: '403' });

    // The seeded product is untouched and carries no draft.
    const after = await GET(`${activeKey(seeded.ID)}?$select=stock,HasDraftEntity`);
    expect(after.data).to.containSubset({ stock: seeded.stock, HasDraftEntity: false });
  });

  it('forbids an authenticated user without a catalog role to read products', async () => {
    // carol is a default mock user (role `admin`), unknown to this model.
    const err = await expect(GET(`${base}/Products?$top=1`, as('carol'))).to.be.rejectedWith(/403/);
    expect(err).to.containSubset({ code: '403' });

    // Code lists stay readable for every authenticated user.
    const categories = await GET(`${base}/Categories?$top=1&$select=code`, as('carol'));
    expect(categories.status).to.equal(200);
  });

  it("reports the caller's edit permission on the Permissions singleton", async () => {
    for (const username of ['alice', 'bob']) {
      const { data } = await GET(`${base}/Permissions`, as(username));
      expect(data).to.containSubset({ isEditor: true });
    }
    for (const username of ['viewer', 'carol']) {
      const { data } = await GET(`${base}/Permissions`, as(username));
      expect(data).to.containSubset({ isEditor: false });
    }
    const err = await expect(GET(`${base}/Permissions`, anonymous)).to.be.rejectedWith(/401/);
    expect(err.status).to.equal(401);
  });

  it('does not allow writing the Permissions singleton', async () => {
    await expect(PATCH(`${base}/Permissions`, { isEditor: false })).to.be.rejectedWith(/405/);
  });
});
