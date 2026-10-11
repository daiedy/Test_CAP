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
describe('CatalogService.ProductDetails', () => {
  let laptop; // Laptop Pro 15, LAPTOPS: SCREEN_SIZE, RAM and STORAGE, no assigned attribute free
  let mouse; // Wireless Mouse, MICE: CONNECTIVITY and DPI; BATTERY_LIFE is assigned and free
  let mouseRows; // attribute code -> ID of the seeded rows of Wireless Mouse
  let seededRows; // every seeded row, restored after each test

  const activeRow = (productId, rowId) =>
    `${activeKey(productId)}/details(ID=${rowId},IsActiveEntity=true)`;
  const draftRow = (productId, rowId) =>
    `${draftKey(productId)}/details(ID=${rowId},IsActiveEntity=false)`;
  // Attribute codes of the active rows of a product, sorted.
  const activeCodes = async (productId) => {
    const { data } = await GET(`${activeKey(productId)}/details?$select=attribute_code`);
    return data.value.map((row) => row.attribute_code).sort();
  };
  // Target of a draft row's element, matched by its suffix (TESTING.md): the draft message carries
  // `/Products(...)/details(...)/<element>`, the activation error `in/details(...)/<element>`.
  const rowTarget = (rowId, element) =>
    new RegExp(`details\\(ID=${rowId},IsActiveEntity=false\\)/${element}$`);
  const codesOf = (err) => err.details.map((d) => d.code).sort();
  const ru = { headers: { 'Accept-Language': 'ru' } };

  beforeAll(async () => {
    const { data } = await GET(
      `${base}/Products?$filter=name in ('Laptop Pro 15','Wireless Mouse')&$select=ID,name`
    );
    laptop = data.value.find((p) => p.name === 'Laptop Pro 15').ID;
    mouse = data.value.find((p) => p.name === 'Wireless Mouse').ID;
    seededRows = await cds.run(cds.ql.SELECT.from('my.catalog.ProductDetails'));
    mouseRows = Object.fromEntries(
      seededRows.filter((r) => r.product_ID === mouse).map((r) => [r.attribute_code, r.ID])
    );
  });

  afterEach(async () => {
    // Drafts a test left open (a failed activation, a red assertion), discarded through the root.
    const drafts = await cds.run(
      cds.ql.SELECT.from('CatalogService.Products.drafts').columns('ID')
    );
    for (const { ID } of drafts) await DELETE(draftKey(ID));
    // Products created here, rows added to seeded products; seeded rows a test changed come back.
    await cds.run(cds.ql.DELETE.from('my.catalog.Products').where`name like 'Details %'`);
    const seededIds = seededRows.map((r) => r.ID);
    await cds.run(cds.ql.DELETE.from('my.catalog.ProductDetails').where`ID not in ${seededIds}`);
    await cds.run(cds.ql.UPSERT.into('my.catalog.ProductDetails').entries(seededRows));
    // A subcategory change a rejection test expected to fail; the code lists of the @readonly test.
    await cds.run(
      cds.ql.UPDATE.entity('my.catalog.Products').set({ subcategory_code: 'LAPTOPS' })
        .where`ID = ${laptop} and subcategory_code != 'LAPTOPS'`
    );
    await cds.run(cds.ql.DELETE.from('my.catalog.DetailAttributes').where({ code: 'OTHER' }));
    await cds.run(
      cds.ql.DELETE.from('my.catalog.SubcategoryAttributes').where({
        subcategory_code: 'LAPTOPS',
        attribute_code: 'COLOUR',
      })
    );
  });

  it('returns the seeded details of a product with attribute names and units', async () => {
    const { data } = await GET(`${activeKey(laptop)}/details?$expand=attribute`);
    expect(data.value).to.have.length(3);
    expect(data.value).to.containSubset([
      {
        attribute_code: 'SCREEN_SIZE',
        value: '15',
        IsActiveEntity: true,
        attribute: { name: 'Screen Size', unit: 'in' },
      },
      { attribute_code: 'RAM', value: '16', attribute: { name: 'Memory (RAM)', unit: 'GB' } },
      { attribute_code: 'STORAGE', value: '512', attribute: { name: 'Storage', unit: 'GB' } },
    ]);
  });

  it('returns localized attribute names with English fallback', async () => {
    const url = `${base}/DetailAttributes?$filter=code eq 'RAM'&$select=code,name,unit`;
    const inLocale = (locale) => GET(url, { headers: { 'Accept-Language': locale } });

    // Units are Latin and not localized (PLAN D7).
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

  it('lists the attributes assigned to a subcategory as the value help does', async () => {
    // The row's value help passes product/subcategory_code as a $filter (ADR-0026 decision 7).
    const url =
      `${base}/SubcategoryAttributes?$filter=subcategory_code eq 'LAPTOPS'` +
      '&$select=attribute_code,attributeName&$orderby=attribute_code';
    const { data } = await GET(url);
    expect(data.value.map((a) => a.attribute_code)).to.deep.equal([
      'RAM',
      'SCREEN_SIZE',
      'STORAGE',
    ]);
    expect(data.value).to.containSubset([
      { attribute_code: 'RAM', attributeName: 'Memory (RAM)' },
      { attribute_code: 'SCREEN_SIZE', attributeName: 'Screen Size' },
      { attribute_code: 'STORAGE', attributeName: 'Storage' },
    ]);

    const inRussian = await GET(url, ru);
    expect(inRussian.data.value).to.containSubset([
      { attribute_code: 'RAM', attributeName: 'Оперативная память' },
      { attribute_code: 'SCREEN_SIZE', attributeName: 'Диагональ экрана' },
      { attribute_code: 'STORAGE', attributeName: 'Накопитель' },
    ]);
  });

  it('does not allow creating attributes or assignments (@readonly)', async () => {
    const attribute = await expect(
      POST(`${base}/DetailAttributes`, { code: 'OTHER', name: 'Other' })
    ).to.be.rejectedWith(/405/);
    expect(attribute).to.containSubset({ code: 'ENTITY_IS_READ_ONLY' });

    const assignment = await expect(
      POST(`${base}/SubcategoryAttributes`, {
        subcategory_code: 'LAPTOPS',
        attribute_code: 'COLOUR',
      })
    ).to.be.rejectedWith(/405/);
    expect(assignment).to.containSubset({ code: 'ENTITY_IS_READ_ONLY' });

    const attributes = await GET(`${base}/DetailAttributes?$count=true&$top=0`);
    expect(attributes.data['@odata.count']).to.equal(20);
    const assignments = await GET(`${base}/SubcategoryAttributes?$count=true&$top=0`);
    expect(assignments.data['@odata.count']).to.equal(45);
  });

  it('rejects a direct write to ProductDetails outside the product (lean draft)', async () => {
    const row = { product_ID: mouse, attribute_code: 'BATTERY_LIFE', value: '12' };
    // Active and draft POST of an editor, active POST of a viewer: lean draft answers first.
    for (const [payload, options] of [[active(row)], [row], [active(row), as('viewer')]]) {
      const err = await expect(POST(`${base}/ProductDetails`, payload, options)).to.be.rejectedWith(
        /422/
      );
      expect(err).to.containSubset({ code: 'DRAFT_MODIFICATION_ONLY_VIA_ROOT' });
    }
    const patch = await expect(
      PATCH(`${base}/ProductDetails(ID=${mouseRows.DPI},IsActiveEntity=true)`, { value: '800' })
    ).to.be.rejectedWith(/422/);
    expect(patch).to.containSubset({ code: 'DRAFT_MODIFICATION_ONLY_VIA_ROOT' });

    // Measured: a viewer's draft POST (no IsActiveEntity) is refused by the grant before lean draft.
    const viewerDraft = await expect(
      POST(`${base}/ProductDetails`, row, as('viewer'))
    ).to.be.rejectedWith(/403/);
    expect(viewerDraft).to.containSubset({ code: '403' });

    // Nothing was written, neither an active row nor a draft.
    expect(await activeCodes(mouse)).to.deep.equal(['CONNECTIVITY', 'DPI']);
    const { data } = await GET(`${activeRow(mouse, mouseRows.DPI)}?$select=value,HasDraftEntity`);
    expect(data).to.containSubset({ value: '1600', HasDraftEntity: false });
  });

  it('creates a detail row of an active product through the product', async () => {
    const { status, data } = await POST(`${activeKey(mouse)}/details`, {
      attribute_code: 'BATTERY_LIFE',
      value: '12',
    });
    expect(status).to.equal(201);
    expect(data).to.containSubset({
      IsActiveEntity: true,
      product_ID: mouse,
      attribute_code: 'BATTERY_LIFE',
      value: '12',
    });
    const { data: stored } = await GET(
      `${activeRow(mouse, data.ID)}?$select=value&$expand=attribute($select=name,unit)`
    );
    expect(stored).to.containSubset({
      value: '12',
      attribute: { name: 'Battery Life', unit: 'h' },
    });
    expect(await activeCodes(mouse)).to.deep.equal(['BATTERY_LIFE', 'CONNECTIVITY', 'DPI']);
  });

  it('rejects an attribute that is not assigned to the subcategory of the product (PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED)', async () => {
    // COLOUR exists, but MICE has CONNECTIVITY, DPI and BATTERY_LIFE only.
    const created = await expect(
      POST(`${activeKey(mouse)}/details`, { attribute_code: 'COLOUR', value: 'Black' })
    ).to.be.rejectedWith(/400/);
    expect(created).to.containSubset({
      code: 'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED',
      target: 'attribute_code',
    });
    expect(created.message).to.contain(
      'The attribute is not available for the subcategory of the product.'
    );

    const changed = await expect(
      PATCH(activeRow(mouse, mouseRows.DPI), { attribute_code: 'COLOUR' })
    ).to.be.rejectedWith(/400/);
    expect(changed).to.containSubset({
      code: 'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED',
      target: 'attribute_code',
    });
    expect(await activeCodes(mouse)).to.deep.equal(['CONNECTIVITY', 'DPI']);
  });

  it('reports the unassigned attribute in Russian', async () => {
    const err = await expect(
      POST(`${activeKey(mouse)}/details`, { attribute_code: 'COLOUR', value: 'Black' }, ru)
    ).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED' });
    expect(err.message).to.contain('Характеристика недоступна для подкатегории товара.');
  });

  it('rejects an unknown attribute code (@assert.target)', async () => {
    const err = await expect(
      POST(`${activeKey(mouse)}/details`, { attribute_code: 'UNKNOWN', value: '12' })
    ).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'ASSERT_TARGET', target: 'attribute_code' });
    expect(await activeCodes(mouse)).to.deep.equal(['CONNECTIVITY', 'DPI']);
  });

  it('rejects a detail row without an attribute or without a value (@mandatory)', async () => {
    const noAttribute = await expect(
      POST(`${activeKey(mouse)}/details`, { value: '12' })
    ).to.be.rejectedWith(/400/);
    expect(noAttribute).to.containSubset({ code: 'ASSERT_MANDATORY', target: 'attribute_code' });

    const noValue = await expect(
      POST(`${activeKey(mouse)}/details`, { attribute_code: 'BATTERY_LIFE' })
    ).to.be.rejectedWith(/400/);
    expect(noValue).to.containSubset({ code: 'ASSERT_MANDATORY', target: 'value' });
    expect(await activeCodes(mouse)).to.deep.equal(['CONNECTIVITY', 'DPI']);
  });

  it('rejects a second row for the same attribute of a product (PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE)', async () => {
    const err = await expect(
      POST(`${activeKey(mouse)}/details`, { attribute_code: 'CONNECTIVITY', value: 'USB' })
    ).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({
      code: 'PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE',
      target: 'attribute_code',
    });
    expect(err.message).to.contain('The product already has a row for this attribute.');
    const { data } = await GET(
      `${activeKey(mouse)}/details?$filter=attribute_code eq 'CONNECTIVITY'&$select=value`
    );
    expect(data.value).to.have.length(1);
    expect(data.value).to.containSubset([{ value: 'Wireless 2.4 GHz' }]);
  });

  it('rejects a subcategory change of an active product whose details do not fit (PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS)', async () => {
    // MICE belongs to ELECTRONICS like LAPTOPS: no mismatch, only the details rule applies (D1).
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
    const { data: speaker } = await POST(
      `${base}/Products`,
      active({
        ...newProduct,
        name: 'Details Speaker',
        category_code: 'ELECTRONICS',
        subcategory_code: 'AUDIO',
        details: [
          { attribute_code: 'CONNECTIVITY', value: 'Bluetooth 5.0' },
          { attribute_code: 'BATTERY_LIFE', value: '12' },
        ],
      })
    );
    const moved = await PATCH(activeKey(speaker.ID), { subcategory_code: 'MICE' });
    expect(moved.status).to.equal(200);
    expect(moved.data).to.containSubset({ subcategory_code: 'MICE' });
  });

  it('creates a product with its details in one request and deletes them with the product', async () => {
    // The subcategory of newProduct, LIGHTING, has POWER, BRIGHTNESS and COLOUR.
    const details = [
      { attribute_code: 'POWER', value: '40' },
      { attribute_code: 'BRIGHTNESS', value: '800' },
    ];
    const { status, data } = await POST(
      `${base}/Products`,
      active({ ...newProduct, name: 'Details Desk Lamp', details })
    );
    expect(status).to.equal(201);
    expect(data.details).to.have.length(2);
    expect(data.details).to.containSubset(
      details.map((d) => ({ ...d, product_ID: data.ID, IsActiveEntity: true }))
    );
    const rowsOf = async (productId) => {
      const { data: rows } = await GET(
        `${base}/ProductDetails?$filter=product_ID eq ${productId}&$select=ID`
      );
      return rows.value;
    };
    expect(await rowsOf(data.ID)).to.have.length(2);

    // A foreign row is reported on the root's subcategory and on the row itself (D1).
    const foreign = active({
      ...newProduct,
      name: 'Details Foreign Lamp',
      details: [{ attribute_code: 'RAM', value: '16' }],
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

    const removed = await DELETE(activeKey(data.ID));
    expect(removed.status).to.equal(204);
    expect(await rowsOf(data.ID)).to.have.length(0);
  });

  it('lets a CatalogViewer read details and forbids writing them', async () => {
    const all = await GET(`${base}/ProductDetails?$select=ID&$count=true`, as('viewer'));
    expect(all.status).to.equal(200);
    expect(all.data['@odata.count']).to.equal(15);
    const ofProduct = await GET(`${activeKey(mouse)}/details?$select=attribute_code`, as('viewer'));
    expect(ofProduct.status).to.equal(200);
    expect(ofProduct.data.value).to.have.length(2);

    const post = await expect(
      POST(
        `${activeKey(mouse)}/details`,
        { attribute_code: 'BATTERY_LIFE', value: '12' },
        as('viewer')
      )
    ).to.be.rejectedWith(/403/);
    expect(post).to.containSubset({ code: '403' });
    const patch = await expect(
      PATCH(activeRow(mouse, mouseRows.DPI), { value: '800' }, as('viewer'))
    ).to.be.rejectedWith(/403/);
    expect(patch).to.containSubset({ code: '403' });
    const remove = await expect(
      DELETE(activeRow(mouse, mouseRows.DPI), as('viewer'))
    ).to.be.rejectedWith(/403/);
    expect(remove).to.containSubset({ code: '403' });

    const { data } = await GET(`${activeRow(mouse, mouseRows.DPI)}?$select=value`);
    expect(data).to.containSubset({ value: '1600' });
    expect(await activeCodes(mouse)).to.deep.equal(['CONNECTIVITY', 'DPI']);
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

    // The code lists of the attribute value help stay readable for every authenticated user.
    const attributes = await GET(`${base}/DetailAttributes?$top=1&$select=code`, as('carol'));
    expect(attributes.status).to.equal(200);
    const assignments = await GET(
      `${base}/SubcategoryAttributes?$top=1&$select=attribute_code`,
      as('carol')
    );
    expect(assignments.status).to.equal(200);
  });

  it('adds a detail row to a draft and activates it', async () => {
    await draftEdit(mouse);
    const { status, data } = await POST(`${draftKey(mouse)}/details`, {
      attribute_code: 'BATTERY_LIFE',
      value: '12',
    });
    expect(status).to.equal(201);
    expect(data).to.containSubset({
      IsActiveEntity: false,
      HasActiveEntity: false,
      attribute_code: 'BATTERY_LIFE',
    });
    // Before Save the row lives only in the draft.
    expect(await activeCodes(mouse)).to.deep.equal(['CONNECTIVITY', 'DPI']);

    const activated = await draftActivate(mouse);
    expect(activated.status).to.equal(200);
    expect(await activeCodes(mouse)).to.deep.equal(['BATTERY_LIFE', 'CONNECTIVITY', 'DPI']);
    const { data: stored } = await GET(`${activeRow(mouse, data.ID)}?$select=value`);
    expect(stored).to.containSubset({ value: '12', IsActiveEntity: true });
  });

  it('reports an unassigned attribute on the draft row and rejects activation', async () => {
    await draftEdit(mouse);
    const row = draftRow(mouse, mouseRows.DPI);
    // On a draft the constraint is a message (200), written at commit and read by the next GET.
    const { status } = await PATCH(row, { attribute_code: 'COLOUR' });
    expect(status).to.equal(200);
    const onRow = await readDraft(row, 'ID,DraftMessages');
    expect(messageCodes(onRow)).to.deep.equal(['PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED']);
    expect(onRow.DraftMessages[0]).to.containSubset({
      message: 'The attribute is not available for the subcategory of the product.',
    });
    expect(onRow.DraftMessages[0].target).to.match(rowTarget(mouseRows.DPI, 'attribute_code'));
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
    expect(notAssigned.target).to.match(rowTarget(mouseRows.DPI, 'attribute_code'));
    const foreign = err.details.find((d) => d.code === 'PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS');
    expect(foreign.target).to.match(/\/subcategory_code$/);
    // The active row keeps its attribute.
    const { data } = await GET(`${activeRow(mouse, mouseRows.DPI)}?$select=attribute_code`);
    expect(data).to.containSubset({ attribute_code: 'DPI' });
  });

  it('reports a duplicate attribute on the draft row and rejects activation', async () => {
    await draftEdit(mouse);
    const row = draftRow(mouse, mouseRows.DPI);
    const { status } = await PATCH(row, { attribute_code: 'CONNECTIVITY' });
    expect(status).to.equal(200);
    const onRow = await readDraft(row, 'ID,DraftMessages');
    expect(messageCodes(onRow)).to.deep.equal(['PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE']);
    expect(onRow.DraftMessages[0].target).to.match(rowTarget(mouseRows.DPI, 'attribute_code'));

    // Activation checks every row: both rows with CONNECTIVITY are named.
    const err = await expect(draftActivate(mouse)).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'MULTIPLE_ERRORS' });
    expect(codesOf(err)).to.deep.equal([
      'PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE',
      'PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE',
    ]);
    for (const rowId of [mouseRows.DPI, mouseRows.CONNECTIVITY]) {
      const target = rowTarget(rowId, 'attribute_code');
      expect(err.details.filter((d) => target.test(d.target))).to.have.length(1);
    }
  });

  it('reports detail rows that do not fit a changed subcategory on the draft and rejects activation', async () => {
    await draftEdit(laptop);
    // MICE belongs to ELECTRONICS like LAPTOPS: no reset and no mismatch, only the details rule.
    const { status } = await PATCH(draftKey(laptop), { subcategory_code: 'MICE' });
    expect(status).to.equal(200);
    const draft = await readDraft(draftKey(laptop));
    expect(draft).to.containSubset({ category_code: 'ELECTRONICS', subcategory_code: 'MICE' });
    expect(messageCodes(draft)).to.deep.equal(['PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS']);
    expect(draft.DraftMessages[0]).to.containSubset({
      message:
        'Some detail rows do not fit the new subcategory. Delete or change them before saving.',
    });
    expect(draft.DraftMessages[0].target).to.match(/\)\/subcategory_code$/);

    // Save names the root and each of the three seeded rows (D1: nothing is deleted).
    const err = await expect(draftActivate(laptop)).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'MULTIPLE_ERRORS' });
    expect(codesOf(err)).to.deep.equal([
      'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED',
      'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED',
      'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED',
      'PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS',
    ]);
    const foreign = err.details.find((d) => d.code === 'PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS');
    expect(foreign.target).to.match(/\/subcategory_code$/);
    for (const { ID } of seededRows.filter((r) => r.product_ID === laptop)) {
      const target = rowTarget(ID, 'attribute_code');
      expect(err.details.filter((d) => target.test(d.target))).to.containSubset([
        { code: 'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED' },
      ]);
    }

    // With the subcategory set back, Save passes and the rows stay.
    await PATCH(draftKey(laptop), { subcategory_code: 'LAPTOPS' });
    const activated = await draftActivate(laptop);
    expect(activated.status).to.equal(200);
    expect(activated.data).to.containSubset({ IsActiveEntity: true, subcategory_code: 'LAPTOPS' });
    expect(await activeCodes(laptop)).to.deep.equal(['RAM', 'SCREEN_SIZE', 'STORAGE']);
  });

  it('rejects activation of a draft with an empty detail row (@mandatory)', async () => {
    await draftEdit(mouse);
    // Create in the table adds an empty inline row; @mandatory is not checked on a draft.
    const { status, data } = await POST(`${draftKey(mouse)}/details`, {});
    expect(status).to.equal(201);
    expect(data).to.containSubset({ attribute_code: null, value: null, IsActiveEntity: false });

    const err = await expect(draftActivate(mouse)).to.be.rejectedWith(/400/);
    expect(err).to.containSubset({ code: 'MULTIPLE_ERRORS' });
    expect(codesOf(err)).to.deep.equal(['ASSERT_MANDATORY', 'ASSERT_MANDATORY']);
    for (const element of ['attribute_code', 'value']) {
      const target = rowTarget(data.ID, element);
      expect(err.details.filter((d) => target.test(d.target))).to.have.length(1);
    }
    expect(await activeCodes(mouse)).to.deep.equal(['CONNECTIVITY', 'DPI']);
  });

  it('resolves the product of a draft detail row to the draft', async () => {
    await draftEdit(mouse);
    // A subcategory only the draft has: the row's value help reads product/subcategory_code.
    await PATCH(draftKey(mouse), { subcategory_code: 'AUDIO' });
    const expand = '?$select=ID&$expand=product($select=IsActiveEntity,subcategory_code)';

    const { data: draft } = await GET(`${draftRow(mouse, mouseRows.DPI)}${expand}`);
    expect(draft.product).to.containSubset({ IsActiveEntity: false, subcategory_code: 'AUDIO' });

    const { data: saved } = await GET(`${activeRow(mouse, mouseRows.DPI)}${expand}`);
    expect(saved.product).to.containSubset({ IsActiveEntity: true, subcategory_code: 'MICE' });
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
