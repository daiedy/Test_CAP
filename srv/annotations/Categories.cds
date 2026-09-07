using { CatalogService } from '../catalog-service';

// Semantic annotations: labels of the read-only code list (@readonly is set on the projection). No UI layout here.
annotate CatalogService.Categories with {
  code  @title: '{i18n>Categories.code}';
  name  @title: '{i18n>Categories.name}';
  descr @title: '{i18n>Categories.descr}';
};
