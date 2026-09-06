using { cuid, managed, Currency } from '@sap/cds/common';
using from '@sap/cds-common-content'; // ISO code lists: Currencies, Countries, Languages

namespace my.catalog;

/** Product sold in the catalog. Labels and validations: srv/annotations/Products.cds */
entity Products : cuid, managed {
  name        : String(100);
  description : String(500);
  price       : Decimal(10, 2);
  currency    : Currency;
  stock       : Integer;
  category    : String(50);
  imageUrl    : String(500);
}
