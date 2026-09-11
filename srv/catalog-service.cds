using { my.catalog as catalog } from '../db/schema';

/** Public catalog API. UI annotations live in app/products/annotations. */
@requires: 'authenticated-user'
service CatalogService {
  @odata.draft.enabled
  @restrict: [
    { grant: 'READ', to: 'CatalogViewer' },
    { grant: '*',    to: 'CatalogEditor' }
  ]
  entity Products as projection on catalog.Products;

  @readonly entity Categories as projection on catalog.Categories;

  /** Permission signal for the UI: read-only singleton, no table, filled by srv/catalog-service.js (ADR-0013). */
  @odata.singleton
  @cds.persistence.skip
  @readonly
  entity Permissions {
    key ID       : String;
        isEditor : Boolean;
  }
}

using from './annotations/Products';
using from './annotations/Categories';
