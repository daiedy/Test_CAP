using { cuid, managed, Currency, sap.common.CodeList } from '@sap/cds/common';
using from '@sap/cds-common-content'; // ISO code lists: Currencies, Countries, Languages

namespace my.catalog;

/** Product sold in the catalog. Labels and validations: srv/annotations/Products.cds */
entity Products : cuid, managed {
  name        : String(100);
  description : String(500);
  price       : Decimal(15, 2);
  currency    : Currency;
  stock       : Integer;
  rating      : Integer;
  category    : Association to Categories;
  subcategory : Association to Subcategories;
  imageUrl    : String(500);
  details     : Composition of many ProductDetails on details.product = $self;
}

/** Product category, user-facing code list. Labels: srv/annotations/Categories.cds */
entity Categories : CodeList {
  key code : String(20);
}

/** Product subcategory, belongs to one category (ADR-0024). Labels: srv/annotations/Subcategories.cds */
entity Subcategories : CodeList {
  key code     : String(20);
      category : Association to Categories;
}

/** Detail attribute with its unit, reusable across subcategories (ADR-0026). Labels: srv/annotations/DetailAttributes.cds */
entity DetailAttributes : CodeList {
  key code          : String(30);
      unit          : String(10);
      subcategories : Association to many SubcategoryAttributes on subcategories.attribute = $self;
}

/** Assignment of a detail attribute to a subcategory (ADR-0026). Labels: srv/annotations/SubcategoryAttributes.cds */
// Persistence constraint (SQL UNIQUE), not semantics: one assignment per pair, a duplicate CSV row fails at deploy.
@assert.unique.pair: [ subcategory, attribute ]
entity SubcategoryAttributes : cuid {
  subcategory : Association to Subcategories;
  attribute   : Association to DetailAttributes;
}

/** Detail row of a product: an attribute and its free-text value (ADR-0026). Labels and rules: srv/annotations/ProductDetails.cds */
entity ProductDetails : cuid {
  product   : Association to Products;
  attribute : Association to DetailAttributes;
  value     : String(100);
}
