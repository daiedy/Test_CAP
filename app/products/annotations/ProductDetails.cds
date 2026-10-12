using { CatalogService } from '../../../srv/catalog-service';

// Presentation annotations for CatalogService.ProductDetails: the table section "Details" of the Products
// Object Page (ADR-0026 decision 7). Column headers come from the @title of the elements, so no record has a Label.
// Inline creation is the Fiori Elements V4 default of an Object Page table; Create and Delete exist only in edit mode.
annotate CatalogService.ProductDetails with @(
  // The table title "Details (n)"; TypeNamePlural is the same word as the facet Label Products.facet.details.
  UI.HeaderInfo: {
    TypeName      : '{i18n>ProductDetails.typeName}',
    TypeNamePlural: '{i18n>ProductDetails.typeNamePlural}'
  },
  UI.LineItem: [
    // The row's identity: High keeps it in the table on narrow screens, Value and Unit pop in under it.
    { $Type: 'UI.DataField', Value: attribute_code, ![@UI.Importance]: #High },
    { $Type: 'UI.DataField', Value: value },
    { $Type: 'UI.DataField', Value: attribute.unit }
  ],
  // Attribute choice on a draft row: Fiori Elements re-reads the name and the unit shown in the row.
  Common.SideEffects #AttributeChanged: {
    SourceProperties: [ attribute_code ],
    TargetProperties: [ 'attribute/name', 'attribute/unit' ]
  }
);

annotate CatalogService.ProductDetails with {
  // Attributes assigned to the product's subcategory (ADR-0026 decision 4, the ADR-0024 decision 1 shape): the one
  // ValueList is written by hand to add the In parameter and replaces the compiler-generated one. The In source is
  // the navigation path to the parent, read late from the row context; with an empty subcategory the list is unfiltered.
  attribute @(
    Common.Text                     : attribute.name,
    Common.TextArrangement          : #TextOnly,
    Common.ValueListWithFixedValues : true,
    Common.ValueList                : {
      Label          : '{i18n>ProductDetails.attribute}',
      CollectionPath : 'SubcategoryAttributes',
      Parameters     : [
        { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: attribute_code, ValueListProperty: 'attribute_code' },
        { $Type: 'Common.ValueListParameterIn', LocalDataProperty: product.subcategory_code, ValueListProperty: 'subcategory_code' },
        { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'attributeName' }
      ]
    }
  );
};
