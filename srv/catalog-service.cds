using { my.catalog as catalog } from '../db/schema';

/** Public catalog API. UI annotations live in app/products/annotations. */
service CatalogService {
  @odata.draft.enabled entity Products as projection on catalog.Products;
  @readonly entity Categories as projection on catalog.Categories;
}

using from './annotations/Products';
using from './annotations/Categories';
