namespace my.catalog;

entity Products : managed {
  key ID          : UUID;
      name        : String(100) @title: 'Product Name';
      description : String(500) @title: 'Description';
      price       : Decimal(10, 2) @title: 'Price';
      currency    : String(3) default 'USD' @title: 'Currency';
      stock       : Integer @title: 'Stock Quantity';
      category    : String(50) @title: 'Category';
      imageUrl    : String(500) @title: 'Image URL';
}

// Aspect for managed fields
aspect managed {
  createdAt  : Timestamp @cds.on.insert: $now;
  createdBy  : String @cds.on.insert: $user;
  modifiedAt : Timestamp @cds.on.insert: $now @cds.on.update: $now;
  modifiedBy : String @cds.on.insert: $user @cds.on.update: $user;
}
