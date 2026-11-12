using { CatalogService } from '../catalog-service';

// Semantic annotations: labels, the set-membership rules and the typed value rules of a detail row. No UI layout here.
// Values are optional (ADR-0027 decision 4, U4) unless the subcategory assignment says required (R8, ADR-0028
// decision 5: read from the assignment, no copied column); each value column is checked against the attribute's
// value type. Every nullable operand is guarded: CQL != treats null as a value (ADR-0024 decision 2).
/** Detail row of a product: one attribute and its typed value, written only through the product's draft. */
annotate CatalogService.ProductDetails with {
  /** Product the detail row belongs to. */
  product     @title: '{i18n>ProductDetails.product}';
  // ADR-0026 decision 5, kept as the API guard (PLAN D15): the attribute must be assigned to the product's
  // subcategory and appear once per product. $self is the annotated row inside an infix filter. No @assert.unique.
  // Third branch, R8 for MULTI_LIST (ADR-0028 decision 5): a MULTI_LIST value lives in the selections, so the
  // required check sits on the attribute (no seeded required MULTI_LIST assignment, SCREENS Q3).
  /** Attribute of the row, assigned to the product's subcategory and used once per product. */
  attribute   @title: '{i18n>ProductDetails.attribute}'  @mandatory  @assert.target
              @assert: (case
                when attribute.code is not null and product.subcategory.code is not null
                  and not exists attribute.subcategories[subcategory.code = $self.product.subcategory.code]
                  then 'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED'
                when attribute.code is not null
                  and exists product.details[attribute.code = $self.attribute.code and ID != $self.ID]
                  then 'PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE'
                when attribute.valueType.code = 'MULTI_LIST'
                  and exists attribute.subcategories[subcategory.code = $self.product.subcategory.code and required = true]
                  and not exists selections
                  then 'PRODUCTS_DETAIL_VALUE_REQUIRED'
              end);
  // Field order, copied from SubcategoryAttributes.position by the draft handler (PLAN D14).
  /** Display order of the row, taken from the attribute's position in the subcategory. */
  position    @title: '{i18n>ProductDetails.position}'  @readonly;
  /** Value of a TEXT attribute. */
  textValue   @title: '{i18n>ProductDetails.textValue}'
              @assert: (case
                when textValue is not null and attribute.valueType.code is not null
                  and attribute.valueType.code != 'TEXT'
                  then 'PRODUCTS_DETAIL_VALUE_TYPE_MISMATCH'
                when attribute.valueType.code = 'TEXT'
                  and exists attribute.subcategories[subcategory.code = $self.product.subcategory.code and required = true]
                  and (textValue is null or trim(textValue) = '')
                  then 'PRODUCTS_DETAIL_VALUE_REQUIRED'
              end);
  // Non-numbers and more than 3 decimals are rejected by the framework (ASSERT_DATA_TYPE); the attribute's own
  // scale is checked on the client only, round(x, n) is not portable (PLAN D19). floor() is portable (PLAN D12).
  // ADR-0028 branches after the global bounds, which stay the first guard:
  // - R10 (decision 8): the assignment's minValue/maxValue narrow the bounds for one subcategory; $self.numberValue
  //   is compared with the assignment's columns inside the infix filter.
  // - R8 (decision 5): a required assignment needs a number.
  // - R13: laptop memory is a power of two; a literal attribute code, accepted for the showcase.
  // - R11 (decision 9): data-driven through DetailAttributes.atLeast; the rule starts at the draft row
  //   (product.details), an association from DetailAttributes would read active rows; error() passes the two
  //   localized attribute names as {0} and {1}.
  // - R12 (decision 10): guard, not user-facing; the form disables and clears the dependent row while no
  //   enabling value is selected in the product.
  /** Value of an INTEGER or DECIMAL attribute, within the attribute's minimum and maximum. */
  numberValue @title: '{i18n>ProductDetails.numberValue}'
              @assert: (case
                when numberValue is not null and attribute.valueType.code is not null
                  and attribute.valueType.code != 'INTEGER' and attribute.valueType.code != 'DECIMAL'
                  then 'PRODUCTS_DETAIL_VALUE_TYPE_MISMATCH'
                when numberValue is not null and attribute.minValue is not null and numberValue < attribute.minValue
                  then 'PRODUCTS_DETAIL_VALUE_OUT_OF_RANGE'
                when numberValue is not null and attribute.maxValue is not null and numberValue > attribute.maxValue
                  then 'PRODUCTS_DETAIL_VALUE_OUT_OF_RANGE'
                when numberValue is not null and attribute.valueType.code = 'INTEGER'
                  and floor(numberValue) != numberValue
                  then 'PRODUCTS_DETAIL_VALUE_NOT_INTEGER'
                when numberValue is not null and product.subcategory.code is not null
                  and exists attribute.subcategories[subcategory.code = $self.product.subcategory.code
                    and ((minValue is not null and $self.numberValue < minValue)
                      or (maxValue is not null and $self.numberValue > maxValue))]
                  then 'PRODUCTS_DETAIL_VALUE_OUT_OF_SUBCATEGORY_RANGE'
                when numberValue is null and attribute.valueType.code in ('INTEGER', 'DECIMAL')
                  and exists attribute.subcategories[subcategory.code = $self.product.subcategory.code and required = true]
                  then 'PRODUCTS_DETAIL_VALUE_REQUIRED'
                when numberValue is not null and attribute.code = 'RAM'
                  and numberValue not in (1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024)
                  then 'PRODUCTS_DETAIL_VALUE_NOT_POWER_OF_TWO'
                when numberValue is not null and attribute.atLeast.code is not null
                  and exists product.details[attribute.code = $self.attribute.atLeast.code
                    and numberValue is not null and numberValue > $self.numberValue]
                  then error('PRODUCTS_DETAIL_VALUE_BELOW_OTHER',
                    (coalesce(attribute.localized.name, attribute.name),
                      coalesce(attribute.atLeast.localized.name, attribute.atLeast.name)),
                    'numberValue')
                when numberValue is not null and exists attribute.enabledBy
                  and not exists product.details.selections[value.enables.code = $self.attribute.code]
                  then 'PRODUCTS_DETAIL_VALUE_NOT_ENABLED'
              end);
  // The ADR-0024 pair form: the list value must belong to the row's attribute. Second branch: R8 for LIST.
  /** Value of a LIST attribute, one of the attribute's list values. */
  listValue   @title: '{i18n>ProductDetails.listValue}'  @assert.target
              @assert: (case
                when listValue.code is not null and attribute.valueType.code is not null
                  and attribute.valueType.code != 'LIST'
                  then 'PRODUCTS_DETAIL_VALUE_TYPE_MISMATCH'
                when listValue.code is not null and attribute.code is not null
                  and listValue.attribute.code != attribute.code
                  then 'PRODUCTS_DETAIL_VALUE_NOT_IN_LIST'
                when listValue.code is null and attribute.valueType.code = 'LIST'
                  and exists attribute.subcategories[subcategory.code = $self.product.subcategory.code and required = true]
                  then 'PRODUCTS_DETAIL_VALUE_REQUIRED'
              end);
  /** Selected values of a MULTI_LIST attribute. */
  selections;
};

// Second composition level (ADR-0027 decision 4): a selected value of a MULTI_LIST row belongs to the row's
// attribute and appears once per row. The duplicate is a constraint branch, not @assert.unique (500 with SQLite).
/** Selected list value of a MULTI_LIST detail row, written only through the product's draft. */
annotate CatalogService.ProductDetailSelections with {
  /** Detail row the selection belongs to. */
  detail @title: '{i18n>ProductDetailSelections.detail}';
  /** Selected list value, one of the values of the row's attribute and chosen once per row. */
  value  @title: '{i18n>ProductDetailSelections.value}'  @mandatory  @assert.target
         @assert: (case
           when value.code is not null and detail.attribute.valueType.code is not null
             and detail.attribute.valueType.code != 'MULTI_LIST'
             then 'PRODUCTS_DETAIL_VALUE_TYPE_MISMATCH'
           when value.code is not null and detail.attribute.code is not null
             and value.attribute.code != detail.attribute.code
             then 'PRODUCTS_DETAIL_VALUE_NOT_IN_LIST'
           when value.code is not null
             and exists detail.selections[value.code = $self.value.code and ID != $self.ID]
             then 'PRODUCTS_DETAIL_SELECTION_DUPLICATE'
         end);
};
