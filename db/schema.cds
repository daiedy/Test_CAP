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
  // Other products with the same name, case and leading or trailing spaces ignored: the uniqueness rule
  // of srv/annotations/Products.cds reads it (ADR-0028 decision 2; never @assert.unique, ADR-0026 decision 1).
  namesakes   : Association to many Products
                  on lower(trim(namesakes.name)) = lower(trim($self.name)) and namesakes.ID != $self.ID;
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

/** Value type of a detail attribute: TEXT, INTEGER, DECIMAL, LIST, MULTI_LIST (ADR-0027). Labels: srv/annotations/DetailValueTypes.cds */
entity DetailValueTypes : CodeList {
  key code : String(20);
}

/**
 * Detail attribute with its unit and value type, reusable across subcategories (ADR-0026, ADR-0027).
 * minValue and maxValue bound numeric values, scale is the decimals of a DECIMAL attribute;
 * values is the list of a LIST or MULTI_LIST attribute. atLeast names the attribute whose value in
 * the same product this one must not be below; enabledBy lists the values that enable this attribute
 * (ADR-0028 decisions 9 and 10). Labels: srv/annotations/DetailAttributes.cds
 */
entity DetailAttributes : CodeList {
  key code          : String(30);
      unit          : String(10);
      valueType     : Association to DetailValueTypes;
      minValue      : Decimal(15, 3);
      maxValue      : Decimal(15, 3);
      scale         : Integer;
      atLeast       : Association to DetailAttributes;
      subcategories : Association to many SubcategoryAttributes on subcategories.attribute = $self;
      values        : Association to many DetailListValues on values.attribute = $self;
      enabledBy     : Association to many DetailListValues on enabledBy.enables = $self;
}

/**
 * Allowed value of a LIST or MULTI_LIST attribute, one list per attribute, position = display order (ADR-0027);
 * enables names the attribute that selecting this value makes available (ADR-0028 decision 10).
 * Labels: srv/annotations/DetailListValues.cds
 */
entity DetailListValues : CodeList {
  key code      : String(30);
      attribute : Association to DetailAttributes;
      position  : Integer;
      enables   : Association to DetailAttributes;
}

/**
 * Assignment of a detail attribute to a subcategory, position = field order (ADR-0026, ADR-0027);
 * required and the bounds minValue, maxValue apply to the products of the subcategory (ADR-0028
 * decisions 5 and 8). Labels: srv/annotations/SubcategoryAttributes.cds
 */
// Persistence constraint (SQL UNIQUE), not semantics: one assignment per pair, a duplicate CSV row fails at deploy.
@assert.unique.pair: [ subcategory, attribute ]
entity SubcategoryAttributes : cuid {
  subcategory : Association to Subcategories;
  attribute   : Association to DetailAttributes;
  position    : Integer;
  required    : Boolean;
  minValue    : Decimal(15, 3);
  maxValue    : Decimal(15, 3);
}

/**
 * Detail row of a product: an attribute and its typed value (ADR-0027). The column used depends on
 * the attribute's value type; MULTI_LIST values are the selections. Rows are created by the draft
 * handler. Labels and rules: srv/annotations/ProductDetails.cds
 */
entity ProductDetails : cuid {
  product     : Association to Products;
  attribute   : Association to DetailAttributes;
  position    : Integer;
  textValue   : String(100);
  numberValue : Decimal(15, 3);
  listValue   : Association to DetailListValues;
  selections  : Composition of many ProductDetailSelections on selections.detail = $self;
}

/** Selected value of a MULTI_LIST detail row, second composition level (ADR-0027). Labels and rules: srv/annotations/ProductDetails.cds */
entity ProductDetailSelections : cuid {
  detail : Association to ProductDetails;
  value  : Association to DetailListValues;
}
