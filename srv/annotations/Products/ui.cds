using CatalogService from '../../catalog-service';

annotate CatalogService.Products with @(UI: {
    SelectionFields         : [
        name,
        category,
        price
    ],
    LineItem                : [
        {
            $Type: 'UI.DataField',
            Value: name,
            Label: 'Product Name'
        },
        {
            $Type: 'UI.DataField',
            Value: category,
            Label: 'Category'
        },
        {
            $Type: 'UI.DataField',
            Value: price,
            Label: 'Price'
        },
        {
            $Type: 'UI.DataField',
            Value: currency_code,
            Label: 'Currency'
        },
        {
            $Type: 'UI.DataField',
            Value: stock,
            Label: 'Stock'
        }
    ],


    HeaderInfo              : {
        TypeName      : 'Product',
        TypeNamePlural: 'Products',
        Title         : {
            $Type: 'UI.DataField',
            Value: name
        },
        Description   : {
            $Type: 'UI.DataField',
            Value: category
        },
        ImageUrl      : imageUrl
    },

    Facets                  : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'General Information',
            Target: '@UI.FieldGroup#GeneralInfo'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Pricing & Stock',
            Target: '@UI.FieldGroup#PricingStock'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Administrative Data',
            Target: '@UI.FieldGroup#AdminData'
        }
    ],

    FieldGroup #GeneralInfo : {Data: [
        {
            $Type: 'UI.DataField',
            Value: name,
            Label: 'Product Name'
        },
        {
            $Type: 'UI.DataField',
            Value: description,
            Label: 'Description'
        },
        {
            $Type: 'UI.DataField',
            Value: category,
            Label: 'Category'
        },
        {
            $Type: 'UI.DataField',
            Value: imageUrl,
            Label: 'Image URL'
        }
    ]},

    FieldGroup #PricingStock: {Data: [
        {
            $Type: 'UI.DataField',
            Value: price,
            Label: 'Price'
        },
        {
            $Type: 'UI.DataField',
            Value: currency_code,
            Label: 'Currency'
        },
        {
            $Type: 'UI.DataField',
            Value: stock,
            Label: 'Stock Quantity'
        }
    ]},

    FieldGroup #AdminData   : {Data: [
        {
            $Type: 'UI.DataField',
            Value: createdAt,
            Label: 'Created At'
        },
        {
            $Type: 'UI.DataField',
            Value: createdBy,
            Label: 'Created By'
        },
        {
            $Type: 'UI.DataField',
            Value: modifiedAt,
            Label: 'Modified At'
        },
        {
            $Type: 'UI.DataField',
            Value: modifiedBy,
            Label: 'Modified By'
        }
    ]}
});
