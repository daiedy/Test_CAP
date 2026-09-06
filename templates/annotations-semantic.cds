// Template: semantic annotations in srv/annotations/<Entity>.cds. Only labels via i18n, @mandatory,
// @assert.*, @readonly, @Measures.ISOCurrency, @Core.Description. No @UI.* or ValueList (those live in app/).
// Add every i18n key to _i18n/i18n.properties and _i18n/i18n_ru.properties in the same change.
using { cuid, managed, Currency } from '@sap/cds/common';

namespace my.catalog.tpl.semantic;

entity Orders : cuid, managed {
  orderNo  : String(20);
  customer : String(100);
  email    : String(255);
  total    : Decimal(15, 2);
  currency : Currency;
  quantity : Integer;
}

service OrdersService {
  entity Orders as projection on semantic.Orders;
}

annotate OrdersService.Orders with @title: '{i18n>Orders}' {
  orderNo  @title: '{i18n>Orders.orderNo}'   @mandatory  @assert.format: '^ORD-[0-9]{6}$';
  customer @title: '{i18n>Orders.customer}'  @mandatory;
  email    @title: '{i18n>Orders.email}'     @assert.format: '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  total    @title: '{i18n>Orders.total}'     @Measures.ISOCurrency: currency_code  @readonly;
  currency @title: '{i18n>Orders.currency}'  @mandatory;
  quantity @title: '{i18n>Orders.quantity}'  @assert.range: [ 0, 1000000 ];
}
