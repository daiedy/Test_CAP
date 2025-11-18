using CatalogService from '../../catalog-service';

// Constraints and validations for Products
annotate CatalogService.Products with {
  name @(
    mandatory,
    Common.Label: 'Product Name'
  );
  
  description @(
    Common.Label: 'Description'
  );
  
  price @(
    mandatory,
    Common.Label: 'Price',
    Measures.ISOCurrency: currency
  );
  
  currency @(
    mandatory,
    Common.Label: 'Currency'
  );
  
  stock @(
    mandatory,
    Common.Label: 'Stock Quantity'
  );
  
  category @(
    mandatory,
    Common.Label: 'Category'
  );
  
  imageUrl @(
    Common.Label: 'Image URL'
  );
};
