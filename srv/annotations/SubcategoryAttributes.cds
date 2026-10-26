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
};
