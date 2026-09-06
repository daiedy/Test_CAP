// Template: new domain entity in db/. Copy the entity block into db/schema.cds (or db/<module>.cds),
// keep `cuid, managed`, PascalCase plural entity names, camelCase elements, explicit string lengths.
// Labels, @mandatory and @assert.* do NOT go here: see templates/annotations-semantic.cds.
using { cuid, managed, Currency, sap.common.CodeList } from '@sap/cds/common';

namespace my.catalog.tpl.entity;

/** Code list for a user-editable dropdown. Key is `code`, texts are localized. */
entity Categories : CodeList {
  key code : String(20);
}

/** Root business object. */
entity Orders : cuid, managed {
  orderNo     : String(20);
  customer    : String(100);
  total       : Decimal(15, 2);
  currency    : Currency;
  category    : Association to Categories;
  items       : Composition of many OrderItems on items.order = $self;
}

/** Child of Orders; deleted together with the parent. */
entity OrderItems : cuid {
  order    : Association to Orders;
  product  : String(100);
  quantity : Integer;
  price    : Decimal(15, 2);
  amount   : Decimal(15, 2) = quantity * price;   // calculated element instead of a handler
}
