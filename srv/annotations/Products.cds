using { CatalogService } from '../catalog-service';

// Semantic annotations: labels, mandatory fields, validations. No UI layout here.
annotate CatalogService.Products with {
  name        @title: '{i18n>Products.name}'         @mandatory;
  description @title: '{i18n>Products.description}';
  price       @title: '{i18n>Products.price}'        @mandatory  @Measures.ISOCurrency: currency_code
              @assert.range: [0, 99999999.99];
  currency    @title: '{i18n>Products.currency}'     @mandatory;
  stock       @title: '{i18n>Products.stock}'        @mandatory  @assert.range: [0, 1000000];
  category    @title: '{i18n>Products.category}'     @mandatory  @assert.target;
  imageUrl    @title: '{i18n>Products.imageUrl}';
};
