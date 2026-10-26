// Template: application service in srv/<name>-service.cds. One projection per entity, only needed fields,
// bound actions before unbound, authorization on service and projections. No @UI.* here.
// Header: @protocol, @title and @Core.SchemaVersion (same value as package.json version). Descriptions are doc
// comments, one English sentence each, on the service, the action and its parameters (ADR-0029); element and
// projection descriptions live in srv/annotations/<Entity>.cds. A note that is not API text is a // comment.
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

/** Order management API of the template module. */
@protocol: 'odata-v4'
@title: 'Order API'
@Core.SchemaVersion: '1.0.0'
@requires: 'authenticated-user'
service OrdersService {

  @restrict: [
    { grant: 'READ',  to: 'authenticated-user' },
    { grant: '*',     to: 'OrdersAdmin' }
  ]
  entity Orders as projection on svc.Orders excluding { internalNote }
    actions {
      // Bound action: works on one instance, exposed in UI as DataFieldForAction.
      /** Confirms the order. */
      action confirm() returns Orders;
      /** Cancels the order with a reason given by the user. */
      action cancel(reason : String(200)) returns Orders;
    };

  // Unbound function: only when there is no single instance to bind to.
  /** Returns the number of open orders. */
  function openOrdersCount() returns Integer;
}

// In a real project the last line imports the semantic annotations:
// using from './annotations/Orders';
