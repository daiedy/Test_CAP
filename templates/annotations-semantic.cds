// Template: semantic annotations in srv/annotations/<Entity>.cds. Only labels via i18n, @mandatory,
// @assert.*, @readonly, @Measures.ISOCurrency. No @UI.* or ValueList (those live in app/).
// Descriptions are doc comments (/** ... */), one English sentence each, above the annotate statement and above
// each element; never @description or @Core.Description (ADR-0029).
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

/** Customer order with its number, total and quantity. */
annotate OrdersService.Orders with @title: '{i18n>Orders}' {
  /** Order number in the form ORD-000001. */
  orderNo  @title: '{i18n>Orders.orderNo}'   @mandatory  @assert.format: '^ORD-[0-9]{6}$';
  /** Name of the customer who placed the order. */
  customer @title: '{i18n>Orders.customer}'  @mandatory;
  /** Contact e-mail address of the customer. */
  email    @title: '{i18n>Orders.email}'     @assert.format: '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  /** Order total in the order currency, calculated by the server. */
  total    @title: '{i18n>Orders.total}'     @Measures.ISOCurrency: currency_code  @readonly;
  /** Currency of the order total. */
  currency @title: '{i18n>Orders.currency}'  @mandatory;
  /** Number of ordered units. */
  quantity @title: '{i18n>Orders.quantity}'  @assert.range: [ 0, 1000000 ];
}
