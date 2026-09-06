// Template: application service in srv/<name>-service.cds. One projection per entity, only needed fields,
// bound actions before unbound, authorization on service and projections. No @UI.* here.
// Semantic annotations are imported at the end from srv/annotations/<Entity>.cds.
using { cuid, managed, Currency } from '@sap/cds/common';

namespace my.catalog.tpl.svc;

entity Orders : cuid, managed {
  orderNo  : String(20);
  status   : String(10) enum { NEW = 'NEW'; CONFIRMED = 'CONFIRMED'; CANCELLED = 'CANCELLED'; };
  total    : Decimal(15, 2);
  currency : Currency;
  internalNote : String(500);
}

/** Public API of the template module. */
@requires: 'authenticated-user'
service OrdersService {

  @restrict: [
    { grant: 'READ',  to: 'authenticated-user' },
    { grant: '*',     to: 'OrdersAdmin' }
  ]
  entity Orders as projection on svc.Orders excluding { internalNote }
    actions {
      /** Bound action: works on one instance, exposed in UI as DataFieldForAction. */
      action confirm() returns Orders;
      action cancel(reason : String(200)) returns Orders;
    };

  /** Unbound function: only when there is no single instance to bind to. */
  function openOrdersCount() returns Integer;
}

// In a real project the last line imports the semantic annotations:
// using from './annotations/Orders';
