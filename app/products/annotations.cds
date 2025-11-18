using CatalogService from '../../srv/catalog-service';

annotate CatalogService.Products with @(
  UI.HeaderInfo: {
    TypeName: 'Product',
    TypeNamePlural: 'Products',
    Title: {Value: name},
    Description: {Value: category}
  }
);
