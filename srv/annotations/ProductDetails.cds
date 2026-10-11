using { CatalogService } from '../catalog-service';

// Semantic annotations: labels, mandatory fields and the set-membership rules of a detail row. No UI layout here.
annotate CatalogService.ProductDetails with {
  product   @title: '{i18n>ProductDetails.product}';
  // ADR-0026 decision 5: the attribute must be assigned to the product's subcategory and appear once per product.
  // $self is the annotated row inside an infix filter; null guards as in ADR-0024 decision 2. No @assert.unique (PLAN D2).
  attribute @title: '{i18n>ProductDetails.attribute}'  @mandatory  @assert.target
            @assert: (case
              when attribute.code is not null and product.subcategory.code is not null
                and not exists attribute.subcategories[subcategory.code = $self.product.subcategory.code]
                then 'PRODUCTS_DETAIL_ATTRIBUTE_NOT_ASSIGNED'
              when attribute.code is not null
                and exists product.details[attribute.code = $self.attribute.code and ID != $self.ID]
                then 'PRODUCTS_DETAIL_ATTRIBUTE_DUPLICATE'
            end);
  value     @title: '{i18n>ProductDetails.value}'      @mandatory;
};
