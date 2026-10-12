using { CatalogService } from '../../../srv/catalog-service';

// Presentation of the DetailListValues code list in the list fields of the Details section: localized name,
// never the code (ADR-0011, ADR-0027).
annotate CatalogService.DetailListValues with {
  code @(
    Common.Text            : name,
    Common.TextArrangement : #TextOnly
  );
};
