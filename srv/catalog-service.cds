using my.catalog from '../db/schema';

service CatalogService {
  entity Products as projection on catalog.Products;
}

using from './annotations/Products/ui';
using from './annotations/Products/valuehelps';
using from './annotations/Products/constraints';
