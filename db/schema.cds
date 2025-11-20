using { managed, Currency } from '@sap/cds/common';

namespace my.catalog;

entity Products : managed {
    key ID          : UUID;
        name        : String(100)             @title: 'Product Name';
        description : String(500)             @title: 'Description';
        price       : Decimal(10, 2)          @title: 'Price';
        currency    : Currency;
        stock       : Integer                 @title: 'Stock Quantity';
        category    : String(50)              @title: 'Category';
        imageUrl    : String(500)             @title: 'Image URL';
}
