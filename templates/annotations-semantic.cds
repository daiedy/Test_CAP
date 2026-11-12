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
  unitPrice : Decimal(15, 2);
  currency : Currency;
  quantity : Integer;
}

service OrdersService {
  entity Orders as projection on semantic.Orders;
}

/** Customer order with its number, total and quantity. */
annotate OrdersService.Orders with @title: '{i18n>Orders}' {
  /** Order number in the form ORD-000001. */
  // Own text for a format rule (ADR-0028 decision 1): the code stays ASSERT_FORMAT, the key is in
  // _i18n/messages.properties and messages_ru.properties.
  orderNo  @title: '{i18n>Orders.orderNo}'   @mandatory  @assert.format: '^ORD-[0-9]{6}$'
           @assert.format.message: 'ORDERS_NUMBER_FORMAT';
  /** Name of the customer who placed the order. */
  customer @title: '{i18n>Orders.customer}'  @mandatory;
  /** Contact e-mail address of the customer. */
  email    @title: '{i18n>Orders.email}'     @assert.format: '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  /** Order total in the order currency, calculated by the server. */
  total    @title: '{i18n>Orders.total}'     @Measures.ISOCurrency: currency_code  @readonly;
  // Open lower bound: (0) excludes 0, _ is infinity. It guards the server and the import; Fiori Elements V4 ignores
  // Validation.Exclusive, so a bound the form must enforce is closed at the smallest step: [0.01, 99999999.99].
  // error() with two targets and a path argument (ADR-0028 decision 3): the first target is the message target,
  // the second marks the other field too; targets are string literals of the flattened element names.
  // Keys ORDERS_UNIT_PRICE_POSITIVE and ORDERS_UNIT_PRICE_WHOLE_ONLY go to _i18n/messages.properties and messages_ru.properties.
  /** Price of one unit in the order currency, entered by the user. */
  unitPrice @title: '{i18n>Orders.unitPrice}' @Measures.ISOCurrency: currency_code
           @assert.range: [(0), 99999999.99]  @assert.range.message: 'ORDERS_UNIT_PRICE_POSITIVE'
           @assert: (case
             when unitPrice is not null and currency.minorUnit is not null and currency.minorUnit = 0
               and floor(unitPrice) != unitPrice
               then error('ORDERS_UNIT_PRICE_WHOLE_ONLY', (currency.code), ('unitPrice', 'currency_code'))
           end);
  /** Currency of the order total and the unit price. */
  currency @title: '{i18n>Orders.currency}'  @mandatory;
  /** Number of ordered units. */
  quantity @title: '{i18n>Orders.quantity}'  @assert.range: [ 0, 1000000 ];
}
