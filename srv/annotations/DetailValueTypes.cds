using { CatalogService } from '../catalog-service';

// Semantic annotations: labels of the read-only code list of value types (@readonly is set on the projection). No UI layout here.
/** Value type of a detail attribute, a read-only code list. */
annotate CatalogService.DetailValueTypes with {
  /** Code of the value type: TEXT, INTEGER, DECIMAL, LIST or MULTI_LIST. */
  code  @title: '{i18n>DetailValueTypes.code}';
  /** Name of the value type in the user's language. */
  name  @title: '{i18n>DetailValueTypes.name}';
  /** Description of the value type in the user's language. */
  descr @title: '{i18n>DetailValueTypes.descr}';
};
