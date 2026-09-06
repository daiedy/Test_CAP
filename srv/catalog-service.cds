using { my.catalog as catalog } from '../db/schema';

/** Public catalog API. UI annotations live in app/products/annotations. */
service CatalogService {
  entity Products as projection on catalog.Products;
}

using from './annotations/Products';
