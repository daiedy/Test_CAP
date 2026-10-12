using { CatalogService } from '../catalog-service';

// Semantic annotations: labels, the set-membership rules and the typed value rules of a detail row. No UI layout here.
// Values are optional (ADR-0027 decision 4, U4); each value column is checked against the attribute's value type.
// Every nullable operand is guarded: CQL != treats null as a value (ADR-0024 decision 2).
annotate CatalogService.ProductDetails with {
  product     @title: '{i18n>ProductDetails.product}';
  // ADR-0026 decision 5, kept as the API guard (PLAN D15): the attribute must be assigned to the product's
  // subcategory and appear once per product. $self is the annotated row inside an infix filter. No @assert.unique.
  attribute   @title: '{i18n>ProductDetails.attribute}'  @mandatory  @assert.target
              @assert: (case
                when attribute.code is not null and product.subcategory.code is not null
                  and not exists attribute.subcategories[subcategory.code = $self.product.subcategory.code]
                  then 'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED'
                when attribute.code is not null
                  and exists product.details[attribute.code = $self.attribute.code and ID != $self.ID]
                  then 'PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE'
              end);
  // Field order, copied from SubcategoryAttributes.position by the draft handler (PLAN D14).
  position    @title: '{i18n>ProductDetails.position}'  @readonly;
  textValue   @title: '{i18n>ProductDetails.textValue}'
              @assert: (case
                when textValue is not null and attribute.valueType.code is not null
                  and attribute.valueType.code != 'TEXT'
                  then 'PRODUCTS_DETAIL_VALUE_TYPE_MISMATCH'
              end);
  // Non-numbers and more than 3 decimals are rejected by the framework (ASSERT_DATA_TYPE); the attribute's own
  // scale is checked on the client only, round(x, n) is not portable (PLAN D19). floor() is portable (PLAN D12).
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
              end);
  // The ADR-0024 pair form: the list value must belong to the row's attribute.
  listValue   @title: '{i18n>ProductDetails.listValue}'  @assert.target
              @assert: (case
                when listValue.code is not null and attribute.valueType.code is not null
                  and attribute.valueType.code != 'LIST'
                  then 'PRODUCTS_DETAIL_VALUE_TYPE_MISMATCH'
                when listValue.code is not null and attribute.code is not null
                  and listValue.attribute.code != attribute.code
                  then 'PRODUCTS_DETAIL_VALUE_NOT_IN_LIST'
              end);
};

// Second composition level (ADR-0027 decision 4): a selected value of a MULTI_LIST row belongs to the row's
// attribute and appears once per row. The duplicate is a constraint branch, not @assert.unique (500 with SQLite).
annotate CatalogService.ProductDetailSelections with {
  detail @title: '{i18n>ProductDetailSelections.detail}';
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
