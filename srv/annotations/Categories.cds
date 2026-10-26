using { CatalogService } from '../catalog-service';

// Semantic annotations: labels of the read-only code list (@readonly is set on the projection). No UI layout here.
/** Product category, a read-only code list. */
annotate CatalogService.Categories with {
  /** Code of the category. */
  code  @title: '{i18n>Categories.code}';
  /** Name of the category in the user's language. */
  name  @title: '{i18n>Categories.name}';
  /** Description of the category in the user's language. */
  descr @title: '{i18n>Categories.descr}';
};
