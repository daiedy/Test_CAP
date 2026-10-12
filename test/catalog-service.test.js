// Service tests for CatalogService (Vitest + @cap-js/cds-test). Data comes from db/data/*.csv.
// cds 10: Decimal values arrive as strings; write operations return { affected }.
import cds from '@sap/cds';
import { readFileSync } from 'node:fs';
import {
  HEADER,
  VALID_ROWS,
  fileParameter,
  generatedRow,
  proseDescription,
  workbook,
} from './fixtures/build-workbooks.mjs';
import { MAX_UNZIPPED_BYTES } from '../srv/lib/products-import.js';

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
  subcategory_code: 'LIGHTING', // a Furniture subcategory; mandatory since products-subcategory-cascade
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

// Edit flow of a draft-enabled product (ADR-0012), shared by the drafts and the details describes.
const draftEdit = (id, options) =>
  POST(`${activeKey(id)}/CatalogService.draftEdit`, { PreserveChanges: true }, options);
const draftActivate = (id) => POST(`${draftKey(id)}/CatalogService.draftActivate`, {});
// The DraftMessages of a draft (root or row) with the selected elements, by default the subcategory
// pair. An @assert constraint writes its message at commit, so it shows on a GET after the PATCH,
// not in the PATCH response (ADR-0024).
const readDraft = async (key, select = 'category_code,subcategory_code,DraftMessages') => {
  const { data } = await GET(`${key}?$select=${select}`);
  expect(data.DraftMessages).to.be.an('array');
  return data;
};
const messageCodes = (draft) => draft.DraftMessages.map((m) => m.code);

describe('CatalogService.Products', () => {
  // Rows of a rejection test that unexpectedly succeeded; keeps the seeded count at 15.
  afterEach(async () => {
    await cds.run(cds.ql.DELETE.from('my.catalog.Products').where`name like 'Rejected %'`);
  });

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
      subcategory_code: 'LIGHTING',
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

  it('rejects an unknown currency code (@assert.target)', async () => {
    const payload = { ...newProduct, name: 'Rejected Currency', currency_code: 'XXX' };
    const err = await expect(POST(`${base}/Products`, active(payload))).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'ASSERT_TARGET', target: 'currency_code' });
  });

  it('rejects negative stock (@assert.range)', async () => {
    const { data } = await GET(`${base}/Products?$filter=name eq 'Yoga Mat'&$select=ID`);
    const err = await expect(PATCH(activeKey(data.value[0].ID), { stock: -1 })).to.be.rejectedWith(
      /400/
    );
    expect(err).to.containSubset({ code: 'ASSERT_RANGE' });
  });

  it('rejects a price above the range (@assert.range)', async () => {
    // Decimal(15, 2) stores the value; the business bound 99999999.99 rejects it (ADR-0003).
    const payload = { ...newProduct, name: 'Rejected Price', price: '100000000.00' };
    const err = await expect(POST(`${base}/Products`, active(payload))).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'ASSERT_RANGE' });
    expect(err.target).to.match(/price$/);
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

// Subcategory of a product (ADR-0024): mandatory (@mandatory, products-subcategory-cascade) and
// checked against the product's category by an @assert constraint (ADR-0024 decision 2).
// Rows created here are named 'Subcategory %'.
describe('CatalogService.Products subcategory', () => {
  // Rows of a create test and of a rejection test that unexpectedly succeeded.
  afterEach(async () => {
    await cds.run(cds.ql.DELETE.from('my.catalog.Products').where`name like 'Subcategory %'`);
  });

  const named = async (name) => {
    const { data } = await GET(`${base}/Products?$filter=name eq '${name}'&$select=ID`);
    return data.value;
  };

  it('returns the seeded subcategory of every product', async () => {
    // [name, category_code, subcategory_code] of db/data/my.catalog-Products.csv (PLAN D1 seed).
    const seeded = [
      ['Laptop Pro 15', 'ELECTRONICS', 'LAPTOPS'],
      ['Wireless Mouse', 'ELECTRONICS', 'MICE'],
      ['Bluetooth Speaker', 'ELECTRONICS', 'AUDIO'],
      ['Wireless Earbuds', 'ELECTRONICS', 'AUDIO'],
      ['Office Chair', 'FURNITURE', 'SEATING'],
      ['Desk Lamp', 'FURNITURE', 'LIGHTING'],
      ['Reading Lamp', 'FURNITURE', 'LIGHTING'],
      ['Monitor Stand', 'FURNITURE', 'DESK_ORGANIZATION'],
      ['Coffee Maker', 'KITCHEN', 'APPLIANCES'],
      ['Water Bottle', 'KITCHEN', 'DRINKWARE'],
      ['Kitchen Knife Set', 'KITCHEN', 'CUTLERY'],
      ['Backpack', 'ACCESSORIES', 'BAGS'],
      ['Smartphone Stand', 'ACCESSORIES', 'PHONE_ACCESSORIES'],
      ['Yoga Mat', 'SPORTS', 'FITNESS'],
      ['Notebook Set', 'STATIONERY', 'NOTEBOOKS'],
    ];
    const { data } = await GET(`${base}/Products?$select=name,category_code,subcategory_code`);
    expect(data.value).to.have.length(15);
    expect(data.value).to.containSubset(
      seeded.map(([name, category_code, subcategory_code]) => ({
        name,
        category_code,
        subcategory_code,
      }))
    );
  });

  it('creates a product with a subcategory of its category', async () => {
    const payload = { ...newProduct, name: 'Subcategory Lamp', subcategory_code: 'LIGHTING' };
    const { status, data } = await POST(`${base}/Products`, active(payload));
    expect(status).to.equal(201);
    expect(data).to.containSubset({
      IsActiveEntity: true,
      category_code: 'FURNITURE',
      subcategory_code: 'LIGHTING',
    });
    const { data: stored } = await GET(
      `${activeKey(data.ID)}?$select=ID&$expand=subcategory($select=name,category_code)`
    );
    expect(stored).to.containSubset({
      subcategory: { name: 'Lighting', category_code: 'FURNITURE' },
    });
  });

  it('rejects a product without a subcategory (@mandatory)', async () => {
    const payload = { ...without('subcategory_code'), name: 'Subcategory None Lamp' };
    const err = await expect(POST(`${base}/Products`, active(payload))).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'ASSERT_MANDATORY', target: 'subcategory_code' });
    expect(await named(payload.name)).to.have.length(0);
  });

  it('rejects a subcategory of another category (PRODUCTS_SUBCATEGORY_MISMATCH)', async () => {
    const payload = {
      ...newProduct,
      name: 'Subcategory Mismatch Lamp',
      subcategory_code: 'LAPTOPS',
    };
    const err = await expect(POST(`${base}/Products`, active(payload))).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({
      code: 'PRODUCTS_SUBCATEGORY_MISMATCH',
      target: 'subcategory_code',
    });
    expect(err.message).to.contain(
      'The subcategory does not belong to the category of the product.'
    );
    expect(await named(payload.name)).to.have.length(0);
  });

  it('reports the subcategory mismatch in Russian', async () => {
    const payload = {
      ...newProduct,
      name: 'Subcategory Mismatch Lamp',
      subcategory_code: 'LAPTOPS',
    };
    const ru = { headers: { 'Accept-Language': 'ru' } };
    const err = await expect(POST(`${base}/Products`, active(payload), ru)).to.be.rejectedWith(
      /400/
    );
    expect(err).to.containSubset({ code: 'PRODUCTS_SUBCATEGORY_MISMATCH' });
    expect(err.message).to.contain('Подкатегория не относится к категории товара.');
  });

  it('rejects an unknown subcategory code (@assert.target)', async () => {
    const payload = {
      ...newProduct,
      name: 'Subcategory Unknown Lamp',
      subcategory_code: 'UNKNOWN',
    };
    const err = await expect(POST(`${base}/Products`, active(payload))).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'ASSERT_TARGET', target: 'subcategory_code' });
    expect(await named(payload.name)).to.have.length(0);
  });

  it('rejects a category change that leaves a stale subcategory on an active product', async () => {
    const { data } = await GET(`${base}/Products?$filter=name eq 'Laptop Pro 15'&$select=ID`);
    const key = activeKey(data.value[0].ID);
    const err = await expect(PATCH(key, { category_code: 'FURNITURE' })).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({
      code: 'PRODUCTS_SUBCATEGORY_MISMATCH',
      target: 'subcategory_code',
    });
    // The reset is a draft handler only; an active write keeps the seeded pair.
    const { data: stored } = await GET(`${key}?$select=category_code,subcategory_code`);
    expect(stored).to.containSubset({ category_code: 'ELECTRONICS', subcategory_code: 'LAPTOPS' });
  });

  it('rejects emptying the category of an active product', async () => {
    const [{ ID }] = await named('Desk Lamp');
    const key = activeKey(ID);
    const err = await expect(PATCH(key, { category_code: null })).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'ASSERT_MANDATORY', target: 'category_code' });
    const { data: stored } = await GET(`${key}?$select=category_code,subcategory_code`);
    expect(stored).to.containSubset({ category_code: 'FURNITURE', subcategory_code: 'LIGHTING' });
  });

  it('rejects a category change of an active product that empties the subcategory (@mandatory)', async () => {
    const [{ ID }] = await named('Desk Lamp');
    const key = activeKey(ID);
    const err = await expect(
      PATCH(key, { category_code: 'KITCHEN', subcategory_code: null })
    ).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'ASSERT_MANDATORY', target: 'subcategory_code' });
    const { data: stored } = await GET(`${key}?$select=category_code,subcategory_code`);
    expect(stored).to.containSubset({ category_code: 'FURNITURE', subcategory_code: 'LIGHTING' });
  });

  it('changes the category of an active product together with a subcategory of the new category', async () => {
    // A product of its own, so the seeded rows keep their pair; afterEach deletes it.
    const { data: created } = await POST(
      `${base}/Products`,
      active({ ...newProduct, name: 'Subcategory Move Lamp' })
    );
    const key = activeKey(created.ID);
    const { status, data } = await PATCH(key, {
      category_code: 'KITCHEN',
      subcategory_code: 'APPLIANCES',
    });
    expect(status).to.equal(200);
    expect(data).to.containSubset({ category_code: 'KITCHEN', subcategory_code: 'APPLIANCES' });
    const { data: stored } = await GET(`${key}?$select=category_code,subcategory_code`);
    expect(stored).to.containSubset({ category_code: 'KITCHEN', subcategory_code: 'APPLIANCES' });
  });
});

