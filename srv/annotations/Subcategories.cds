using { CatalogService } from '../catalog-service';

// Semantic annotations: labels of the read-only code list (@readonly is set on the projection). No UI layout here.
/** Product subcategory within one category, a read-only code list. */
annotate CatalogService.Subcategories with {
  /** Code of the subcategory. */
  code     @title: '{i18n>Subcategories.code}';
  /** Name of the subcategory in the user's language. */
  name     @title: '{i18n>Subcategories.name}';
  /** Description of the subcategory in the user's language. */
  descr    @title: '{i18n>Subcategories.descr}';
  /** Category the subcategory belongs to. */
  category @title: '{i18n>Subcategories.category}';
};
