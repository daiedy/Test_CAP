using { CatalogService } from '../catalog-service';

// Semantic annotations: labels of the read-only assignment list (@readonly is set on the projection). No UI layout here.
/** Detail attribute assigned to a subcategory, with the position of its field in a product's details. */
annotate CatalogService.SubcategoryAttributes with {
  /** Subcategory the attribute is assigned to. */
  subcategory @title: '{i18n>SubcategoryAttributes.subcategory}';
  /** Attribute assigned to the subcategory. */
  attribute   @title: '{i18n>SubcategoryAttributes.attribute}';
  /** Position of the attribute's field in a product's details. */
  position    @title: '{i18n>SubcategoryAttributes.position}';
  // Read by the detail rules of srv/annotations/ProductDetails.cds: R8 (required) and R10 (bounds), ADR-0028.
  /** Whether a product of the subcategory needs a value for the attribute. */
  required    @title: '{i18n>SubcategoryAttributes.required}';
  /** Lowest allowed value of the attribute for products of the subcategory, inside the attribute's own minimum. */
  minValue    @title: '{i18n>SubcategoryAttributes.minValue}';
  /** Highest allowed value of the attribute for products of the subcategory, inside the attribute's own maximum. */
  maxValue    @title: '{i18n>SubcategoryAttributes.maxValue}';
};
