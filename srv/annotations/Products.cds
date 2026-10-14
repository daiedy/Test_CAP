using { CatalogService } from '../catalog-service';

// Semantic annotations: labels, mandatory fields, validations. No UI layout here.
/** Product sold in the catalog, created and changed through a draft. */
annotate CatalogService.Products with {
  /** Name of the product. */
  name        @title: '{i18n>Products.name}'         @mandatory;
  /** Free-text description of the product. */
  description @title: '{i18n>Products.description}';
  /** Unit price of the product in its currency. */
  price       @title: '{i18n>Products.price}'        @mandatory  @Measures.ISOCurrency: currency_code
              @assert.range: [0, 99999999.99];
  /** Currency of the price. */
  currency    @title: '{i18n>Products.currency}'     @mandatory  @assert.target;
  /** Number of units in stock. */
  stock       @title: '{i18n>Products.stock}'        @mandatory  @assert.range: [0, 1000000];
  /** Customer rating on a scale of 0 to 5. */
  rating      @title: '{i18n>Products.rating}'       @assert.range: [0, 5];
  /** Category of the product. */
  category    @title: '{i18n>Products.category}'     @mandatory  @assert.target;
  // Cross-field consistency (ADR-0024 decision 2): both null guards are required, CQL != treats null as a value.
  // Second branch (ADR-0026 decisions 5 and 6): a subcategory that leaves detail rows with unassigned attributes.
  /** Subcategory of the product, which must belong to the product's category. */
  subcategory @title: '{i18n>Products.subcategory}'  @mandatory  @assert.target
              @assert: (case
                when subcategory.code is not null and category.code is not null
                  and subcategory.category.code != category.code
                  then 'PRODUCTS_SUBCATEGORY_MISMATCH'
                when subcategory.code is not null
                  and exists details[attribute.code is not null
                    and not exists attribute.subcategories[subcategory.code = $self.subcategory.code]]
                  then 'PRODUCTS_SUBCATEGORY_HAS_FOREIGN_DETAILS'
              end);
  /** URL of the product image. */
  imageUrl    @title: '{i18n>Products.imageUrl}';
  /** Detail rows of the product, one per attribute assigned to its subcategory. */
  details     @title: '{i18n>Products.details}';
};

// Import from an xlsx workbook (ADR-0021): labels of the action and its file parameter.
annotate CatalogService.Products with actions {
  importProducts @title: '{i18n>Products.importProducts}'
    (file @title: '{i18n>Products.importProducts.file}' @mandatory);
};

annotate CatalogService.ProductsImportFile with {
  content   @title: '{i18n>ProductsImportFile.content}'
            @Core.MediaType: mediaType
            @Core.AcceptableMediaTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
            @Core.ContentDisposition.Filename: fileName;
  mediaType @title: '{i18n>ProductsImportFile.mediaType}'  @Core.IsMediaType;
  fileName  @title: '{i18n>ProductsImportFile.fileName}';
};
