using { CatalogService } from '../catalog-service';

// Semantic annotations: labels of the read-only list values of an attribute (@readonly is set on the projection). No UI layout here.
/** Allowed value of a LIST or MULTI_LIST attribute, a read-only code list. */
annotate CatalogService.DetailListValues with {
  /** Code of the list value. */
  code      @title: '{i18n>DetailListValues.code}';
  /** Name of the list value in the user's language. */
  name      @title: '{i18n>DetailListValues.name}';
  /** Description of the list value in the user's language. */
  descr     @title: '{i18n>DetailListValues.descr}';
  /** Attribute the list value belongs to. */
  attribute @title: '{i18n>DetailListValues.attribute}';
  /** Display order of the value in its attribute's list. */
  position  @title: '{i18n>DetailListValues.position}';
};
