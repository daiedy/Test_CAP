using { CatalogService } from '../../../srv/catalog-service';

// Presentation of the Categories code list in dropdowns and value help: localized name, never the code (ADR-0011).
annotate CatalogService.Categories with {
  code @(
    Common.Text            : name,
    Common.TextArrangement : #TextOnly
  );
};
