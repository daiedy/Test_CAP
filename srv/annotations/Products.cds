using { CatalogService } from '../catalog-service';

// Semantic annotations: labels, mandatory fields, validations. No UI layout here.
/** Product sold in the catalog, created and changed through a draft. */
annotate CatalogService.Products with {
  // R1 (ADR-0028 decision 1): at least 3 characters after trimming, a regex for a minimum length; own text,
  // the code stays ASSERT_FORMAT. R2 (decision 2): unique ignoring case and padding over the namesakes
  // self-association; never @assert.unique (500 on SQLite, silent on drafts, ADR-0026 decision 1).
  /** Name of the product. */
  name        @title: '{i18n>Products.name}'         @mandatory
              @assert.format: '^\s*\S.+\S\s*$'      @assert.format.message: 'PRODUCTS_NAME_TOO_SHORT'
              @assert: (case
                when name is not null and exists namesakes
                  then 'PRODUCTS_NAME_DUPLICATE'
              end);
  // R6 (ADR-0028 decision 4): required only while in stock, so not @mandatory; error() names both fields,
  // the first is the target, the second an additional target (decision 3).
  /** Free-text description of the product. */
  description @title: '{i18n>Products.description}'
              @assert: (case
                when stock > 0 and (description is null or trim(description) = '')
                  then error('PRODUCTS_DESCRIPTION_REQUIRED_IN_STOCK', null, ('description', 'stock'))
              end);
  // R3 (ADR-0028 decision 1): a price above 0 as the closed lower bound 0.01, the smallest Decimal(15, 2)
  // amount. Closed, not open (user decision 2026-11-12): FE V4 ignores Validation.Exclusive on the client
  // but applies Validation.Minimum, so the field refuses 0 before the PATCH. Own text, code stays ASSERT_RANGE.
  // R4 (decision 3): a currency without minor units (sap.common.Currencies.minorUnit = 0) takes whole
  // amounts; floor() is portable (ADR-0027); targets are string literals of the element names.
  /** Unit price of the product in its currency. */
  price       @title: '{i18n>Products.price}'        @mandatory  @Measures.ISOCurrency: currency_code
              @assert.range: [0.01, 99999999.99]    @assert.range.message: 'PRODUCTS_PRICE_POSITIVE'
              @assert: (case
                when price is not null and currency.minorUnit is not null and currency.minorUnit = 0
                  and floor(price) != price
                  then error('PRODUCTS_PRICE_MINOR_UNIT', null, ('price', 'currency_code'))
              end);
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
  // R5 (ADR-0028 decision 1): the browser loads the image, so https only and no whitespace.
  /** URL of the product image. */
  imageUrl    @title: '{i18n>Products.imageUrl}'
              @assert.format: '^https://\S+$'       @assert.format.message: 'PRODUCTS_IMAGE_URL_HTTPS';
  /** Detail rows of the product, one per attribute assigned to its subcategory. */
  details     @title: '{i18n>Products.details}';
  /** Other products whose name equals this product's name, ignoring case and leading or trailing spaces. */
  namesakes   @title: '{i18n>Products.namesakes}';
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
