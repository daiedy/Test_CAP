// Template: service handlers in srv/<name>-service.js (ESM). One class per service, registration in init().
// Order: before (validation) -> on (actions) -> after (side effects). Reject with message keys from
// _i18n/messages.properties. Shared logic goes to srv/lib/<topic>.js, never duplicated here.
import cds from '@sap/cds';
import { orderTotal } from './lib/orders.js';

const LOG = cds.log('orders');

export default class OrdersService extends cds.ApplicationService {
  async init() {
    const { Orders } = this.entities;

    // before: validation that cannot be expressed with @assert.* / @mandatory
    this.before(['CREATE', 'UPDATE'], Orders, (req) => {
      const { quantity, unitPrice } = req.data;
      if (
        quantity !== undefined &&
        unitPrice !== undefined &&
        Number(unitPrice) === 0 &&
        quantity > 0
      ) {
        return req.reject(400, 'ORDERS_FREE_WITH_QUANTITY', [req.data.orderNo]);
      }
    });

    // on: bound action implementation
    this.on('confirm', Orders, async (req) => {
      const [order] = await SELECT.from(Orders).where({ ID: req.params[0].ID });
      if (!order) return req.reject(404, 'ORDERS_NOT_FOUND', [req.params[0].ID]);
      const total = orderTotal(order.quantity, Number(order.unitPrice));
      await UPDATE(Orders, order.ID).with({ status: 'CONFIRMED', total });
      LOG.info('confirmed', { ID: order.ID, total });
      return { ...order, status: 'CONFIRMED', total };
    });

    // after: side effects only, never mutate the DB here in a way that needs a transaction
    this.after('CREATE', Orders, (order) => {
      LOG.info('order created', { ID: order.ID });
    });

    return super.init();
  }
}
