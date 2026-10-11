using { CatalogService } from '../catalog-service';

// Semantic annotations: labels of the read-only code list (@readonly is set on the projection). No UI layout here.
annotate CatalogService.DetailAttributes with {
  code  @title: '{i18n>DetailAttributes.code}';
  name  @title: '{i18n>DetailAttributes.name}';
  descr @title: '{i18n>DetailAttributes.descr}';
  unit  @title: '{i18n>DetailAttributes.unit}';
};
