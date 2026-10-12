using { CatalogService } from '../catalog-service';

// Semantic annotations: labels of the read-only list values of an attribute (@readonly is set on the projection). No UI layout here.
annotate CatalogService.DetailListValues with {
  code      @title: '{i18n>DetailListValues.code}';
  name      @title: '{i18n>DetailListValues.name}';
  descr     @title: '{i18n>DetailListValues.descr}';
  attribute @title: '{i18n>DetailListValues.attribute}';
  position  @title: '{i18n>DetailListValues.position}';
};
