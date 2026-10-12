using { CatalogService } from '../catalog-service';

// Semantic annotations: labels of the read-only code list of value types (@readonly is set on the projection). No UI layout here.
annotate CatalogService.DetailValueTypes with {
  code  @title: '{i18n>DetailValueTypes.code}';
  name  @title: '{i18n>DetailValueTypes.name}';
  descr @title: '{i18n>DetailValueTypes.descr}';
};
