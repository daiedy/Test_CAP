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

// Subcategory of a product (ADR-0024): optional (D2) and checked against the product's category
// by an @assert constraint (decision 2). Rows created here are named 'Subcategory %'.
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

  it('creates a product without a subcategory', async () => {
    const payload = { ...newProduct, name: 'Subcategory None Lamp' };
    const { status, data } = await POST(`${base}/Products`, active(payload));
    expect(status).to.equal(201);
    expect(data).to.containSubset({
      IsActiveEntity: true,
      category_code: 'FURNITURE',
      subcategory_code: null,
    });
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
  // The draft's subcategory pair and DraftMessages. An @assert constraint writes its message at
  // commit, so it shows on a GET after the PATCH, not in the PATCH response (ADR-0024).
  const readDraft = async (key = draftKey(id)) => {
    const { data } = await GET(`${key}?$select=category_code,subcategory_code,DraftMessages`);
    expect(data.DraftMessages).to.be.an('array');
    return data;
  };
  const messageCodes = (draft) => draft.DraftMessages.map((m) => m.code);

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

  it('reports an unknown currency on the draft and rejects activation (@assert.target)', async () => {
    await draftEdit();
    try {
      // On a draft, @assert.* are messages (200), not errors.
      const { status, data } = await PATCH(draftKey(id), { currency_code: 'XXX' });
      expect(status).to.equal(200);
      expect(data.DraftMessages).to.containSubset([{ code: 'ASSERT_TARGET' }]);
      // Activation enforces them; the target is matched by its suffix (TESTING.md).
      const err = await expect(draftActivate()).to.be.rejectedWith(/400/);
      expect(err).to.containSubset({ code: 'ASSERT_TARGET' });
      expect(err.target).to.match(/currency_code$/);
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

  it('clears the subcategory when a draft changes the category', async () => {
    await draftEdit();
    try {
      await PATCH(draftKey(id), { category_code: 'FURNITURE', subcategory_code: 'LIGHTING' });
      // The category alone changes: LIGHTING does not belong to KITCHEN and is emptied (D4).
      const { status } = await PATCH(draftKey(id), { category_code: 'KITCHEN' });
      expect(status).to.equal(200);
      const draft = await readDraft();
      expect(draft).to.containSubset({ category_code: 'KITCHEN', subcategory_code: null });
      // Silent reset (D8): no message on the draft.
      expect(draft.DraftMessages).to.deep.equal([]);
    } finally {
      await discard();
    }
  });

  it('keeps a subcategory that belongs to the category the draft gets', async () => {
    await draftEdit();
    try {
      // A pair sent together is not reset; the next category PATCH is compared with LIGHTING.
      await PATCH(draftKey(id), { category_code: 'KITCHEN', subcategory_code: 'LIGHTING' });
      const { status } = await PATCH(draftKey(id), { category_code: 'FURNITURE' });
      expect(status).to.equal(200);
      const draft = await readDraft();
      expect(draft).to.containSubset({ category_code: 'FURNITURE', subcategory_code: 'LIGHTING' });
    } finally {
      await discard();
    }
  });

  it('reports a mismatched subcategory on the draft and rejects activation', async () => {
    await draftEdit();
    try {
      // On a draft the constraint is a message (200), not an error.
      const { status } = await PATCH(draftKey(id), {
        category_code: 'KITCHEN',
        subcategory_code: 'LIGHTING',
      });
      expect(status).to.equal(200);
      const { DraftMessages } = await readDraft();
      expect(DraftMessages).to.containSubset([
        {
          code: 'PRODUCTS_SUBCATEGORY_MISMATCH',
          message: 'The subcategory does not belong to the category of the product.',
        },
      ]);
      const mismatch = DraftMessages.find((m) => m.code === 'PRODUCTS_SUBCATEGORY_MISMATCH');
      expect(mismatch.target).to.match(/\/subcategory_code$/);
      // Activation enforces it; the target is prefixed with the action parameter `in/`.
      const err = await expect(draftActivate()).to.be.rejectedWith(/400/);
      expect(err).to.containSubset({
        code: 'PRODUCTS_SUBCATEGORY_MISMATCH',
        target: 'in/subcategory_code',
      });
    } finally {
      await discard();
    }
  });

  it('activates a draft whose category and subcategory change together', async () => {
    await draftEdit();
    try {
      await PATCH(draftKey(id), { category_code: 'ELECTRONICS', subcategory_code: 'AUDIO' });
      const activated = await draftActivate();
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
        rating: 5,
        IsActiveEntity: true,
      },
      {
        name: 'Import USB-C Hub',
        price: '49.00',
        currency_code: 'GBP',
        stock: 15,
        category_code: 'ELECTRONICS',
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
      'PRODUCTS_IMPORT_DUPLICATE_NAME',
    ]);
    expect(messages[0]).to.equal(
      'No products were imported. Correct the rows listed below and import the file again.'
    );
    expect(messages[1]).to.match(/^Row 3, column "name": /);
    expect(messages[2]).to.match(/^Row 4, column "stock": /);
    expect(messages[3]).to.match(/^Row 5, column "category": /);
    expect(messages[4]).to.match(/^Row 6, column "price": /);
    expect(messages[5]).to.equal(
      'Row 7, column "name": a product named "yoga MAT" already exists in the catalog or earlier in the file.'
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
    ]);
    expect(messages.slice(1)).to.deep.equal([
      'The header row has no column "price".',
      'The header row has no column "category".',
    ]);
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
