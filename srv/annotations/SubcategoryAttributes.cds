using { CatalogService } from '../catalog-service';

// Semantic annotations: labels of the read-only assignment list (@readonly is set on the projection). No UI layout here.
annotate CatalogService.SubcategoryAttributes with {
  subcategory   @title: '{i18n>SubcategoryAttributes.subcategory}';
  attribute     @title: '{i18n>SubcategoryAttributes.attribute}';
  attributeName @title: '{i18n>SubcategoryAttributes.attributeName}';
};
