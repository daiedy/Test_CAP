using { CatalogService } from '../catalog-service';

// Semantic annotations: labels of the read-only code list (@readonly is set on the projection). No UI layout here.
annotate CatalogService.Subcategories with {
  code     @title: '{i18n>Subcategories.code}';
  name     @title: '{i18n>Subcategories.name}';
  descr    @title: '{i18n>Subcategories.descr}';
  category @title: '{i18n>Subcategories.category}';
};
