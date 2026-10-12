using { CatalogService } from '../../../srv/catalog-service';

// Presentation of the assignment list in the attribute dropdown of a detail row: the flattened localized name,
// never the code (ADR-0011, ADR-0026 decision 4).
annotate CatalogService.SubcategoryAttributes with {
  attribute @(
    Common.Text            : attributeName,
    Common.TextArrangement : #TextOnly
  );
};
