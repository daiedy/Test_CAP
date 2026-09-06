using { CatalogService } from '../../../srv/catalog-service';

// Presentation annotations for CatalogService.Products (List Report + Object Page).
annotate CatalogService.Products with @(
  UI.HeaderInfo: {
    TypeName      : '{i18n>Products.typeName}',
    TypeNamePlural: '{i18n>Products.typeNamePlural}',
    Title         : { $Type: 'UI.DataField', Value: name },
    Description   : { $Type: 'UI.DataField', Value: category },
    ImageUrl      : imageUrl
  },
  UI.SelectionFields: [ name, category, price ],
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: name },
    { $Type: 'UI.DataField', Value: category },
    { $Type: 'UI.DataField', Value: price },
    { $Type: 'UI.DataField', Value: stock }
  ],
  UI.Facets: [
    { $Type: 'UI.ReferenceFacet', ID: 'GeneralInfo',  Label: '{i18n>Products.facet.general}', Target: '@UI.FieldGroup#GeneralInfo' },
    { $Type: 'UI.ReferenceFacet', ID: 'PricingStock', Label: '{i18n>Products.facet.pricing}', Target: '@UI.FieldGroup#PricingStock' },
    { $Type: 'UI.ReferenceFacet', ID: 'AdminData',    Label: '{i18n>Products.facet.admin}',   Target: '@UI.FieldGroup#AdminData' }
  ],
  UI.FieldGroup #GeneralInfo: { Data: [
    { $Type: 'UI.DataField', Value: name },
    { $Type: 'UI.DataField', Value: description },
    { $Type: 'UI.DataField', Value: category },
    { $Type: 'UI.DataField', Value: imageUrl }
  ]},
  UI.FieldGroup #PricingStock: { Data: [
    { $Type: 'UI.DataField', Value: price },
    { $Type: 'UI.DataField', Value: currency_code },
    { $Type: 'UI.DataField', Value: stock }
  ]},
  UI.FieldGroup #AdminData: { Data: [
    { $Type: 'UI.DataField', Value: createdAt },
    { $Type: 'UI.DataField', Value: createdBy },
    { $Type: 'UI.DataField', Value: modifiedAt },
    { $Type: 'UI.DataField', Value: modifiedBy }
  ]}
);

annotate CatalogService.Products with {
  // Value help on the free-text category: distinct existing values from Products itself.
  category @Common.ValueList: {
    CollectionPath: 'Products',
    Parameters    : [{
      $Type            : 'Common.ValueListParameterInOut',
      LocalDataProperty: category,
      ValueListProperty: 'category'
    }]
  };
};
