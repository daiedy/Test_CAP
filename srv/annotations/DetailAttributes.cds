using { CatalogService } from '../catalog-service';

// Semantic annotations: labels of the read-only code list (@readonly is set on the projection). No UI layout here.
/** Characteristic a product can carry, with its value type, unit and limits, a read-only code list. */
annotate CatalogService.DetailAttributes with {
  /** Code of the attribute. */
  code      @title: '{i18n>DetailAttributes.code}';
  /** Name of the attribute in the user's language. */
  name      @title: '{i18n>DetailAttributes.name}';
  /** Description of the attribute in the user's language. */
  descr     @title: '{i18n>DetailAttributes.descr}';
  /** Unit of measure of the attribute's value. */
  unit      @title: '{i18n>DetailAttributes.unit}';
  /** Value type that decides which value column of a detail row holds the value. */
  valueType @title: '{i18n>DetailAttributes.valueType}';
  /** Lowest allowed value of an INTEGER or DECIMAL attribute. */
  minValue  @title: '{i18n>DetailAttributes.minValue}';
  /** Highest allowed value of an INTEGER or DECIMAL attribute. */
  maxValue  @title: '{i18n>DetailAttributes.maxValue}';
  /** Number of decimal places of a DECIMAL attribute. */
  scale     @title: '{i18n>DetailAttributes.scale}';
  // Read by the detail rules of srv/annotations/ProductDetails.cds: R11 (atLeast) and R12 (enabledBy), ADR-0028.
  /** Attribute whose value in the same product this attribute's value must not be below. */
  atLeast   @title: '{i18n>DetailAttributes.atLeast}';
  /** Subcategory assignments of the attribute. */
  subcategories;
  /** Allowed values of a LIST or MULTI_LIST attribute. */
  values;
  /** List values that make the attribute available when one of them is selected in the same product. */
  enabledBy @title: '{i18n>DetailAttributes.enabledBy}';
};
