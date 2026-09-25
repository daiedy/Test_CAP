using { CatalogService } from '../catalog-service';

// Semantic annotations: labels, mandatory fields, validations. No UI layout here.
annotate CatalogService.Products with {
  name        @title: '{i18n>Products.name}'         @mandatory;
  description @title: '{i18n>Products.description}';
  price       @title: '{i18n>Products.price}'        @mandatory  @Measures.ISOCurrency: currency_code
              @assert.range: [0, 99999999.99];
  currency    @title: '{i18n>Products.currency}'     @mandatory;
  stock       @title: '{i18n>Products.stock}'        @mandatory  @assert.range: [0, 1000000];
  rating      @title: '{i18n>Products.rating}'       @assert.range: [0, 5];
  category    @title: '{i18n>Products.category}'     @mandatory  @assert.target;
  imageUrl    @title: '{i18n>Products.imageUrl}';
};

// Import from an xlsx workbook (ADR-0021): labels of the action and its file parameter.
annotate CatalogService.Products with actions {
  importProducts @title: '{i18n>Products.importProducts}'
    (file @title: '{i18n>Products.importProducts.file}');
};

annotate CatalogService.ProductsImportFile with {
  content   @title: '{i18n>ProductsImportFile.content}'
            @Core.MediaType: mediaType
            @Core.AcceptableMediaTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
            @Core.ContentDisposition.Filename: fileName;
  mediaType @title: '{i18n>ProductsImportFile.mediaType}'  @Core.IsMediaType;
  fileName  @title: '{i18n>ProductsImportFile.fileName}';
};
