// OData contract test: the compiled EDMX of CatalogService must match the committed snapshot.
// Update deliberately with `npx vitest -u` and explain the change in docs/CHANGELOG.md.
import cds from '@sap/cds';
import { readFileSync } from 'node:fs';

const test = cds.test(import.meta.dirname + '/..');
// @requires on CatalogService also protects $metadata, so even the contract test needs a user (ADR-0013).
test.defaults.auth = { username: 'alice' };

// The <Annotations> block of one target in the compact EDMX (whitespace between tags removed).
const annotationsOf = (compact, target) => {
  const start = compact.indexOf(`<Annotations Target="${target}">`);
  expect(start).toBeGreaterThan(-1);
  return compact.slice(start, compact.indexOf('</Annotations>', start));
};

describe('OData contract of CatalogService', () => {
  it('matches the EDMX snapshot', async () => {
    const csn = await cds.load('*');
    const edmx = cds.compile.to.edmx(csn, { service: 'CatalogService', version: 'v4' });
    expect(edmx).toMatchSnapshot();
  });

  it('keeps app/products/webapp/localService/metadata.xml in sync with the model', async () => {
    // Mock mode serves this file; regenerate it with
    // cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml
    const csn = await cds.load('*');
    const edmx = cds.compile.to.edmx(csn, { service: 'CatalogService', version: 'v4' });
    const localized = cds.localize(csn, 'en', edmx);
    const snapshot = readFileSync(
      import.meta.dirname + '/../app/products/webapp/localService/metadata.xml',
      'utf8'
    );
    expect(snapshot.trim()).toBe(localized.trim());
  });

  it('serves $metadata over HTTP with English labels', async () => {
    const { status, data } = await test.get('/odata/v4/catalog/$metadata', {
      headers: { 'Accept-Language': 'en' },
    });
    expect(status).toBe(200);
    expect(data).toContain('Common.Label" String="Product Name"');
  });

  // ADR-0003 amendment (catalog-hygiene): money is Decimal(15, 2); the historical
  // Decimal(10, 2) exception of Products.price is withdrawn.
  it('exposes price as Edm.Decimal with precision 15 and scale 2', async () => {
    const { status, data } = await test.get('/odata/v4/catalog/$metadata', {
      headers: { 'Accept-Language': 'en' },
    });
    expect(status).toBe(200);
    expect(data).toContain('<Property Name="price" Type="Edm.Decimal" Precision="15" Scale="2"/>');
  });

  it('exposes the semantic key of Products in the contract', async () => {
    // ADR-0015: FE V4 renders the draft/lock marker in the first semantic-key LineItem column.
    const { status, data } = await test.get('/odata/v4/catalog/$metadata', {
      headers: { 'Accept-Language': 'en' },
    });
    expect(status).toBe(200);
    expect(data).toContain('Term="Common.SemanticKey"');
    expect(data).toContain('<PropertyPath>name</PropertyPath>');
  });

  it('exposes the Permissions singleton', async () => {
    // ADR-0013: the UI reads its edit permission from a read-only singleton, not from a row.
    const { status, data } = await test.get('/odata/v4/catalog/$metadata', {
      headers: { 'Accept-Language': 'en' },
    });
    expect(status).toBe(200);
    expect(data).toContain('<Singleton Name="Permissions"');
  });

  // ADR-0013: the three UI.*Hidden annotations (app/products/annotations/Products.cds) hide the
  // editing actions from a CatalogViewer via the Permissions singleton read through $edmJson,
  // addressed by the short path /Permissions/isEditor (catalog-hygiene; capire "Role-based
  // Visibility": Fiori elements also accepts the path without the entity container).
  it('hides the editing actions of Products from anyone who is not a CatalogEditor', async () => {
    const { status, data } = await test.get('/odata/v4/catalog/$metadata', {
      headers: { 'Accept-Language': 'en' },
    });
    expect(status).toBe(200);
    // The EDMX is pretty-printed, so compare without the whitespace between the tags.
    const compact = data.replace(/>\s+</g, '><');
    for (const term of ['UI.CreateHidden', 'UI.UpdateHidden', 'UI.DeleteHidden']) {
      expect(compact).toContain(
        `<Annotation Term="${term}"><Not><Path>/Permissions/isEditor</Path></Not></Annotation>`
      );
    }
  });
  // products-rating-column: FE V4 renders a DataFieldForAnnotation that targets a DataPoint with
  // Visualization Rating as a sap.m.RatingIndicator (app/products/annotations/Products.cds).
  it('exposes the rating column as a UI.DataPoint with Visualization Rating', async () => {
    const { status, data } = await test.get('/odata/v4/catalog/$metadata', {
      headers: { 'Accept-Language': 'en' },
    });
    expect(status).toBe(200);
    // The EDMX is pretty-printed, so compare without the whitespace between the tags.
    const compact = data.replace(/>\s+</g, '><');
    expect(compact).toContain(
      '<Annotation Term="UI.DataPoint" Qualifier="Rating"><Record Type="UI.DataPointType">' +
        '<PropertyValue Property="Value" Path="rating"/>' +
        '<PropertyValue Property="TargetValue" Int="5"/>' +
        '<PropertyValue Property="Visualization" EnumMember="UI.VisualizationType/Rating"/>' +
        '</Record></Annotation>'
    );
    const column =
      '<Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Label" String="Rating"/>' +
      '<PropertyValue Property="Target" AnnotationPath="@UI.DataPoint#Rating"/>';
    const lineItem = compact.match(/<Annotation Term="UI.LineItem">.*?<\/Annotation>/)[0];
    expect(lineItem).toContain(
      column + '<Annotation Term="UI.Importance" EnumMember="UI.ImportanceType/Low"/></Record>'
    );
    const generalInfo = compact.match(
      /<Annotation Term="UI.FieldGroup" Qualifier="GeneralInfo">.*?<\/Annotation>/
    )[0];
    expect(generalInfo).toContain(column + '</Record>');
  });

  // ADR-0021: the Excel import is an action bound to the Products collection whose `file`
  // parameter carries the workbook as an xlsx stream; the List Report table toolbar shows it
  // through a UI.DataFieldForAction hidden for non-editors like Create and Delete (ADR-0013),
  // read through the same short singleton path /Permissions/isEditor.
  it('importProducts is a collection-bound action shown in the List Report toolbar', async () => {
    const { status, data } = await test.get('/odata/v4/catalog/$metadata', {
      headers: { 'Accept-Language': 'en' },
    });
    expect(status).toBe(200);
    // The EDMX is pretty-printed, so compare without the whitespace between the tags.
    const compact = data.replace(/>\s+</g, '><');
    expect(compact).toContain(
      '<Action Name="importProducts" IsBound="true">' +
        '<Parameter Name="in" Type="Collection(CatalogService.Products)" Nullable="true"/>' +
        '<Parameter Name="file" Type="CatalogService.ProductsImportFile" Nullable="false"/>' +
        '<ReturnType Type="Edm.Int32"/></Action>'
    );
    expect(compact).toContain(
      '<ComplexType Name="ProductsImportFile"><Property Name="content" Type="Edm.Stream"/>'
    );
    const content = compact.match(
      /<Annotations Target="CatalogService.ProductsImportFile\/content">.*?<\/Annotations>/
    )[0];
    expect(content).toContain(
      '<Annotation Term="Core.AcceptableMediaTypes"><Collection>' +
        '<String>application/vnd.openxmlformats-officedocument.spreadsheetml.sheet</String>' +
        '</Collection></Annotation>'
    );
    const lineItem = compact.match(
      /<Annotation Term="UI.LineItem"><Collection>.*?<\/Collection><\/Annotation>/
    )[0];
    expect(lineItem).toContain(
      '<Record Type="UI.DataFieldForAction">' +
        '<PropertyValue Property="Action" String="CatalogService.importProducts"/>' +
        '<PropertyValue Property="Label" String="Import from Excel"/>' +
        '<Annotation Term="UI.Hidden"><Not>' +
        '<Path>/Permissions/isEditor</Path>' +
        '</Not></Annotation></Record>'
    );
  });

  // ADR-0021 "Amendment: list refresh and required file": after the import Fiori Elements
  // reloads the Products list (side effect on the action), and the dialog requires a file.
  it('importProducts refreshes the Products list and requires a file', async () => {
    const { status, data } = await test.get('/odata/v4/catalog/$metadata', {
      headers: { 'Accept-Language': 'en' },
    });
    expect(status).toBe(200);
    // The EDMX is pretty-printed, so compare without the whitespace between the tags.
    const compact = data.replace(/>\s+</g, '><');
    const target = 'CatalogService.importProducts(Collection(CatalogService.Products))';
    expect(annotationsOf(compact, target)).toContain(
      '<Annotation Term="Common.SideEffects"><Record Type="Common.SideEffectsType">' +
        '<PropertyValue Property="TargetEntities"><Collection>' +
        '<NavigationPropertyPath>/CatalogService.EntityContainer/Products</NavigationPropertyPath>' +
        '</Collection></PropertyValue></Record></Annotation>'
    );
    expect(annotationsOf(compact, `${target}/file`)).toContain(
      '<Annotation Term="Common.FieldControl" EnumMember="Common.FieldControlType/Mandatory"/>'
    );
  });

  // products-subcategories, ADR-0024 decision 1: the subcategory dropdown asks only for the
  // subcategories of the product's category through the In parameter category_code; the
  // hand-written ValueList replaces the compiler-generated one, a second one would list all 15.
  // Decision 3: a category change re-reads the subcategory the draft PATCH handler may have emptied.
  it('narrows the subcategory value help by category and refreshes it on a category change', async () => {
    const { status, data } = await test.get('/odata/v4/catalog/$metadata', {
      headers: { 'Accept-Language': 'en' },
    });
    expect(status).toBe(200);
    // The EDMX is pretty-printed, so compare without the whitespace between the tags.
    const compact = data.replace(/>\s+</g, '><');
    const subcategory = annotationsOf(compact, 'CatalogService.Products/subcategory_code');
    expect(subcategory).toContain(
      '<Annotation Term="Common.ValueListWithFixedValues" Bool="true"/>'
    );
    // Term="Common.ValueList" with the closing quote: a qualified one counts, the FixedValues term does not.
    expect(subcategory.match(/Term="Common\.ValueList"/g) ?? []).toHaveLength(1);
    const valueList = subcategory.match(/<Annotation Term="Common.ValueList">.*?<\/Annotation>/)[0];
    expect(valueList).toContain(
      '<PropertyValue Property="CollectionPath" String="Subcategories"/>'
    );
    expect(valueList).toContain(
      '<Record Type="Common.ValueListParameterInOut">' +
        '<PropertyValue Property="LocalDataProperty" PropertyPath="subcategory_code"/>' +
        '<PropertyValue Property="ValueListProperty" String="code"/></Record>'
    );
    expect(valueList).toContain(
      '<Record Type="Common.ValueListParameterIn">' +
        '<PropertyValue Property="LocalDataProperty" PropertyPath="category_code"/>' +
        '<PropertyValue Property="ValueListProperty" String="category_code"/></Record>'
    );
    // Asserted on the entity type, where the annotation is written; the compiler also copies it
    // to the entity set CatalogService.EntityContainer/Products.
    expect(annotationsOf(compact, 'CatalogService.Products')).toContain(
      '<Annotation Term="Common.SideEffects" Qualifier="CategoryChanged">' +
        '<Record Type="Common.SideEffectsType">' +
        '<PropertyValue Property="SourceProperties"><Collection>' +
        '<PropertyPath>category_code</PropertyPath></Collection></PropertyValue>' +
        '<PropertyValue Property="TargetProperties"><Collection>' +
        '<String>subcategory_code</String><String>subcategory/name</String>' +
        '</Collection></PropertyValue></Record></Annotation>'
    );
  });
});
