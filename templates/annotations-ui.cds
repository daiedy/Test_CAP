// Template: UI annotations in app/<app>/annotations/<Entity>.cds. Target is always the service projection.
// Paths use dots (currency.name). Labels via i18n keys from app/<app>/webapp/i18n/; omit Label when it
// equals the element @title. Reference from app/<app>/annotations.cds with `using from './annotations/<Entity>';`.
using { cuid, managed, Currency, sap.common.CodeList } from '@sap/cds/common';

namespace my.catalog.tpl.ui;

entity Categories : CodeList { key code : String(20); }
entity Orders : cuid, managed {
  orderNo  : String(20);
  customer : String(100);
  total    : Decimal(15, 2);
  currency : Currency;
  category : Association to Categories;
}

service OrdersService {
  entity Categories as projection on ui.Categories;
  entity Orders as projection on ui.Orders
    actions { action confirm() returns Orders; };
}

annotate OrdersService.Orders with @(
  UI.HeaderInfo : {
    TypeName       : '{i18n>Orders.typeName}',
    TypeNamePlural : '{i18n>Orders.typeNamePlural}',
    Title          : { $Type: 'UI.DataField', Value: orderNo },
    Description    : { $Type: 'UI.DataField', Value: customer }
  },
  UI.SelectionFields : [ orderNo, customer, category_code ],
  UI.LineItem : [
    { $Type: 'UI.DataFieldForAction', Action: 'OrdersService.confirm', Label: '{i18n>Orders.action.confirm}' },
    { $Type: 'UI.DataField', Value: orderNo },
    { $Type: 'UI.DataField', Value: customer },
    { $Type: 'UI.DataField', Value: total },
    { $Type: 'UI.DataField', Value: category_code }
  ],
  UI.Facets : [
    { $Type: 'UI.ReferenceFacet', ID: 'General', Label: '{i18n>Orders.facet.general}', Target: '@UI.FieldGroup#General' }
  ],
  UI.FieldGroup #General : { Data: [
    { $Type: 'UI.DataField', Value: orderNo },
    { $Type: 'UI.DataField', Value: customer },
    { $Type: 'UI.DataField', Value: total },
    { $Type: 'UI.DataField', Value: category_code }
  ]}
);

// Value help on the foreign key: show the text, hide the code.
annotate OrdersService.Orders with {
  category @(
    Common.Text            : category.name,
    Common.TextArrangement : #TextOnly,
    Common.ValueList       : {
      CollectionPath : 'Categories',
      Parameters     : [
        { $Type: 'Common.ValueListParameterInOut',       LocalDataProperty: category_code, ValueListProperty: 'code' },
        { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
      ]
    }
  );
}
