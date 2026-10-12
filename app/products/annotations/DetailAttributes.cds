using { CatalogService } from '../../../srv/catalog-service';

// Presentation of the DetailAttributes code list in dropdowns and value help: localized name, never the code (ADR-0011).
annotate CatalogService.DetailAttributes with {
  code @(
    Common.Text            : name,
    Common.TextArrangement : #TextOnly
  );
};
