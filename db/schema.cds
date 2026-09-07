using { cuid, managed, Currency, sap.common.CodeList } from '@sap/cds/common';
using from '@sap/cds-common-content'; // ISO code lists: Currencies, Countries, Languages

namespace my.catalog;

/** Product sold in the catalog. Labels and validations: srv/annotations/Products.cds */
entity Products : cuid, managed {
  name        : String(100);
  description : String(500);
  price       : Decimal(10, 2);
  currency    : Currency;
  stock       : Integer;
  category    : Association to Categories;
  imageUrl    : String(500);
}

/** Product category, user-facing code list. Labels: srv/annotations/Categories.cds */
entity Categories : CodeList {
  key code : String(20);
}
