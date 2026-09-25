using { my.catalog as catalog } from '../db/schema';

/** Public catalog API. UI annotations live in app/products/annotations. */
@requires: 'authenticated-user'
// importProducts: a 1,000-row workbook with long descriptions exceeds the 100kb default (research 5.6, ADR-0021)
@cds.server.body_parser.limit: '1mb'
service CatalogService {
  @odata.draft.enabled
  @restrict: [
    { grant: 'READ', to: 'CatalogViewer' },
    { grant: '*',    to: 'CatalogEditor' }
  ]
  entity Products as projection on catalog.Products actions {
    /** Creates active products from an uploaded xlsx workbook, all-or-nothing (ADR-0021). */
    action importProducts(in: many $self, file: ProductsImportFile not null) returns Integer;
  };

  /** Uploaded workbook of importProducts: base64 content, media type and file name (ADR-0021). */
  type ProductsImportFile {
    content   : LargeBinary;
    mediaType : String(100);
    fileName  : String(255);
  }

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
