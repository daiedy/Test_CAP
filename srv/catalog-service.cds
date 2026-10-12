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

  /**
   * Detail rows of a product (ADR-0026): draft-enabled through the composition Products.details.
   * The root's grants are repeated because a directly read child is authorized on itself only;
   * writes outside the product are refused by lean draft (422 DRAFT_MODIFICATION_ONLY_VIA_ROOT).
   */
  @restrict: [
    { grant: 'READ', to: 'CatalogViewer' },
    { grant: '*',    to: 'CatalogEditor' }
  ]
  entity ProductDetails as projection on catalog.ProductDetails;

  /**
   * Selected values of a MULTI_LIST detail row (ADR-0027 decision 2): the second composition level,
   * draft-enabled through Products.details.selections; the root's grants are repeated for the same
   * reason as on ProductDetails.
   */
  @restrict: [
    { grant: 'READ', to: 'CatalogViewer' },
    { grant: '*',    to: 'CatalogEditor' }
  ]
  entity ProductDetailSelections as projection on catalog.ProductDetailSelections;

  @readonly entity Categories as projection on catalog.Categories;
  @readonly entity Subcategories as projection on catalog.Subcategories;
  @readonly entity DetailAttributes as projection on catalog.DetailAttributes;
  @readonly entity DetailValueTypes as projection on catalog.DetailValueTypes;
  @readonly entity DetailListValues as projection on catalog.DetailListValues;

  /** Attributes assigned to a subcategory with their field order; read by the draft handler (ADR-0027 decision 3). */
  @readonly entity SubcategoryAttributes as projection on catalog.SubcategoryAttributes;

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
using from './annotations/Subcategories';
using from './annotations/ProductDetails';
using from './annotations/DetailAttributes';
using from './annotations/SubcategoryAttributes';
using from './annotations/DetailListValues';
using from './annotations/DetailValueTypes';
