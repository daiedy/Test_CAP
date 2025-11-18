using CatalogService from '../../catalog-service';

// Value Help annotations
annotate CatalogService.Products with {
  category @(
    Common.ValueList: {
      CollectionPath: 'Products',
      Parameters: [
        {
          $Type: 'Common.ValueListParameterInOut',
          LocalDataProperty: category,
          ValueListProperty: 'category'
        }
      ]
    }
  );
};