// Draft lifecycle of the Fiori Elements edit flow (ADR-0012). Every test discards its draft;
// the active record created in beforeAll is deleted in afterAll, so the seeded rows stay unchanged.
describe('CatalogService.Products drafts', () => {
  let id;
  const discard = () => DELETE(draftKey(id));
  // Cleanup where the draft may already be gone (after activation, after a failed test).
  const discardIfAny = () => discard().catch(() => {});

  // A new product an `it` starts as a draft (POST without IsActiveEntity), draft or activated.
  let newId;
  afterEach(async () => {
    if (!newId) return;
    await DELETE(draftKey(newId)).catch(() => {});
    await DELETE(activeKey(newId)).catch(() => {});
    newId = undefined;
  });

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
    const edit = await draftEdit(id);
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

      // The pair together: the category alone would empty the mandatory subcategory (reset).
      const patched = await PATCH(draftKey(id), {
        category_code: 'KITCHEN',
        subcategory_code: 'APPLIANCES',
      });
      expect(patched.status).to.equal(200);

      const activated = await draftActivate(id);
      expect(activated.status).to.equal(200);
      expect(activated.data).to.containSubset({
        IsActiveEntity: true,
        category_code: 'KITCHEN',
        subcategory_code: 'APPLIANCES',
        modifiedBy: 'alice',
      });
    } finally {
      await discardIfAny();
    }
    const { data } = await GET(`${activeKey(id)}?$select=category_code,HasDraftEntity`);
    expect(data).to.containSubset({ category_code: 'KITCHEN', HasDraftEntity: false });
  });

  it('reports an unknown category on the draft and rejects activation (@assert.target)', async () => {
    await draftEdit(id);
    try {
      // On a draft, @assert.* are messages (200), not errors. The subcategory is sent along: the
      // category alone would let the reset empty it, and activation would then report only
      // ASSERT_MANDATORY on in/subcategory_code, without the ASSERT_TARGET under test (measured).
      const { status, data } = await PATCH(draftKey(id), {
        category_code: 'UNKNOWN',
        subcategory_code: 'LIGHTING',
      });
      expect(status).to.equal(200);
      expect(data.DraftMessages).to.containSubset([{ code: 'ASSERT_TARGET' }]);
      // Activation enforces them; the target is matched by its suffix (TESTING.md).
      const err = await expect(draftActivate(id)).to.be.rejectedWith(/400/);
      expect(err).to.containSubset({ code: 'ASSERT_TARGET' });
      expect(err.target).to.match(/category_code$/);
    } finally {
      await discard();
    }
  });

  it('reports an unknown currency on the draft and rejects activation (@assert.target)', async () => {
    await draftEdit(id);
    try {
      // On a draft, @assert.* are messages (200), not errors.
      const { status, data } = await PATCH(draftKey(id), { currency_code: 'XXX' });
      expect(status).to.equal(200);
      expect(data.DraftMessages).to.containSubset([{ code: 'ASSERT_TARGET' }]);
      // Activation enforces them; the target is matched by its suffix (TESTING.md).
      const err = await expect(draftActivate(id)).to.be.rejectedWith(/400/);
      expect(err).to.containSubset({ code: 'ASSERT_TARGET' });
      expect(err.target).to.match(/currency_code$/);
    } finally {
      await discard();
    }
  });

  it('rejects activation of a draft without a name (@mandatory)', async () => {
    await draftEdit(id);
    try {
      // @mandatory is not checked on drafts at all: 200 and no message.
      const { status, data } = await PATCH(draftKey(id), { name: null });
      expect(status).to.equal(200);
      expect(data.DraftMessages ?? []).to.be.empty;
      const err = await expect(draftActivate(id)).to.be.rejectedWith(/400/);
      expect(err).to.containSubset({ code: 'ASSERT_MANDATORY' });
      expect(err.target).to.match(/name$/);
    } finally {
      await discard();
    }
  });

  it('rejects activation of a draft without a subcategory (@mandatory)', async () => {
    await draftEdit(id);
    try {
      await PATCH(draftKey(id), { category_code: 'FURNITURE', subcategory_code: 'LIGHTING' });
      // The category alone changes: the reset empties LIGHTING, which does not belong to KITCHEN.
      await PATCH(draftKey(id), { category_code: 'KITCHEN' });
      expect(await readDraft(draftKey(id))).to.containSubset({
        category_code: 'KITCHEN',
        subcategory_code: null,
      });
      const err = await expect(draftActivate(id)).to.be.rejectedWith(/400/);
      expect(err).to.containSubset({
        code: 'ASSERT_MANDATORY',
        target: 'in/subcategory_code',
      });
    } finally {
      await discard();
    }
    const { data } = await GET(`${activeKey(id)}?$select=subcategory_code,HasDraftEntity`);
    expect(data.HasDraftEntity).to.equal(false);
    expect(data.subcategory_code).to.be.a('string');
  });

  it('rejects activation of a draft with a rating above 5 (@assert.range)', async () => {
    await draftEdit(id);
    let discarded;
    try {
      // On a draft, @assert.range is a message (200), not an error.
      const { status, data } = await PATCH(draftKey(id), { rating: 6 });
      expect(status).to.equal(200);
      expect(data.DraftMessages).to.containSubset([{ code: 'ASSERT_RANGE' }]);
      const err = await expect(draftActivate(id)).to.be.rejectedWith(/400/);
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
    await draftEdit(id);
    try {
      const edit = await expect(draftEdit(id, asBob)).to.be.rejectedWith(/409/);
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
    await draftEdit(id);
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

  it('clears the subcategory when a draft changes the category', async () => {
    await draftEdit(id);
    try {
      await PATCH(draftKey(id), { category_code: 'FURNITURE', subcategory_code: 'LIGHTING' });
      // The category alone changes: LIGHTING does not belong to KITCHEN and is emptied (D4).
      const { status } = await PATCH(draftKey(id), { category_code: 'KITCHEN' });
      expect(status).to.equal(200);
      const draft = await readDraft(draftKey(id));
      expect(draft).to.containSubset({ category_code: 'KITCHEN', subcategory_code: null });
      // Silent reset (D8): no message on the draft.
      expect(draft.DraftMessages).to.deep.equal([]);
    } finally {
      await discard();
    }
  });

  it('clears the subcategory when a draft clears the category', async () => {
    await draftEdit(id);
    try {
      await PATCH(draftKey(id), { category_code: 'FURNITURE', subcategory_code: 'LIGHTING' });
      const { status } = await PATCH(draftKey(id), { category_code: null });
      expect(status).to.equal(200);
      const draft = await readDraft(draftKey(id));
      expect(draft).to.containSubset({ category_code: null, subcategory_code: null });
      // No subcategory message, no message at all: @mandatory writes none on a draft (TESTING.md),
      // the empty pair is reported at activation.
      expect(draft.DraftMessages).to.deep.equal([]);
    } finally {
      await discard();
    }
  });

  it('keeps a subcategory that belongs to the category the draft gets', async () => {
    await draftEdit(id);
    try {
      // A pair sent together is not reset; the next category PATCH is compared with LIGHTING.
      await PATCH(draftKey(id), { category_code: 'KITCHEN', subcategory_code: 'LIGHTING' });
      const { status } = await PATCH(draftKey(id), { category_code: 'FURNITURE' });
      expect(status).to.equal(200);
      const draft = await readDraft(draftKey(id));
      expect(draft).to.containSubset({ category_code: 'FURNITURE', subcategory_code: 'LIGHTING' });
    } finally {
      await discard();
    }
  });

  it('reports a mismatched subcategory on the draft and rejects activation', async () => {
    await draftEdit(id);
    try {
      // On a draft the constraint is a message (200), not an error.
      const { status } = await PATCH(draftKey(id), {
        category_code: 'KITCHEN',
        subcategory_code: 'LIGHTING',
      });
      expect(status).to.equal(200);
      const { DraftMessages } = await readDraft(draftKey(id));
      expect(DraftMessages).to.containSubset([
        {
          code: 'PRODUCTS_SUBCATEGORY_MISMATCH',
          message: 'The subcategory does not belong to the category of the product.',
        },
      ]);
      const mismatch = DraftMessages.find((m) => m.code === 'PRODUCTS_SUBCATEGORY_MISMATCH');
      expect(mismatch.target).to.match(/\/subcategory_code$/);
      // Activation enforces it; the target is prefixed with the action parameter `in/`.
      const err = await expect(draftActivate(id)).to.be.rejectedWith(/400/);
      expect(err).to.containSubset({
        code: 'PRODUCTS_SUBCATEGORY_MISMATCH',
        target: 'in/subcategory_code',
      });
    } finally {
      await discard();
    }
  });

  it('activates a draft whose category and subcategory change together', async () => {
    await draftEdit(id);
    try {
      await PATCH(draftKey(id), { category_code: 'ELECTRONICS', subcategory_code: 'AUDIO' });
      const activated = await draftActivate(id);
      expect(activated.status).to.equal(200);
      expect(activated.data).to.containSubset({
        IsActiveEntity: true,
        category_code: 'ELECTRONICS',
        subcategory_code: 'AUDIO',
      });
    } finally {
      await discardIfAny();
    }
    const { data } = await GET(
      `${activeKey(id)}?$select=category_code,subcategory_code,HasDraftEntity`
    );
    expect(data).to.containSubset({
      category_code: 'ELECTRONICS',
      subcategory_code: 'AUDIO',
      HasDraftEntity: false,
    });
  });

  it('records no mismatch for a subcategory chosen before the category and activates with the matching category', async () => {
    // A new draft as Create on the List Report starts it: no category yet (D7).
    const { data: created } = await POST(`${base}/Products`, {});
    newId = created.ID;
    const key = draftKey(newId);

    await PATCH(key, { subcategory_code: 'MICE' });
    let draft = await readDraft(key);
    expect(draft).to.containSubset({ category_code: null, subcategory_code: 'MICE' });
    expect(messageCodes(draft)).to.not.include('PRODUCTS_SUBCATEGORY_MISMATCH');

    // The category MICE belongs to keeps it; the reset clears only a subcategory of another one.
    await PATCH(key, { category_code: 'ELECTRONICS' });
    draft = await readDraft(key);
    expect(draft).to.containSubset({ category_code: 'ELECTRONICS', subcategory_code: 'MICE' });
    expect(messageCodes(draft)).to.not.include('PRODUCTS_SUBCATEGORY_MISMATCH');

    await PATCH(key, { name: 'Draft Mouse', price: '19.99', currency_code: 'USD', stock: 3 });
    // A new draft activates with 201 Created; a draftEdit draft answers 200.
    const activated = await POST(`${key}/CatalogService.draftActivate`, {});
    expect(activated.status).to.equal(201);
    expect(activated.data).to.containSubset({
      IsActiveEntity: true,
      name: 'Draft Mouse',
      category_code: 'ELECTRONICS',
      subcategory_code: 'MICE',
    });
  });
});

// Detail rows of a product (ADR-0026): the composition Products.details, written only through the
// product (lean draft), checked by the set-membership rules of srv/annotations/ProductDetails.cds
// and by the subcategory rule of srv/annotations/Products.cds (PLAN D1, D2, D4). Seeded rows come
// from db/data/my.catalog-ProductDetails.csv; products created here are named 'Details %'.
// Typed detail rows (ADR-0027): one row per attribute of the product's subcategory, the value in the
// column of the attribute's value type, MULTI_LIST values as selections (second composition level).
// Every status, code and target below was measured (research/typed-form-facts.md section 3).
describe('CatalogService.ProductDetails', () => {
  let laptop; // Laptop Pro 15, LAPTOPS: SCREEN_SIZE 15 (DECIMAL), RAM 16, STORAGE 512 (INTEGER)
  let mouse; // Wireless Mouse, MICE: CONNECTIVITY (2 selections), DPI 1600, BATTERY_LIFE empty
  let chair; // Office Chair, SEATING: MATERIAL (Mesh, Aluminium), MAX_LOAD 120, COLOUR empty
  let speaker; // Bluetooth Speaker, AUDIO: CONNECTIVITY (Bluetooth 5.0), BATTERY_LIFE 12, COLOUR empty
  let seededRows; // every seeded detail row, restored after each test
  let seededSelections; // every seeded selection, restored after each test
  let seededProducts; // category and subcategory of every product, restored after each test

  const activeRow = (productId, rowId) =>
    `${activeKey(productId)}/details(ID=${rowId},IsActiveEntity=true)`;
  const draftRow = (productId, rowId) =>
    `${draftKey(productId)}/details(ID=${rowId},IsActiveEntity=false)`;
  // ID of the seeded row of a product for an attribute.
  const rowOf = (productId, code) =>
    seededRows.find((r) => r.product_ID === productId && r.attribute_code === code).ID;
  // Attribute codes of the active rows of a product, sorted.
  const activeCodes = async (productId) => {
    const { data } = await GET(`${activeKey(productId)}/details?$select=attribute_code`);
    return data.value.map((row) => row.attribute_code).sort();
  };
  // The rows of a product (active or draft key) in field order with their values and selections.
  const rowsOf = async (productKey) => {
    const { data } = await GET(
      `${productKey}/details?$orderby=position` +
        '&$select=ID,attribute_code,position,textValue,numberValue,listValue_code' +
        '&$expand=selections($select=value_code;$orderby=value_code)'
    );
    return data.value;
  };
  const codesIn = (rows) => rows.map((row) => row.attribute_code);
  const fieldsIn = (rows) => rows.map((row) => [row.attribute_code, row.position]);
  const selectionsIn = (row) => row.selections.map((s) => s.value_code);
  // Messages of the sap-messages header: a req.warn of a handler travels only there (research R7).
  const warningsOf = (response) => JSON.parse(response.headers['sap-messages'] ?? '[]');
  // Target of a draft row's element, matched by its suffix (TESTING.md): the draft message carries
  // `/Products(...)/details(...)/<element>`, the activation error `in/details(...)/<element>`.
  const rowTarget = (rowId, element) =>
    new RegExp(`details\\(ID=${rowId},IsActiveEntity=false\\)/${element}$`);
  const codesOf = (err) => err.details.map((d) => d.code).sort();
  const ru = { headers: { 'Accept-Language': 'ru' } };
  // An active product created through the API; without `details` it has no rows (PLAN D13).
  const createActive = async (payload) => {
    const { data } = await POST(`${base}/Products`, active({ ...newProduct, ...payload }));
    return data;
  };
  const bareMouse = {
    name: 'Details Bare Mouse',
    category_code: 'ELECTRONICS',
    subcategory_code: 'MICE',
  };

  beforeAll(async () => {
    const names = ['Laptop Pro 15', 'Wireless Mouse', 'Office Chair', 'Bluetooth Speaker'];
    const { data } = await GET(
      `${base}/Products?$filter=name in (${names.map((n) => `'${n}'`).join(',')})&$select=ID,name`
    );
    const idOf = (name) => data.value.find((p) => p.name === name).ID;
    [laptop, mouse, chair, speaker] = names.map(idOf);
    seededRows = await cds.run(cds.ql.SELECT.from('my.catalog.ProductDetails'));
    seededSelections = await cds.run(cds.ql.SELECT.from('my.catalog.ProductDetailSelections'));
    seededProducts = await cds.run(
      cds.ql.SELECT.from('my.catalog.Products').columns('ID', 'category_code', 'subcategory_code')
    );
  });

  afterEach(async () => {
    // Drafts a test left open (a failed activation, a red assertion), discarded through the root.
    const drafts = await cds.run(
      cds.ql.SELECT.from('CatalogService.Products.drafts').columns('ID')
    );
    for (const { ID } of drafts) await DELETE(draftKey(ID));
    // Products created here; rows and selections a test added, changed or removed come back.
    await cds.run(cds.ql.DELETE.from('my.catalog.Products').where`name like 'Details %'`);
    const selectionIds = seededSelections.map((s) => s.ID);
    await cds.run(
      cds.ql.DELETE.from('my.catalog.ProductDetailSelections').where`ID not in ${selectionIds}`
    );
    const rowIds = seededRows.map((r) => r.ID);
    await cds.run(cds.ql.DELETE.from('my.catalog.ProductDetails').where`ID not in ${rowIds}`);
    await cds.run(cds.ql.UPSERT.into('my.catalog.ProductDetails').entries(seededRows));
    await cds.run(
      cds.ql.UPSERT.into('my.catalog.ProductDetailSelections').entries(seededSelections)
    );
    // A category or subcategory an activated draft changed.
    const products = await cds.run(
      cds.ql.SELECT.from('my.catalog.Products').columns('ID', 'category_code', 'subcategory_code')
    );
    for (const { ID, category_code, subcategory_code } of seededProducts) {
      const now = products.find((p) => p.ID === ID);
      if (
        now &&
        (now.category_code !== category_code || now.subcategory_code !== subcategory_code)
      ) {
        await cds.run(
          cds.ql.UPDATE.entity('my.catalog.Products')
            .set({ category_code, subcategory_code })
            .where({ ID })
        );
      }
    }
    // The code list rows of the @readonly test, if a POST was not refused.
    for (const entity of ['DetailAttributes', 'DetailListValues', 'DetailValueTypes']) {
      await cds.run(cds.ql.DELETE.from(`my.catalog.${entity}`).where({ code: 'OTHER' }));
    }
    await cds.run(
      cds.ql.DELETE.from('my.catalog.SubcategoryAttributes').where({
        subcategory_code: 'LAPTOPS',
        attribute_code: 'COLOUR',
      })
    );
  });

  it('returns the typed details of a product in the order of its subcategory', async () => {
    const attribute = 'attribute($select=name,unit,valueType_code,minValue,maxValue,scale)';
    const { data } = await GET(
      `${activeKey(laptop)}/details?$orderby=position&$expand=${attribute}`
    );
    expect(fieldsIn(data.value)).to.deep.equal([
      ['SCREEN_SIZE', 1],
      ['RAM', 2],
      ['STORAGE', 3],
    ]);
    // Decimal(15, 3) arrives as a string with three decimals; the other value columns stay empty.
    expect(data.value).to.containSubset([
      {
        attribute_code: 'SCREEN_SIZE',
        numberValue: '15.000',
        textValue: null,
        listValue_code: null,
        IsActiveEntity: true,
        attribute: {
          name: 'Screen Size',
          unit: 'in',
          valueType_code: 'DECIMAL',
          minValue: '1.000',
          maxValue: '100.000',
          scale: 1,
        },
      },
      {
        attribute_code: 'RAM',
        numberValue: '16.000',
        attribute: {
          name: 'Memory (RAM)',
          unit: 'GB',
          valueType_code: 'INTEGER',
          minValue: '1.000',
          maxValue: '1024.000',
          scale: null,
        },
      },
      {
        attribute_code: 'STORAGE',
        numberValue: '512.000',
        attribute: {
          name: 'Storage',
          unit: 'GB',
          valueType_code: 'INTEGER',
          maxValue: '16384.000',
        },
      },
    ]);
  });

  it('returns the selections of a multi-value detail', async () => {
    // The second composition level is read deeply through the product (research R19).
    const { data } = await GET(
      `${activeKey(mouse)}?$select=ID&$expand=details($orderby=position;` +
        '$select=attribute_code,numberValue;$expand=selections($select=value_code;$orderby=value_code))'
    );
    expect(codesIn(data.details)).to.deep.equal(['CONNECTIVITY', 'DPI', 'BATTERY_LIFE']);
    const [connectivity, dpi, battery] = data.details;
    expect(selectionsIn(connectivity)).to.deep.equal(['BLUETOOTH_5_0', 'WIRELESS_2_4_GHZ']);
    expect(connectivity.selections).to.containSubset([{ IsActiveEntity: true }]);
    expect(dpi).to.containSubset({ numberValue: '1600.000' });
    expect(dpi.selections).to.have.length(0);
    // An empty value is a row without a value (U4), not a missing row.
    expect(battery).to.containSubset({ numberValue: null });
    expect(battery.selections).to.have.length(0);
  });

  it('returns localized attribute names with English fallback', async () => {
    const url = `${base}/DetailAttributes?$filter=code eq 'RAM'&$select=code,name,unit`;
    const inLocale = (locale) => GET(url, { headers: { 'Accept-Language': locale } });

    // Units are Latin and not localized (user decision 2026-10-11).
    const inRussian = await inLocale('ru');
    expect(inRussian.data.value).to.containSubset([
      { code: 'RAM', name: 'Оперативная память', unit: 'GB' },
    ]);

    const en = await inLocale('en');
    expect(en.data.value).to.containSubset([{ code: 'RAM', name: 'Memory (RAM)', unit: 'GB' }]);

    // No German texts in DetailAttributes.texts.csv: the default (English) name is served.
    const de = await inLocale('de');
    expect(de.data.value).to.containSubset([{ code: 'RAM', name: 'Memory (RAM)' }]);
  });

  it('returns the localized values of a list attribute', async () => {
    const colours =
      `${base}/DetailListValues?$filter=attribute_code eq 'COLOUR'` +
      '&$orderby=position&$select=code,name,position';
    const inRussian = await GET(colours, ru);
    expect(inRussian.data.value).to.have.length(12);
    expect(inRussian.data.value.slice(0, 3).map((v) => v.code)).to.deep.equal([
      'BLACK',
      'WHITE',
      'GREY',
    ]);
    expect(inRussian.data.value).to.containSubset([
      { code: 'BLACK', name: 'Черный', position: 1 },
      { code: 'MULTICOLOUR', name: 'Разноцветный', position: 12 },
    ]);
    const inEnglish = await GET(colours, { headers: { 'Accept-Language': 'en' } });
    expect(inEnglish.data.value).to.containSubset([{ code: 'BLACK', name: 'Black' }]);

    // Through a row, the values of its attribute: Russian where a text exists, English otherwise
    // (Latin designations have no ru text, PLAN D22).
    const { data } = await GET(
      `${activeRow(speaker, rowOf(speaker, 'CONNECTIVITY'))}?$select=ID` +
        '&$expand=attribute($select=code;$expand=values($select=code,name;$orderby=position))',
      ru
    );
    expect(data.attribute.values.map((v) => v.code)).to.deep.equal([
      'BLUETOOTH_5_0',
      'BLUETOOTH_5_3',
      'WIRELESS_2_4_GHZ',
      'WIFI',
      'WIRED_USB',
      'WIRED_AUDIO_JACK',
    ]);
    expect(data.attribute.values).to.containSubset([
      { code: 'WIRELESS_2_4_GHZ', name: 'Беспроводное 2,4 ГГц' },
      { code: 'WIRED_USB', name: 'Проводное (USB)' },
      { code: 'BLUETOOTH_5_0', name: 'Bluetooth 5.0' },
      { code: 'WIFI', name: 'Wi-Fi' },
    ]);
  });

  it('lists the attributes assigned to a subcategory in their order', async () => {
    const { data } = await GET(
      `${base}/SubcategoryAttributes?$filter=subcategory_code eq 'LAPTOPS'&$orderby=position`
    );
    expect(data.value.map((a) => [a.attribute_code, a.position])).to.deep.equal([
      ['SCREEN_SIZE', 1],
      ['RAM', 2],
      ['STORAGE', 3],
    ]);
    // A plain projection: the form reads attribute/name, the value help name of revision 1 is gone.
    for (const assignment of data.value) expect(assignment).to.not.have.property('attributeName');
  });

  it('does not allow creating attributes, assignments, list values or value types (@readonly)', async () => {
    const writes = [
      ['DetailAttributes', { code: 'OTHER', name: 'Other' }],
      ['SubcategoryAttributes', { subcategory_code: 'LAPTOPS', attribute_code: 'COLOUR' }],
      ['DetailListValues', { code: 'OTHER', attribute_code: 'COLOUR', name: 'Other' }],
      ['DetailValueTypes', { code: 'OTHER', name: 'Other' }],
    ];
    for (const [set, payload] of writes) {
      const err = await expect(POST(`${base}/${set}`, payload)).to.be.rejectedWith(/405/);
      expect(err, set).to.containSubset({ code: 'ENTITY_IS_READ_ONLY' });
    }

    const counts = {};
    for (const [set] of writes) {
      const { data } = await GET(`${base}/${set}?$count=true&$top=0`);
      counts[set] = data['@odata.count'];
    }
    expect(counts).to.deep.equal({
      DetailAttributes: 20,
      SubcategoryAttributes: 45,
      DetailListValues: 42,
      DetailValueTypes: 5,
    });
  });

  it('rejects a direct write to ProductDetails or its selections outside the product (lean draft)', async () => {
    const connectivity = rowOf(mouse, 'CONNECTIVITY');
    const selection = seededSelections.find((s) => s.detail_ID === connectivity).ID;
    const writes = [
      [
        'ProductDetails',
        { product_ID: mouse, attribute_code: 'BATTERY_LIFE', numberValue: 12 },
        rowOf(mouse, 'DPI'),
        { numberValue: 800 },
      ],
      [
        'ProductDetailSelections',
        { detail_ID: connectivity, value_code: 'WIFI' },
        selection,
        { value_code: 'WIFI' },
      ],
    ];
    for (const [set, payload, id, change] of writes) {
      // Active and draft POST of an editor, active POST of a viewer: lean draft answers first.
      for (const [body, options] of [
        [active(payload)],
        [payload],
        [active(payload), as('viewer')],
      ]) {
        const err = await expect(POST(`${base}/${set}`, body, options)).to.be.rejectedWith(/422/);
        expect(err, set).to.containSubset({ code: 'DRAFT_MODIFICATION_ONLY_VIA_ROOT' });
      }
      const patch = await expect(
        PATCH(`${base}/${set}(ID=${id},IsActiveEntity=true)`, change)
      ).to.be.rejectedWith(/422/);
      expect(patch, set).to.containSubset({ code: 'DRAFT_MODIFICATION_ONLY_VIA_ROOT' });

      // Measured: a viewer's draft POST (no IsActiveEntity) is refused by the grant before lean draft.
      const viewerDraft = await expect(
        POST(`${base}/${set}`, payload, as('viewer'))
      ).to.be.rejectedWith(/403/);
      expect(viewerDraft, set).to.containSubset({ code: '403' });
    }

    // Nothing was written, neither an active row or selection nor a draft.
    const rows = await rowsOf(activeKey(mouse));
    expect(codesIn(rows)).to.deep.equal(['CONNECTIVITY', 'DPI', 'BATTERY_LIFE']);
    expect(selectionsIn(rows[0])).to.deep.equal(['BLUETOOTH_5_0', 'WIRELESS_2_4_GHZ']);
    expect(rows[1]).to.containSubset({ numberValue: '1600.000' });
    const { data } = await GET(`${activeKey(mouse)}?$select=HasDraftEntity`);
    expect(data).to.containSubset({ HasDraftEntity: false });
  });

  it('deletes a detail row or a selection addressed directly like one addressed through the product (lean draft)', async () => {
    // A product of its own, so no seeded row is touched. Lean draft refuses only POST and PATCH of a
    // child; a direct DELETE is accepted and authorized like the one through the product (R22).
    const product = await createActive(bareMouse);
    const { data: row } = await POST(`${activeKey(product.ID)}/details`, {
      attribute_code: 'CONNECTIVITY',
    });
    const { data: selection } = await POST(`${activeRow(product.ID, row.ID)}/selections`, {
      value_code: 'WIFI',
    });
    const directRow = `${base}/ProductDetails(ID=${row.ID},IsActiveEntity=true)`;
    const directSelection = `${base}/ProductDetailSelections(ID=${selection.ID},IsActiveEntity=true)`;

    // The child grants answer: a viewer may not delete.
    for (const url of [directRow, directSelection]) {
      const err = await expect(DELETE(url, as('viewer'))).to.be.rejectedWith(/403/);
      expect(err, url).to.containSubset({ code: '403' });
    }
    // While the product has a draft the active row and selection are locked with it (R22b).
    await draftEdit(product.ID);
    for (const url of [directRow, directSelection]) {
      const err = await expect(DELETE(url)).to.be.rejectedWith(/403/);
      expect(err, url).to.containSubset({ code: 'DRAFT_ACTIVE_DELETE_FORBIDDEN_DRAFT_EXISTS' });
    }
    expect((await DELETE(draftKey(product.ID))).status).to.equal(204);

    // Without a draft an editor deletes them as through the product.
    expect((await DELETE(directSelection)).status).to.equal(204);
    const { data: left } = await GET(`${activeRow(product.ID, row.ID)}/selections?$select=ID`);
    expect(left.value).to.have.length(0);
    expect((await DELETE(directRow)).status).to.equal(204);
    expect(await rowsOf(activeKey(product.ID))).to.have.length(0);
  });

  it('creates a detail row of an active product through the product', async () => {
    // Every seeded product has all its rows; a product created through the API has none (D13).
    const product = await createActive(bareMouse);
    const { status, data } = await POST(`${activeKey(product.ID)}/details`, {
      attribute_code: 'BATTERY_LIFE',
      numberValue: 12,
    });
    expect(status).to.equal(201);
    expect(data).to.containSubset({
      IsActiveEntity: true,
      product_ID: product.ID,
      attribute_code: 'BATTERY_LIFE',
      numberValue: '12.000',
    });
    const { data: stored } = await GET(
      `${activeRow(product.ID, data.ID)}?$select=numberValue&$expand=attribute($select=name,unit)`
    );
    expect(stored).to.containSubset({
      numberValue: '12.000',
      attribute: { name: 'Battery Life', unit: 'h' },
    });
    expect(await activeCodes(product.ID)).to.deep.equal(['BATTERY_LIFE']);
  });

  it('rejects an attribute that is not assigned to the subcategory of the product (PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED)', async () => {
    // COLOUR exists, but MICE has CONNECTIVITY, DPI and BATTERY_LIFE only.
    const created = await expect(
      POST(`${activeKey(mouse)}/details`, { attribute_code: 'COLOUR', listValue_code: 'BLACK' })
    ).to.be.rejectedWith(/400/);
    expect(created).to.containSubset({
      code: 'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED',
      target: 'attribute_code',
    });
    expect(created.message).to.contain(
      'The attribute is not available for the subcategory of the product.'
    );

    // The empty BATTERY_LIFE row: no value a COLOUR row could not hold, only the assignment fails.
    const changed = await expect(
      PATCH(activeRow(mouse, rowOf(mouse, 'BATTERY_LIFE')), { attribute_code: 'COLOUR' })
    ).to.be.rejectedWith(/400/);
    expect(changed).to.containSubset({
      code: 'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED',
      target: 'attribute_code',
    });
    expect(await activeCodes(mouse)).to.deep.equal(['BATTERY_LIFE', 'CONNECTIVITY', 'DPI']);
  });

  it('reports the unassigned attribute in Russian', async () => {
    const err = await expect(
      POST(`${activeKey(mouse)}/details`, { attribute_code: 'COLOUR' }, ru)
    ).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED' });
    expect(err.message).to.contain('Характеристика недоступна для подкатегории товара.');
  });

  it('rejects an unknown attribute code (@assert.target)', async () => {
    const err = await expect(
      POST(`${activeKey(mouse)}/details`, { attribute_code: 'UNKNOWN' })
    ).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'ASSERT_TARGET', target: 'attribute_code' });
    expect(await activeCodes(mouse)).to.deep.equal(['BATTERY_LIFE', 'CONNECTIVITY', 'DPI']);
  });

  it('rejects a detail row without an attribute but accepts one without a value (@mandatory, U4)', async () => {
    const noAttribute = await expect(
      POST(`${activeKey(mouse)}/details`, { numberValue: 12 })
    ).to.be.rejectedWith(/400/);
    expect(noAttribute).to.containSubset({ code: 'ASSERT_MANDATORY', target: 'attribute_code' });
    expect(await activeCodes(mouse)).to.deep.equal(['BATTERY_LIFE', 'CONNECTIVITY', 'DPI']);

    // Values are optional (U4, replaces the revision 1 @mandatory value): every value column empty.
    const product = await createActive(bareMouse);
    const { status, data } = await POST(`${activeKey(product.ID)}/details`, {
      attribute_code: 'BATTERY_LIFE',
    });
    expect(status).to.equal(201);
    expect(data).to.containSubset({
      attribute_code: 'BATTERY_LIFE',
      textValue: null,
      numberValue: null,
      listValue_code: null,
    });
  });

  it('rejects a second row for the same attribute of a product (PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE)', async () => {
    const err = await expect(
      POST(`${activeKey(mouse)}/details`, { attribute_code: 'CONNECTIVITY' })
    ).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({
      code: 'PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE',
      target: 'attribute_code',
    });
    expect(err.message).to.contain('The product already has a row for this attribute.');
    const { data } = await GET(
      `${activeKey(mouse)}/details?$filter=attribute_code eq 'CONNECTIVITY'&$select=ID` +
        '&$expand=selections($select=value_code;$orderby=value_code)'
    );
    expect(data.value).to.have.length(1);
    expect(selectionsIn(data.value[0])).to.deep.equal(['BLUETOOTH_5_0', 'WIRELESS_2_4_GHZ']);
  });

  it('rejects a subcategory change of an active product whose details do not fit (PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS)', async () => {
    // MICE belongs to ELECTRONICS like LAPTOPS: no mismatch, only the details rule applies. Active
    // writes are never reconciled (ADR-0027 decision 3): the root constraint is the API guard (D15).
    const err = await expect(
      PATCH(activeKey(laptop), { subcategory_code: 'MICE' })
    ).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({
      code: 'PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS',
      target: 'subcategory_code',
    });
    expect(err.message).to.contain(
      'Some detail rows do not fit the new subcategory. Delete or change them before saving.'
    );
    const { data: stored } = await GET(`${activeKey(laptop)}?$select=subcategory_code`);
    expect(stored).to.containSubset({ subcategory_code: 'LAPTOPS' });
    expect(await activeCodes(laptop)).to.deep.equal(['RAM', 'SCREEN_SIZE', 'STORAGE']);

    // Rows that fit the new subcategory do not block it: AUDIO and MICE both have these two.
    const copy = await createActive({
      name: 'Details Speaker',
      category_code: 'ELECTRONICS',
      subcategory_code: 'AUDIO',
      details: [
        { attribute_code: 'CONNECTIVITY', selections: [{ value_code: 'BLUETOOTH_5_0' }] },
        { attribute_code: 'BATTERY_LIFE', numberValue: 12 },
      ],
    });
    const moved = await PATCH(activeKey(copy.ID), { subcategory_code: 'MICE' });
    expect(moved.status).to.equal(200);
    expect(moved.data).to.containSubset({ subcategory_code: 'MICE' });
    // Outside a draft the rows stay as they are: no DPI row is created.
    expect(await activeCodes(copy.ID)).to.deep.equal(['BATTERY_LIFE', 'CONNECTIVITY']);
  });

  it('creates a product with its details in one request and deletes them with the product', async () => {
    // SEATING has MATERIAL (MULTI_LIST), MAX_LOAD (INTEGER) and COLOUR (LIST): one row per value column.
    const details = [
      { attribute_code: 'MATERIAL', selections: [{ value_code: 'MESH' }, { value_code: 'WOOD' }] },
      { attribute_code: 'MAX_LOAD', numberValue: 150 },
      { attribute_code: 'COLOUR', listValue_code: 'BLACK' },
    ];
    const { status, data } = await POST(
      `${base}/Products`,
      active({ ...newProduct, name: 'Details Chair', subcategory_code: 'SEATING', details })
    );
    expect(status).to.equal(201);
    expect(data.details).to.have.length(3);
    expect(data.details).to.containSubset([
      {
        attribute_code: 'MATERIAL',
        product_ID: data.ID,
        IsActiveEntity: true,
        selections: [{ value_code: 'MESH' }, { value_code: 'WOOD' }],
      },
      { attribute_code: 'MAX_LOAD', numberValue: '150.000' },
      { attribute_code: 'COLOUR', listValue_code: 'BLACK' },
    ]);
    // Rows and selections of the product, read through the service.
    const storedOf = async (productId) => {
      const rows = await GET(
        `${base}/ProductDetails?$filter=product_ID eq ${productId}&$select=ID`
      );
      const selections = await GET(
        `${base}/ProductDetailSelections?$filter=detail/product_ID eq ${productId}&$select=ID`
      );
      return [rows.data.value.length, selections.data.value.length];
    };
    expect(await storedOf(data.ID)).to.deep.equal([3, 2]);

    // A foreign row is reported on the root's subcategory and on the row itself (ADR-0026).
    const foreign = active({
      ...newProduct,
      name: 'Details Foreign Lamp',
      details: [{ attribute_code: 'RAM', numberValue: 16 }],
    });
    const err = await expect(POST(`${base}/Products`, foreign)).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'MULTIPLE_ERRORS' });
    expect(codesOf(err)).to.deep.equal([
      'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED',
      'PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS',
    ]);
    expect(err.details).to.containSubset([
      { code: 'PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS', target: 'subcategory_code' },
    ]);
    const row = err.details.find((d) => d.code === 'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED');
    expect(row.target).to.match(/^details\(ID=[^)]+\)\/attribute_code$/);
    const { data: rejected } = await GET(
      `${base}/Products?$filter=name eq 'Details Foreign Lamp'&$select=ID`
    );
    expect(rejected.value).to.have.length(0);

    // The composition cascades over both levels.
    const removed = await DELETE(activeKey(data.ID));
    expect(removed.status).to.equal(204);
    expect(await storedOf(data.ID)).to.deep.equal([0, 0]);
  });

  it('lets a CatalogViewer read details and forbids writing them', async () => {
    const all = await GET(`${base}/ProductDetails?$select=ID&$count=true`, as('viewer'));
    expect(all.status).to.equal(200);
    expect(all.data['@odata.count']).to.equal(45);
    const ofProduct = await GET(`${activeKey(mouse)}/details?$select=attribute_code`, as('viewer'));
    expect(ofProduct.status).to.equal(200);
    expect(ofProduct.data.value).to.have.length(3);

    const dpi = activeRow(mouse, rowOf(mouse, 'DPI'));
    const post = await expect(
      POST(`${activeKey(mouse)}/details`, { attribute_code: 'BATTERY_LIFE' }, as('viewer'))
    ).to.be.rejectedWith(/403/);
    expect(post).to.containSubset({ code: '403' });
    const patch = await expect(PATCH(dpi, { numberValue: 800 }, as('viewer'))).to.be.rejectedWith(
      /403/
    );
    expect(patch).to.containSubset({ code: '403' });
    const remove = await expect(DELETE(dpi, as('viewer'))).to.be.rejectedWith(/403/);
    expect(remove).to.containSubset({ code: '403' });

    const { data } = await GET(`${dpi}?$select=numberValue`);
    expect(data).to.containSubset({ numberValue: '1600.000' });
    expect(await activeCodes(mouse)).to.deep.equal(['BATTERY_LIFE', 'CONNECTIVITY', 'DPI']);
  });

  it('forbids a user without a catalog role to read details', async () => {
    // carol is a default mock user (role `admin`), unknown to this model.
    const direct = await expect(
      GET(`${base}/ProductDetails?$top=1`, as('carol'))
    ).to.be.rejectedWith(/403/);
    expect(direct).to.containSubset({ code: '403' });
    const ofProduct = await expect(
      GET(`${activeKey(mouse)}/details`, as('carol'))
    ).to.be.rejectedWith(/403/);
    expect(ofProduct).to.containSubset({ code: '403' });

    // The code lists of the form stay readable for every authenticated user.
    for (const set of [
      'DetailAttributes',
      'SubcategoryAttributes',
      'DetailListValues',
      'DetailValueTypes',
    ]) {
      const { status } = await GET(`${base}/${set}?$top=1`, as('carol'));
      expect(status, set).to.equal(200);
    }
  });

  it('adds a detail row to a draft and activates it', async () => {
    await draftEdit(mouse);
    // The draft has a row for every assigned attribute (U2); through the API one can be replaced.
    const seeded = rowOf(mouse, 'BATTERY_LIFE');
    expect((await DELETE(draftRow(mouse, seeded))).status).to.equal(204);
    const { status, data } = await POST(`${draftKey(mouse)}/details`, {
      attribute_code: 'BATTERY_LIFE',
      numberValue: 12,
    });
    expect(status).to.equal(201);
    expect(data).to.containSubset({
      IsActiveEntity: false,
      HasActiveEntity: false,
      attribute_code: 'BATTERY_LIFE',
      numberValue: '12.000',
    });
    // Before Save the change lives only in the draft.
    const { data: before } = await GET(`${activeRow(mouse, seeded)}?$select=numberValue`);
    expect(before).to.containSubset({ numberValue: null });

    const activated = await draftActivate(mouse);
    expect(activated.status).to.equal(200);
    expect(await activeCodes(mouse)).to.deep.equal(['BATTERY_LIFE', 'CONNECTIVITY', 'DPI']);
    const { data: stored } = await GET(`${activeRow(mouse, data.ID)}?$select=numberValue`);
    expect(stored).to.containSubset({ numberValue: '12.000', IsActiveEntity: true });
    await expect(GET(activeRow(mouse, seeded))).to.be.rejectedWith(/404/);
  });

  it('reports an unassigned attribute on the draft row and rejects activation', async () => {
    await draftEdit(mouse);
    // The empty BATTERY_LIFE row: a filled one would also fail the typed rules of COLOUR (measured).
    const battery = rowOf(mouse, 'BATTERY_LIFE');
    const row = draftRow(mouse, battery);
    // On a draft the constraint is a message (200), written at commit and read by the next GET.
    const { status } = await PATCH(row, { attribute_code: 'COLOUR' });
    expect(status).to.equal(200);
    const onRow = await readDraft(row, 'ID,DraftMessages');
    expect(messageCodes(onRow)).to.deep.equal(['PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED']);
    expect(onRow.DraftMessages[0]).to.containSubset({
      message: 'The attribute is not available for the subcategory of the product.',
    });
    expect(onRow.DraftMessages[0].target).to.match(rowTarget(battery, 'attribute_code'));
    const onRoot = await readDraft(draftKey(mouse), 'ID,DraftMessages');
    expect(messageCodes(onRoot)).to.deep.equal(['PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED']);

    // Activation enforces it. Measured: the foreign row also trips the root's subcategory rule.
    const err = await expect(draftActivate(mouse)).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'MULTIPLE_ERRORS' });
    expect(codesOf(err)).to.deep.equal([
      'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED',
      'PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS',
    ]);
    const notAssigned = err.details.find(
      (d) => d.code === 'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED'
    );
    expect(notAssigned.target).to.match(rowTarget(battery, 'attribute_code'));
    const foreign = err.details.find((d) => d.code === 'PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS');
    expect(foreign.target).to.match(/\/subcategory_code$/);
    // The active row keeps its attribute.
    const { data } = await GET(`${activeRow(mouse, battery)}?$select=attribute_code`);
    expect(data).to.containSubset({ attribute_code: 'BATTERY_LIFE' });
  });

  it('reports a duplicate attribute on the draft row and rejects activation', async () => {
    await draftEdit(mouse);
    const battery = rowOf(mouse, 'BATTERY_LIFE');
    const row = draftRow(mouse, battery);
    const { status } = await PATCH(row, { attribute_code: 'CONNECTIVITY' });
    expect(status).to.equal(200);
    const onRow = await readDraft(row, 'ID,DraftMessages');
    expect(messageCodes(onRow)).to.deep.equal(['PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE']);
    expect(onRow.DraftMessages[0].target).to.match(rowTarget(battery, 'attribute_code'));

    // Activation checks every row: both rows with CONNECTIVITY are named.
    const err = await expect(draftActivate(mouse)).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'MULTIPLE_ERRORS' });
    expect(codesOf(err)).to.deep.equal([
      'PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE',
      'PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE',
    ]);
    for (const rowId of [battery, rowOf(mouse, 'CONNECTIVITY')]) {
      const target = rowTarget(rowId, 'attribute_code');
      expect(err.details.filter((d) => target.test(d.target))).to.have.length(1);
    }
  });

  it('creates the detail rows of a new draft when its subcategory is set (U2)', async () => {
    // Create posts an empty draft and PATCHes the fields one by one; no rows before a subcategory.
    const { data: draft } = await POST(`${base}/Products`, {
      ...without('subcategory_code'),
      name: 'Details New Laptop',
      category_code: 'ELECTRONICS',
    });
    expect(await rowsOf(draftKey(draft.ID))).to.have.length(0);

    const patched = await PATCH(draftKey(draft.ID), { subcategory_code: 'LAPTOPS' });
    expect(patched.status).to.equal(200);
    expect(warningsOf(patched)).to.have.length(0);
    const rows = await rowsOf(draftKey(draft.ID));
    expect(fieldsIn(rows)).to.deep.equal([
      ['SCREEN_SIZE', 1],
      ['RAM', 2],
      ['STORAGE', 3],
    ]);
    for (const row of rows) {
      expect(row).to.containSubset({ textValue: null, numberValue: null, listValue_code: null });
    }

    const ram = rows.find((row) => row.attribute_code === 'RAM').ID;
    expect((await PATCH(draftRow(draft.ID, ram), { numberValue: 32 })).status).to.equal(200);
    const activated = await draftActivate(draft.ID);
    expect(activated.status).to.equal(201);
    // Empty values are saved as empty rows (U4); the @readonly position survives activation (R5).
    const saved = await rowsOf(activeKey(draft.ID));
    expect(
      saved.map((row) => [row.ID, row.attribute_code, row.position, row.numberValue])
    ).to.deep.equal(
      rows.map((row) => [
        row.ID,
        row.attribute_code,
        row.position,
        row.ID === ram ? '32.000' : null,
      ])
    );
  });

  it('fills the missing detail rows when a product is edited (D13)', async () => {
    const product = await createActive(bareMouse);
    expect(await rowsOf(activeKey(product.ID))).to.have.length(0);

    expect((await draftEdit(product.ID)).status).to.equal(201);
    const rows = await rowsOf(draftKey(product.ID));
    expect(fieldsIn(rows)).to.deep.equal([
      ['CONNECTIVITY', 1],
      ['DPI', 2],
      ['BATTERY_LIFE', 3],
    ]);
    for (const row of rows) {
      expect(row).to.containSubset({ numberValue: null });
      expect(row.selections).to.have.length(0);
    }
    // Until Save only the draft has them.
    expect(await rowsOf(activeKey(product.ID))).to.have.length(0);

    // A product with all its rows gets no extra one: the draft holds exactly the seeded rows.
    await draftEdit(mouse);
    const mouseRows = await rowsOf(draftKey(mouse));
    expect(mouseRows.map((row) => row.ID)).to.deep.equal(
      ['CONNECTIVITY', 'DPI', 'BATTERY_LIFE'].map((code) => rowOf(mouse, code))
    );
  });

  it('keeps common detail rows, replaces the others and warns when the subcategory changes (U3)', async () => {
    await draftEdit(mouse);
    // AUDIO has CONNECTIVITY, BATTERY_LIFE and COLOUR; MICE has CONNECTIVITY, DPI and BATTERY_LIFE.
    const toAudio = await PATCH(draftKey(mouse), { subcategory_code: 'AUDIO' });
    expect(toAudio.status).to.equal(200);
    // Only the filled DPI value is lost: the warning counts and names it (D16) ...
    const warnings = warningsOf(toAudio);
    expect(warnings).to.have.length(1);
    expect(warnings[0]).to.containSubset({
      code: 'PRODUCTS_DETAILS_VALUES_REMOVED',
      target: 'subcategory_code',
      numericSeverity: 3,
      message:
        'Values removed: 1. These details do not apply to the new subcategory: Sensor Resolution.',
    });
    // ... in the response only: no draft message is written (research R7).
    expect(messageCodes(await readDraft(draftKey(mouse), 'ID,DraftMessages'))).to.deep.equal([]);

    const inAudio = await rowsOf(draftKey(mouse));
    expect(fieldsIn(inAudio)).to.deep.equal([
      ['CONNECTIVITY', 1],
      ['BATTERY_LIFE', 2],
      ['COLOUR', 3],
    ]);
    // The common rows are the same rows with their values and selections; COLOUR is new and empty.
    expect(inAudio[0].ID).to.equal(rowOf(mouse, 'CONNECTIVITY'));
    expect(selectionsIn(inAudio[0])).to.deep.equal(['BLUETOOTH_5_0', 'WIRELESS_2_4_GHZ']);
    expect(inAudio[1].ID).to.equal(rowOf(mouse, 'BATTERY_LIFE'));
    expect(seededRows.map((r) => r.ID)).to.not.include(inAudio[2].ID);
    expect(inAudio[2]).to.containSubset({ listValue_code: null });

    // Back to MICE only the empty COLOUR row goes, so no warning; DPI comes back empty.
    const back = await PATCH(draftKey(mouse), { subcategory_code: 'MICE' });
    expect(back.status).to.equal(200);
    expect(warningsOf(back)).to.have.length(0);
    const inMice = await rowsOf(draftKey(mouse));
    expect(fieldsIn(inMice)).to.deep.equal([
      ['CONNECTIVITY', 1],
      ['DPI', 2],
      ['BATTERY_LIFE', 3],
    ]);
    expect(inMice[1].ID).to.not.equal(rowOf(mouse, 'DPI'));
    expect(inMice[1]).to.containSubset({ numberValue: null });

    // Save stores exactly these rows.
    expect((await draftActivate(mouse)).status).to.equal(200);
    const shape = (rows) =>
      rows.map((row) => [
        row.ID,
        row.attribute_code,
        row.position,
        row.numberValue,
        selectionsIn(row),
      ]);
    expect(shape(await rowsOf(activeKey(mouse)))).to.deep.equal(shape(inMice));
  });

  it('removes the selections of a replaced multi-value row', async () => {
    await draftEdit(chair);
    const material = rowOf(chair, 'MATERIAL');
    const draftSelections = () =>
      cds.run(
        cds.ql.SELECT.from('CatalogService.ProductDetailSelections.drafts').columns('detail_ID')
      );
    expect(await draftSelections()).to.deep.equal([
      { detail_ID: material },
      { detail_ID: material },
    ]);

    // LIGHTING has POWER, BRIGHTNESS and COLOUR: MATERIAL (Mesh, Aluminium) and MAX_LOAD (120) go.
    // Asked in ru: the handler reads the names with SELECT.localized, in their old field order.
    const changed = await PATCH(draftKey(chair), { subcategory_code: 'LIGHTING' }, ru);
    expect(changed.status).to.equal(200);
    const warnings = warningsOf(changed);
    expect(warnings).to.have.length(1);
    expect(warnings[0]).to.containSubset({
      code: 'PRODUCTS_DETAILS_VALUES_REMOVED',
      target: 'subcategory_code',
      message:
        'Удалено значений: 2. Эти характеристики не относятся к новой подкатегории: ' +
        'Материал, Максимальная нагрузка.',
    });
    const rows = await rowsOf(draftKey(chair));
    expect(codesIn(rows)).to.deep.equal(['POWER', 'BRIGHTNESS', 'COLOUR']);
    expect(rows[2].ID).to.equal(rowOf(chair, 'COLOUR'));
    // The deleted row takes its draft selections along (composition, research R8): none orphaned.
    expect(await draftSelections()).to.have.length(0);

    expect((await draftActivate(chair)).status).to.equal(200);
    expect(await activeCodes(chair)).to.deep.equal(['BRIGHTNESS', 'COLOUR', 'POWER']);
    const { data } = await GET(
      `${base}/ProductDetailSelections?$filter=detail_ID eq ${material}&$select=ID`
    );
    expect(data.value).to.have.length(0);
    // No active selection is left without its row either.
    const rowIds = new Set(
      (await cds.run(cds.ql.SELECT.from('my.catalog.ProductDetails').columns('ID'))).map(
        (r) => r.ID
      )
    );
    const selections = await cds.run(
      cds.ql.SELECT.from('my.catalog.ProductDetailSelections').columns('detail_ID')
    );
    expect(selections.filter((s) => !rowIds.has(s.detail_ID))).to.have.length(0);
  });

  it('keeps the detail rows while the subcategory is empty', async () => {
    await draftEdit(chair);
    // SEATING is no KITCHEN subcategory: the ADR-0024 reset empties it and the rows wait (D10).
    const toKitchen = await PATCH(draftKey(chair), { category_code: 'KITCHEN' });
    expect(toKitchen.status).to.equal(200);
    expect(toKitchen.data).to.containSubset({ category_code: 'KITCHEN', subcategory_code: null });
    expect(warningsOf(toKitchen)).to.have.length(0);
    const waiting = await rowsOf(draftKey(chair));
    expect(waiting.map((row) => row.ID)).to.deep.equal(
      ['MATERIAL', 'MAX_LOAD', 'COLOUR'].map((code) => rowOf(chair, code))
    );
    expect(selectionsIn(waiting[0])).to.deep.equal(['ALUMINIUM', 'MESH']);
    expect(waiting[1]).to.containSubset({ numberValue: '120.000' });

    // DRINKWARE has CAPACITY, MATERIAL and COLOUR: the materials survive the category change.
    const toDrinkware = await PATCH(draftKey(chair), { subcategory_code: 'DRINKWARE' });
    expect(toDrinkware.status).to.equal(200);
    expect(warningsOf(toDrinkware)).to.containSubset([
      {
        code: 'PRODUCTS_DETAILS_VALUES_REMOVED',
        message:
          'Values removed: 1. These details do not apply to the new subcategory: Maximum Load.',
      },
    ]);
    const rows = await rowsOf(draftKey(chair));
    expect(fieldsIn(rows)).to.deep.equal([
      ['CAPACITY', 1],
      ['MATERIAL', 2],
      ['COLOUR', 3],
    ]);
    expect(rows[1].ID).to.equal(rowOf(chair, 'MATERIAL'));
    expect(selectionsIn(rows[1])).to.deep.equal(['ALUMINIUM', 'MESH']);
    expect(rows[2].ID).to.equal(rowOf(chair, 'COLOUR'));
  });

  it('rejects numbers outside the range, fractions of whole-number attributes and non-numbers', async () => {
    // BATTERY_LIFE is INTEGER from 1 to 10000 h; the Speaker's row holds 12.
    const battery = activeRow(speaker, rowOf(speaker, 'BATTERY_LIFE'));
    const rejected = [
      [20000, 'PRODUCTS_DETAIL_VALUE_OUT_OF_RANGE'],
      [0, 'PRODUCTS_DETAIL_VALUE_OUT_OF_RANGE'],
      [2.5, 'PRODUCTS_DETAIL_VALUE_NOT_INTEGER'],
      // The framework's check of Decimal(15, 3): no number, a decimal comma, more than 3 decimals.
      ['abc', 'ASSERT_DATA_TYPE'],
      ['1,5', 'ASSERT_DATA_TYPE'],
      [12.0001, 'ASSERT_DATA_TYPE'],
    ];
    for (const [numberValue, code] of rejected) {
      const err = await expect(PATCH(battery, { numberValue })).to.be.rejectedWith(/400/);
      expect(err, String(numberValue)).to.containSubset({ code, target: 'numberValue' });
    }
    const { data } = await GET(`${battery}?$select=numberValue`);
    expect(data).to.containSubset({ numberValue: '12.000' });

    // A DECIMAL attribute takes a fraction (its own scale is checked on the client, PLAN D19).
    const screen = await PATCH(activeRow(laptop, rowOf(laptop, 'SCREEN_SIZE')), {
      numberValue: 15.6,
    });
    expect(screen.status).to.equal(200);
    expect(screen.data).to.containSubset({ numberValue: '15.600' });
  });

  it('rejects a value in the column of another value type', async () => {
    // A LIST row takes listValue, a MULTI_LIST row selections, an INTEGER row numberValue.
    const rejected = [
      ['COLOUR', { numberValue: 3 }, 'numberValue'],
      ['CONNECTIVITY', { listValue_code: 'WIFI' }, 'listValue_code'],
      ['BATTERY_LIFE', { textValue: 'long' }, 'textValue'],
    ];
    for (const [code, change, target] of rejected) {
      const err = await expect(
        PATCH(activeRow(speaker, rowOf(speaker, code)), change)
      ).to.be.rejectedWith(/400/);
      expect(err, code).to.containSubset({ code: 'PRODUCTS_DETAIL_VALUE_TYPE_MISMATCH', target });
      expect(err.message).to.contain('The value does not match the type of this detail.');
    }
    expect(await rowsOf(activeKey(speaker))).to.containSubset([
      { attribute_code: 'CONNECTIVITY', listValue_code: null },
      { attribute_code: 'BATTERY_LIFE', textValue: null, numberValue: '12.000' },
      { attribute_code: 'COLOUR', numberValue: null },
    ]);
  });

  it("accepts only values of the attribute's list", async () => {
    const colour = activeRow(speaker, rowOf(speaker, 'COLOUR'));
    // A4 exists, but in the PAPER_SIZE list (ADR-0024 pair form); NOPE does not exist at all.
    const foreign = await expect(PATCH(colour, { listValue_code: 'A4' })).to.be.rejectedWith(/400/);
    expect(foreign).to.containSubset({
      code: 'PRODUCTS_DETAIL_VALUE_NOT_IN_LIST',
      target: 'listValue_code',
    });
    expect(foreign.message).to.contain('Select a value from the list.');
    const unknown = await expect(PATCH(colour, { listValue_code: 'NOPE' })).to.be.rejectedWith(
      /400/
    );
    expect(unknown).to.containSubset({ code: 'ASSERT_TARGET', target: 'listValue_code' });

    const black = await PATCH(colour, { listValue_code: 'BLACK' });
    expect(black.status).to.equal(200);
    const { data } = await GET(`${colour}?$select=listValue_code&$expand=listValue($select=name)`);
    expect(data).to.containSubset({ listValue_code: 'BLACK', listValue: { name: 'Black' } });
  });

  it('reports a typed value error in Russian', async () => {
    const row = (code) => activeRow(speaker, rowOf(speaker, code));
    const rejected = [
      [
        () => PATCH(row('BATTERY_LIFE'), { numberValue: 20000 }, ru),
        'PRODUCTS_DETAIL_VALUE_OUT_OF_RANGE',
        'Введите значение в допустимом диапазоне.',
      ],
      [
        () => PATCH(row('BATTERY_LIFE'), { numberValue: 2.5 }, ru),
        'PRODUCTS_DETAIL_VALUE_NOT_INTEGER',
        'Введите целое число.',
      ],
      [
        () => PATCH(row('CONNECTIVITY'), { listValue_code: 'WIFI' }, ru),
        'PRODUCTS_DETAIL_VALUE_TYPE_MISMATCH',
        'Значение не соответствует типу этой характеристики.',
      ],
      [
        () => PATCH(row('COLOUR'), { listValue_code: 'A4' }, ru),
        'PRODUCTS_DETAIL_VALUE_NOT_IN_LIST',
        'Выберите значение из списка.',
      ],
      [
        () => POST(`${row('CONNECTIVITY')}/selections`, { value_code: 'BLUETOOTH_5_0' }, ru),
        'PRODUCTS_DETAIL_SELECTION_DUPLICATE',
        'Это значение уже выбрано.',
      ],
    ];
    for (const [send, code, text] of rejected) {
      const err = await expect(send()).to.be.rejectedWith(/400/);
      expect(err, code).to.containSubset({ code });
      expect(err.message, code).to.contain(text);
    }
  });

  it('reports typed value errors on the draft row and rejects activation', async () => {
    await draftEdit(laptop);
    const [screen, ram, storage] = ['SCREEN_SIZE', 'RAM', 'STORAGE'].map((c) => rowOf(laptop, c));
    // A non-number is refused even on a draft: the type check runs before the draft write (R11).
    const notNumber = await expect(
      PATCH(draftRow(laptop, ram), { numberValue: 'abc' })
    ).to.be.rejectedWith(/400/);
    expect(notNumber).to.containSubset({ code: 'ASSERT_DATA_TYPE', target: 'numberValue' });

    // The constraints only report on a draft (200), written at commit and read by the next GET.
    const changes = [
      [ram, { numberValue: 5000 }, 'numberValue', 'PRODUCTS_DETAIL_VALUE_OUT_OF_RANGE'],
      [storage, { numberValue: 1.5 }, 'numberValue', 'PRODUCTS_DETAIL_VALUE_NOT_INTEGER'],
      [screen, { textValue: 'big' }, 'textValue', 'PRODUCTS_DETAIL_VALUE_TYPE_MISMATCH'],
    ];
    for (const [rowId, change, element, code] of changes) {
      expect((await PATCH(draftRow(laptop, rowId), change)).status).to.equal(200);
      const onRow = await readDraft(draftRow(laptop, rowId), 'ID,DraftMessages');
      expect(messageCodes(onRow)).to.deep.equal([code]);
      expect(onRow.DraftMessages[0].target).to.match(rowTarget(rowId, element));
    }
    const onRoot = await readDraft(draftKey(laptop), 'ID,DraftMessages');
    expect(messageCodes(onRoot).sort()).to.deep.equal(changes.map((c) => c[3]).sort());

    // Activation enforces them, each on its row and column.
    const err = await expect(draftActivate(laptop)).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'MULTIPLE_ERRORS' });
    expect(err.details).to.have.length(3);
    for (const [rowId, , element, code] of changes) {
      expect(err.details).to.containSubset([
        { code, target: `in/details(ID=${rowId},IsActiveEntity=false)/${element}` },
      ]);
    }

    // With the values fixed the messages are gone and Save passes.
    await PATCH(draftRow(laptop, ram), { numberValue: 32 });
    await PATCH(draftRow(laptop, storage), { numberValue: 1024 });
    await PATCH(draftRow(laptop, screen), { textValue: null });
    expect(messageCodes(await readDraft(draftKey(laptop), 'ID,DraftMessages'))).to.deep.equal([]);
    expect((await draftActivate(laptop)).status).to.equal(200);
    const saved = await rowsOf(activeKey(laptop));
    expect(saved.map((row) => [row.attribute_code, row.numberValue, row.textValue])).to.deep.equal([
      ['SCREEN_SIZE', '15.000', null],
      ['RAM', '32.000', null],
      ['STORAGE', '1024.000', null],
    ]);
  });

  it('validates the selections of a multi-value detail', async () => {
    // The Speaker's CONNECTIVITY row holds Bluetooth 5.0; COLOUR is a LIST row.
    const connectivity = activeRow(speaker, rowOf(speaker, 'CONNECTIVITY'));
    const colour = activeRow(speaker, rowOf(speaker, 'COLOUR'));
    const added = await POST(`${connectivity}/selections`, { value_code: 'WIFI' });
    expect(added.status).to.equal(201);
    expect(added.data).to.containSubset({
      detail_ID: rowOf(speaker, 'CONNECTIVITY'),
      value_code: 'WIFI',
      IsActiveEntity: true,
    });
    const rejected = [
      [connectivity, { value_code: 'BLUETOOTH_5_0' }, 'PRODUCTS_DETAIL_SELECTION_DUPLICATE'],
      [connectivity, { value_code: 'BLACK' }, 'PRODUCTS_DETAIL_VALUE_NOT_IN_LIST'],
      [connectivity, { value_code: 'NOPE' }, 'ASSERT_TARGET'],
      [connectivity, {}, 'ASSERT_MANDATORY'],
      [colour, { value_code: 'BLACK' }, 'PRODUCTS_DETAIL_VALUE_TYPE_MISMATCH'],
    ];
    for (const [row, payload, code] of rejected) {
      const err = await expect(POST(`${row}/selections`, payload)).to.be.rejectedWith(/400/);
      expect(err, code).to.containSubset({ code, target: 'value_code' });
    }
    const { data } = await GET(`${connectivity}/selections?$select=value_code&$orderby=value_code`);
    expect(data.value.map((s) => s.value_code)).to.deep.equal(['BLUETOOTH_5_0', 'WIFI']);
    const { data: none } = await GET(`${colour}/selections?$select=ID`);
    expect(none.value).to.have.length(0);
  });

  it('edits the selections of a draft row and rejects a duplicate at activation', async () => {
    await draftEdit(speaker);
    const row = rowOf(speaker, 'CONNECTIVITY');
    const selections = `${draftRow(speaker, row)}/selections`;
    const selection = (id) => `${selections}(ID=${id},IsActiveEntity=false)`;
    // A new selection writes no draft message, not even a duplicate or an empty one.
    const usb = await POST(selections, { value_code: 'WIRED_USB' });
    expect(usb.status).to.equal(201);
    expect(usb.data).to.containSubset({ value_code: 'WIRED_USB', IsActiveEntity: false });
    const duplicate = await POST(selections, { value_code: 'BLUETOOTH_5_0' });
    const empty = await POST(selections, {});
    expect([duplicate.status, empty.status]).to.deep.equal([201, 201]);
    expect(messageCodes(await readDraft(draftKey(speaker), 'ID,DraftMessages'))).to.deep.equal([]);

    // A PATCH to a value of another list writes the message on the selection.
    expect((await PATCH(selection(empty.data.ID), { value_code: 'BLACK' })).status).to.equal(200);
    const onSelection = await readDraft(selection(empty.data.ID), 'ID,DraftMessages');
    expect(messageCodes(onSelection)).to.deep.equal(['PRODUCTS_DETAIL_VALUE_NOT_IN_LIST']);
    expect(onSelection.DraftMessages[0].target).to.match(
      new RegExp(
        `details\\(ID=${row},IsActiveEntity=false\\)/` +
          `selections\\(ID=${empty.data.ID},IsActiveEntity=false\\)/value_code$`
      )
    );
    expect((await DELETE(selection(empty.data.ID))).status).to.equal(204);

    // Activation checks every selection: both Bluetooth 5.0 selections are named.
    const err = await expect(draftActivate(speaker)).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'MULTIPLE_ERRORS' });
    expect(codesOf(err)).to.deep.equal([
      'PRODUCTS_DETAIL_SELECTION_DUPLICATE',
      'PRODUCTS_DETAIL_SELECTION_DUPLICATE',
    ]);
    const seeded = seededSelections.find((s) => s.detail_ID === row).ID;
    for (const id of [seeded, duplicate.data.ID]) {
      expect(err.details).to.containSubset([
        {
          target:
            `in/details(ID=${row},IsActiveEntity=false)/` +
            `selections(ID=${id},IsActiveEntity=false)/value_code`,
        },
      ]);
    }

    // Without the duplicate Save passes and stores the new value.
    expect((await DELETE(selection(duplicate.data.ID))).status).to.equal(204);
    expect((await draftActivate(speaker)).status).to.equal(200);
    const { data } = await GET(
      `${activeRow(speaker, row)}/selections?$select=value_code&$orderby=value_code`
    );
    expect(data.value.map((s) => s.value_code)).to.deep.equal(['BLUETOOTH_5_0', 'WIRED_USB']);
  });

  it('lets a CatalogViewer read selections and forbids writing them', async () => {
    const all = await GET(`${base}/ProductDetailSelections?$select=ID&$count=true`, as('viewer'));
    expect(all.status).to.equal(200);
    expect(all.data['@odata.count']).to.equal(7);
    const connectivity = activeRow(speaker, rowOf(speaker, 'CONNECTIVITY'));
    const ofRow = await GET(`${connectivity}/selections?$select=value_code`, as('viewer'));
    expect(ofRow.data.value).to.containSubset([{ value_code: 'BLUETOOTH_5_0' }]);

    const post = await expect(
      POST(`${connectivity}/selections`, { value_code: 'WIFI' }, as('viewer'))
    ).to.be.rejectedWith(/403/);
    expect(post).to.containSubset({ code: '403' });
    const seeded = seededSelections.find((s) => s.detail_ID === rowOf(speaker, 'CONNECTIVITY'));
    const remove = await expect(
      DELETE(`${connectivity}/selections(ID=${seeded.ID},IsActiveEntity=true)`, as('viewer'))
    ).to.be.rejectedWith(/403/);
    expect(remove).to.containSubset({ code: '403' });

    // carol is a default mock user without a catalog role (the explicit @restrict copy, R18).
    const carol = await expect(
      GET(`${base}/ProductDetailSelections?$top=1`, as('carol'))
    ).to.be.rejectedWith(/403/);
    expect(carol).to.containSubset({ code: '403' });
    const { data } = await GET(`${connectivity}/selections?$select=value_code`);
    expect(data.value.map((s) => s.value_code)).to.deep.equal(['BLUETOOTH_5_0']);
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

// Subcategories code list (ADR-0024, PLAN D1): read-only, every row belongs to one category.
describe('CatalogService.Subcategories', () => {
  // The row of the @readonly test if the POST unexpectedly succeeded; keeps the count at 15.
  afterEach(async () => {
    await cds.run(cds.ql.DELETE.from('my.catalog.Subcategories').where({ code: 'OTHER' }));
  });

  it('lists the 15 seeded subcategories with their category', async () => {
    const { data } = await GET(`${base}/Subcategories?$select=code,category_code`);
    expect(data.value).to.have.length(15);
    const categoryOf = Object.fromEntries(data.value.map((s) => [s.code, s.category_code]));
    expect(categoryOf).to.deep.equal({
      LAPTOPS: 'ELECTRONICS',
      MICE: 'ELECTRONICS',
      AUDIO: 'ELECTRONICS',
      SEATING: 'FURNITURE',
      LIGHTING: 'FURNITURE',
      DESK_ORGANIZATION: 'FURNITURE',
      APPLIANCES: 'KITCHEN',
      DRINKWARE: 'KITCHEN',
      CUTLERY: 'KITCHEN',
      BAGS: 'ACCESSORIES',
      PHONE_ACCESSORIES: 'ACCESSORIES',
      FITNESS: 'SPORTS',
      OUTDOOR: 'SPORTS',
      NOTEBOOKS: 'STATIONERY',
      WRITING_INSTRUMENTS: 'STATIONERY',
    });
  });

  it('narrows subcategories by category code as the value help does', async () => {
    // The dependent value help passes the product's category as a $filter (ValueListParameterIn).
    const { data } = await GET(
      `${base}/Subcategories?$select=code,name&$filter=category_code eq 'ELECTRONICS'&$orderby=code`
    );
    expect(data.value.map((s) => s.code)).to.deep.equal(['AUDIO', 'LAPTOPS', 'MICE']);
    expect(data.value).to.containSubset([{ code: 'LAPTOPS', name: 'Laptops' }]);
  });

  it('returns localized subcategory names with English fallback', async () => {
    const url = `${base}/Subcategories?$filter=code eq 'LAPTOPS'&$select=code,name`;
    const inLocale = (locale) => GET(url, { headers: { 'Accept-Language': locale } });

    const ru = await inLocale('ru');
    expect(ru.data.value).to.containSubset([{ code: 'LAPTOPS', name: 'Ноутбуки' }]);

    const en = await inLocale('en');
    expect(en.data.value).to.containSubset([{ code: 'LAPTOPS', name: 'Laptops' }]);

    // No German texts in Subcategories.texts.csv: the default (English) name is served.
    const de = await inLocale('de');
    expect(de.data.value).to.containSubset([{ code: 'LAPTOPS', name: 'Laptops' }]);
  });

  it('does not allow creating subcategories (@readonly)', async () => {
    const err = await expect(
      POST(`${base}/Subcategories`, { code: 'OTHER', name: 'Other', category_code: 'SPORTS' })
    ).to.be.rejectedWith(/405/);
    expect(err).to.containSubset({ code: 'ENTITY_IS_READ_ONLY' });
    const { data } = await GET(`${base}/Subcategories?$count=true&$top=0`);
    expect(data['@odata.count']).to.equal(15);
  });

  it('lets a CatalogViewer read subcategories', async () => {
    const { status, data } = await GET(
      `${base}/Subcategories?$select=code&$count=true`,
      as('viewer')
    );
    expect(status).to.equal(200);
    expect(data['@odata.count']).to.equal(15);
    expect(data.value).to.have.length(15);
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

// Excel import (ADR-0021): a collection-bound action that creates active products from an xlsx
// workbook, all-or-nothing. Fixtures and in-memory workbooks come from test/fixtures. Every test
// that imports deletes the created products, so the 15 seeded rows stay the baseline.
describe('CatalogService.Products importProducts', () => {
  const importUrl = `${base}/Products/CatalogService.importProducts`;
  const fixture = (name) =>
    readFileSync(`${import.meta.dirname}/fixtures/products-import-${name}.xlsx`);
  const importFile = (bytes, options) => POST(importUrl, { file: fileParameter(bytes) }, options);
  const importSheet = async (data, options) => importFile(await workbook(data), options);
  // Rejects with 400 and returns the message codes and texts of the OData error details.
  const rejected = async (request) => {
    const err = await expect(request).to.be.rejectedWith(/400/);
    const details = err.details ?? [];
    return { err, codes: details.map((d) => d.code), messages: details.map((d) => d.message) };
  };
  const count = async () => {
    const { data } = await GET(`${base}/Products?$count=true&$top=0`);
    return data['@odata.count'];
  };
  // Active products whose name is one of the given names.
  const byNames = async (names) => {
    const list = names.map((n) => `'${n}'`).join(',');
    const { data } = await GET(`${base}/Products?$filter=name in (${list})&$orderby=name`);
    return data.value;
  };
  const removeByNames = async (names) => {
    for (const { ID } of await byNames(names)) await DELETE(activeKey(ID));
  };
  const validNames = VALID_ROWS.map(([name]) => name);

  afterEach(async () => {
    await removeByNames([...validNames, 'Import Good Row', 'Import Only Row']);
    // Generated rows of a rejection test that unexpectedly succeeded; keeps later counts at 15.
    await cds.run(cds.ql.DELETE.from('my.catalog.Products').where`name like 'Bulk Product %'`);
  });

  it('importProducts creates one active product per row', async () => {
    const { status, data, headers } = await importFile(fixture('valid'));
    expect(status).to.equal(200);
    expect(data.value).to.equal(3);
    expect(JSON.parse(headers['sap-messages'])).to.containSubset([
      { code: 'PRODUCTS_IMPORT_DONE', message: 'Products imported: 3.' },
    ]);
    expect(await count()).to.equal(18);
    expect(await byNames(validNames)).to.containSubset([
      {
        name: 'Import Desk Organizer',
        description: 'Bamboo organizer with five compartments',
        price: '24.50',
        currency_code: 'USD',
        stock: 40,
        category_code: 'STATIONERY',
        subcategory_code: 'WRITING_INSTRUMENTS',
        rating: 4,
        imageUrl: 'https://example.com/img/desk-organizer.png',
        IsActiveEntity: true,
      },
      {
        name: 'Import Resistance Bands',
        price: '19.99',
        currency_code: 'EUR',
        stock: 120,
        category_code: 'SPORTS',
        subcategory_code: 'FITNESS',
        rating: 5,
        IsActiveEntity: true,
      },
      {
        name: 'Import USB-C Hub',
        price: '49.00',
        currency_code: 'GBP',
        stock: 15,
        category_code: 'ELECTRONICS',
        subcategory_code: 'LAPTOPS',
        rating: 3,
        IsActiveEntity: true,
      },
    ]);
  });

  it('importProducts creates active products, no drafts', async () => {
    await importFile(fixture('valid'));
    const created = await byNames(validNames);
    expect(created).to.have.length(3);
    for (const product of created) {
      expect(product).to.containSubset({ IsActiveEntity: true, createdBy: 'alice' });
    }
    const { data: drafts } = await GET(
      `${base}/Products?$filter=IsActiveEntity eq false&$count=true&$top=0`
    );
    expect(drafts['@odata.count']).to.equal(0);
  });

  it('importProducts rejects the whole file and reports every bad row', async () => {
    const { err, codes, messages } = await rejected(importFile(fixture('invalid')));
    expect(codes).to.deep.equal([
      'PRODUCTS_IMPORT_NOTHING_IMPORTED',
      'PRODUCTS_IMPORT_ROW_INVALID',
      'PRODUCTS_IMPORT_ROW_INVALID',
      'PRODUCTS_IMPORT_ROW_INVALID',
      'PRODUCTS_IMPORT_ROW_INVALID',
      'PRODUCTS_IMPORT_ROW_INVALID',
      'PRODUCTS_IMPORT_DUPLICATE_NAME',
      'PRODUCTS_IMPORT_ROW_INVALID',
      'PRODUCTS_IMPORT_ROW_INVALID',
    ]);
    expect(messages[0]).to.equal(
      'No products were imported. Correct the rows listed below and import the file again.'
    );
    expect(messages[1]).to.match(/^Row 3, column "name": /);
    expect(messages[2]).to.match(/^Row 4, column "stock": /);
    expect(messages[3]).to.match(/^Row 5, column "category": /);
    // Row 5 keeps a KITCHEN subcategory, which does not belong to "NOPE" either (fixture JSDoc).
    expect(messages[4]).to.equal(
      'Row 5, column "subcategory": The subcategory does not belong to the category of the product.'
    );
    expect(messages[5]).to.match(/^Row 6, column "price": /);
    expect(messages[6]).to.equal(
      'Row 7, column "name": a product named "yoga MAT" already exists in the catalog or earlier in the file.'
    );
    expect(messages[7]).to.equal('Row 8, column "subcategory": Provide the missing value.');
    expect(messages[8]).to.equal(
      'Row 9, column "subcategory": The subcategory does not belong to the category of the product.'
    );
    // Row messages are not bound to a field of the form (no `target`).
    for (const detail of err.details) expect(detail.target).to.equal(undefined);
    // All-or-nothing: the good row 2 was rolled back.
    expect(await count()).to.equal(15);
    expect(await byNames(['Import Good Row'])).to.have.length(0);
  });

  it('importProducts reports every bad row without a cap', async () => {
    const rows = Array.from({ length: 150 }, (_, i) => generatedRow(i, { stock: -1 }));
    const { codes, messages } = await rejected(importSheet([HEADER, ...rows]));
    expect(codes).to.have.length(151);
    expect(codes[0]).to.equal('PRODUCTS_IMPORT_NOTHING_IMPORTED');
    expect(new Set(codes.slice(1))).to.deep.equal(new Set(['PRODUCTS_IMPORT_ROW_INVALID']));
    expect(messages[1]).to.match(/^Row 2, column "stock": /);
    expect(messages[150]).to.match(/^Row 151, column "stock": /);
    expect(await count()).to.equal(15);
  });

  it('importProducts reports duplicate names', async () => {
    const { codes, messages } = await rejected(
      importSheet([
        HEADER,
        generatedRow(1, { name: 'Import Only Row' }),
        generatedRow(2, { name: 'BACKPACK' }),
        generatedRow(3, { name: 'import only row' }),
      ])
    );
    expect(codes).to.deep.equal([
      'PRODUCTS_IMPORT_NOTHING_IMPORTED',
      'PRODUCTS_IMPORT_DUPLICATE_NAME',
      'PRODUCTS_IMPORT_DUPLICATE_NAME',
    ]);
    // Against an existing active product (case-insensitive) and against an earlier row.
    expect(messages[1]).to.match(/^Row 3, column "name": a product named "BACKPACK" /);
    expect(messages[2]).to.match(/^Row 4, column "name": a product named "import only row" /);
    expect(await count()).to.equal(15);
  });

  it('importProducts reports an unknown currency code', async () => {
    // @assert.target on currency runs on the action's internal INSERT, per row (ADR-0021).
    const { codes, messages } = await rejected(
      importSheet([HEADER, generatedRow(1, { currency: 'XXX' })])
    );
    expect(codes).to.deep.equal([
      'PRODUCTS_IMPORT_NOTHING_IMPORTED',
      'PRODUCTS_IMPORT_ROW_INVALID',
    ]);
    expect(messages[1]).to.match(/^Row 2, column "currency": /);
    expect(await count()).to.equal(15);
  });

  it('importProducts rejects more than 1000 rows', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => generatedRow(i));
    const { codes, messages } = await rejected(importSheet([HEADER, ...rows]));
    expect(codes).to.deep.equal([
      'PRODUCTS_IMPORT_NOTHING_IMPORTED',
      'PRODUCTS_IMPORT_TOO_MANY_ROWS',
    ]);
    expect(messages[1]).to.equal(
      'The file has 1001 product rows; at most 1000 can be imported at once. Split the file.'
    );
    expect(await count()).to.equal(15);
  });

  it('importProducts accepts 1000 rows whose request body exceeds 100 KB', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) =>
      generatedRow(i, { description: proseDescription(i) })
    );
    const file = fileParameter(await workbook([HEADER, ...rows]));
    // Guards @cds.server.body_parser.limit on CatalogService: the default 100 KB would answer 413.
    expect(Buffer.byteLength(JSON.stringify({ file }))).to.be.greaterThan(100_000);
    try {
      const { status, data } = await POST(importUrl, { file });
      expect(status).to.equal(200);
      expect(data.value).to.equal(1000);
      expect(await count()).to.equal(1015);
    } finally {
      // 1,000 HTTP DELETEs would dominate the run; remove the generated rows in one statement.
      await cds.run(cds.ql.DELETE.from('my.catalog.Products').where`name like 'Bulk Product %'`);
    }
    expect(await count()).to.equal(15);
  });

  it('importProducts rejects a request without a file', async () => {
    // @mandatory on the parameter `file` (ADR-0021 amendment): the framework rejects the request
    // before the handler runs (research 6.5). An explicit `file: null` is not "missing" and
    // reaches the handler instead, so the body carries no `file` at all.
    const err = await expect(POST(importUrl, {})).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'ASSERT_MANDATORY', target: 'file' });
    expect(await count()).to.equal(15);
  });

  it('importProducts rejects a workbook that unzips beyond the limit', async () => {
    // One 11 MiB cell: about 14 KB of xlsx and 19 KB of request, 11 MiB unpacked (research 8.5).
    const bomb = await workbook([
      HEADER,
      generatedRow(1, { description: 'a'.repeat(MAX_UNZIPPED_BYTES + 2 ** 20) }),
    ]);
    const { codes, messages } = await rejected(importFile(bomb));
    expect(codes).to.deep.equal(['PRODUCTS_IMPORT_NOTHING_IMPORTED', 'PRODUCTS_IMPORT_TOO_LARGE']);
    expect(messages[1]).to.equal(
      'The file contains more than 10 MB of data and cannot be imported at once. ' +
        'Keep only the product sheet and split the file.'
    );
    expect(await count()).to.equal(15);
  });

  it('importProducts rejects a malformed workbook', async () => {
    const notXlsx = await rejected(importFile(Buffer.from('name;price\nLamp;10\n')));
    expect(notXlsx.codes).to.deep.equal([
      'PRODUCTS_IMPORT_NOTHING_IMPORTED',
      'PRODUCTS_IMPORT_NOT_XLSX',
    ]);

    const empty = await rejected(importSheet([HEADER]));
    expect(empty.codes).to.deep.equal([
      'PRODUCTS_IMPORT_NOTHING_IMPORTED',
      'PRODUCTS_IMPORT_EMPTY',
    ]);

    const unknown = await rejected(
      importSheet([
        [...HEADER, 'color'],
        [...generatedRow(1), 'red'],
      ])
    );
    expect(unknown.codes).to.deep.equal([
      'PRODUCTS_IMPORT_NOTHING_IMPORTED',
      'PRODUCTS_IMPORT_UNKNOWN_COLUMN',
    ]);
    expect(unknown.messages[1]).to.match(/^Column "color" is not supported\./);

    // A documented column named twice, case-insensitive (ADR-0021 "Amendment 2" C).
    const repeated = await rejected(
      importSheet([
        [...HEADER, 'Name'],
        [...generatedRow(1), 'Second Name'],
      ])
    );
    expect(repeated.codes).to.deep.equal([
      'PRODUCTS_IMPORT_NOTHING_IMPORTED',
      'PRODUCTS_IMPORT_DUPLICATE_COLUMN',
    ]);
    expect(repeated.messages[1]).to.contain('"name"');
    expect(repeated.err.details[1].target).to.equal(undefined);
    expect(await count()).to.equal(15);
  });

  it('importProducts reports each missing mandatory column', async () => {
    const header = ['name', 'currency', 'stock'];
    const { codes, messages } = await rejected(
      importSheet([header, ['Import Only Row', 'USD', 1]])
    );
    expect(codes).to.deep.equal([
      'PRODUCTS_IMPORT_NOTHING_IMPORTED',
      'PRODUCTS_IMPORT_MISSING_COLUMN',
      'PRODUCTS_IMPORT_MISSING_COLUMN',
      'PRODUCTS_IMPORT_MISSING_COLUMN',
    ]);
    expect(messages.slice(1)).to.deep.equal([
      'The header row has no column "price".',
      'The header row has no column "category".',
      'The header row has no column "subcategory".',
    ]);

    // Six mandatory columns (D7 = A): a header with none of them reports all six, in this order.
    const none = await rejected(importSheet([['description'], ['Import Only Row']]));
    expect(none.codes.slice(1)).to.deep.equal(Array(6).fill('PRODUCTS_IMPORT_MISSING_COLUMN'));
    expect(none.messages.slice(1).map((m) => m.match(/"(.+)"/)[1])).to.deep.equal([
      'name',
      'price',
      'currency',
      'stock',
      'category',
      'subcategory',
    ]);
    expect(await count()).to.equal(15);
  });

  it('importProducts reports a row without a subcategory', async () => {
    const { err, codes, messages } = await rejected(
      importSheet([HEADER, generatedRow(1, { subcategory: null })])
    );
    expect(codes).to.deep.equal([
      'PRODUCTS_IMPORT_NOTHING_IMPORTED',
      'PRODUCTS_IMPORT_ROW_INVALID',
    ]);
    expect(messages[1]).to.equal('Row 2, column "subcategory": Provide the missing value.');
    expect(err.details[1].target).to.equal(undefined);
    expect(await count()).to.equal(15);
  });

  it('importProducts reports a subcategory of another category in a row', async () => {
    // Row 2 is valid, row 3 pairs KITCHEN with the Furniture subcategory LIGHTING, row 4 has its
    // own error: both rows are reported and nothing is imported (ADR-0021 amendment 4 E).
    const mismatched = generatedRow(2, { subcategory: 'LIGHTING' });
    const { err, codes, messages } = await rejected(
      importSheet([HEADER, generatedRow(1), mismatched, generatedRow(3, { stock: -1 })])
    );
    expect(codes).to.deep.equal([
      'PRODUCTS_IMPORT_NOTHING_IMPORTED',
      'PRODUCTS_IMPORT_ROW_INVALID',
      'PRODUCTS_IMPORT_ROW_INVALID',
    ]);
    expect(messages[1]).to.equal(
      'Row 3, column "subcategory": The subcategory does not belong to the category of the product.'
    );
    expect(messages[2]).to.match(/^Row 4, column "stock": /);
    for (const detail of err.details) expect(detail.target).to.equal(undefined);
    expect(await count()).to.equal(15);

    // The reason is the localized PRODUCTS_SUBCATEGORY_MISMATCH text.
    const ru = { headers: { 'Accept-Language': 'ru' } };
    const inRussian = await rejected(importSheet([HEADER, mismatched], ru));
    expect(inRussian.messages[1]).to.equal(
      'Строка 2, столбец "subcategory": Подкатегория не относится к категории товара.'
    );
    expect(await count()).to.equal(15);
  });

  it('importProducts leaves an unknown subcategory code to @assert.target', async () => {
    // The per-row pair check skips a code it cannot find; the row's INSERT reports it, once.
    const { codes, messages } = await rejected(
      importSheet([HEADER, generatedRow(1, { subcategory: 'NOPE' })])
    );
    expect(codes).to.deep.equal([
      'PRODUCTS_IMPORT_NOTHING_IMPORTED',
      'PRODUCTS_IMPORT_ROW_INVALID',
    ]);
    expect(messages[1]).to.equal(
      'Row 2, column "subcategory": Target with this key doesn\'t exist.'
    );
    expect(await count()).to.equal(15);
  });

  it('importProducts leaves a row without a category to @mandatory', async () => {
    // APPLIANCES belongs to KITCHEN, but an empty category is no mismatch: one message, category.
    const { codes, messages } = await rejected(
      importSheet([HEADER, generatedRow(1, { category: null, subcategory: 'APPLIANCES' })])
    );
    expect(codes).to.deep.equal([
      'PRODUCTS_IMPORT_NOTHING_IMPORTED',
      'PRODUCTS_IMPORT_ROW_INVALID',
    ]);
    expect(messages[1]).to.equal('Row 2, column "category": Provide the missing value.');
    expect(await count()).to.equal(15);
  });

  it('importProducts is forbidden for a viewer', async () => {
    const err = await expect(importFile(fixture('valid'), as('viewer'))).to.be.rejectedWith(/403/);
    expect(err).to.containSubset({ code: '403' });
    expect(await count()).to.equal(15);
  });

  it('importProducts requires authentication', async () => {
    const err = await expect(importFile(fixture('valid'), anonymous)).to.be.rejectedWith(/401/);
    expect(err.status).to.equal(401);
    expect(await count()).to.equal(15);
  });

  it('importProducts reports errors in Russian', async () => {
    const ru = { headers: { 'Accept-Language': 'ru' } };
    const notXlsx = await rejected(importFile(Buffer.from('not a workbook'), ru));
    expect(notXlsx.messages).to.deep.equal([
      'Товары не импортированы. Исправьте указанные ниже строки и снова импортируйте файл.',
      'Файл не является книгой Excel. Выберите файл .xlsx.',
    ]);
    // A row message wraps the framework's reason, localized too (ASSERT_MANDATORY has a ru text).
    const row = await rejected(importSheet([HEADER, generatedRow(1, { name: null })], ru));
    expect(row.messages[1]).to.equal('Строка 2, столбец "name": Укажите недостающее значение.');
  });

  it('importProducts reports success in Russian', async () => {
    const ru = { headers: { 'Accept-Language': 'ru' } };
    // The created row is deleted by afterEach.
    const { headers } = await importSheet(
      [HEADER, generatedRow(1, { name: 'Import Only Row' })],
      ru
    );
    expect(JSON.parse(headers['sap-messages'])).to.containSubset([
      { code: 'PRODUCTS_IMPORT_DONE', message: 'Импортировано товаров: 1.' },
    ]);
  });
});
