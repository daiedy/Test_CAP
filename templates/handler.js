// Template: service handlers in srv/<name>-service.js (ESM). One class per service, registration in init().
// Order: before (validation) -> on (actions) -> after (side effects). Reject with message keys from
// _i18n/messages.properties. Shared logic goes to srv/lib/<topic>.js, never duplicated here.
import cds from '@sap/cds';
import { reorderQuantity } from './lib/stock.js';

const LOG = cds.log('catalog');

export default class CatalogService extends cds.ApplicationService {
  async init() {
    const { Products } = this.entities;

    // before: validation that cannot be expressed with @assert.* / @mandatory
    this.before(['CREATE', 'UPDATE'], Products, (req) => {
      const { stock, price } = req.data;
      if (stock !== undefined && price !== undefined && Number(price) === 0 && stock > 0) {
        return req.reject(400, 'PRODUCT_FREE_WITH_STOCK', [req.data.name]);
      }
    });

    // on: bound action implementation
    this.on('reorder', Products, async (req) => {
      const [product] = await SELECT.from(Products).where({ ID: req.params[0].ID });
      if (!product) return req.reject(404, 'PRODUCT_NOT_FOUND', [req.params[0].ID]);
      const quantity = reorderQuantity(product.stock, req.data.amount);
      await UPDATE(Products, product.ID).with({ stock: quantity });
      LOG.info('reordered', { ID: product.ID, quantity });
      return { ...product, stock: quantity };
    });

    // after: side effects only, never mutate the DB here in a way that needs a transaction
    this.after('CREATE', Products, (product) => {
      LOG.info('product created', { ID: product.ID });
    });

    return super.init();
  }
}
