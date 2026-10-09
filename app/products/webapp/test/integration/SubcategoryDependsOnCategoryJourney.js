/* global QUnit */
// Journey "subcategory depends on the category" (feature products-subcategories, PLAN step 9,
// ADR-0024): the List Report shows the subcategory name in its own column; on the Object Page the
// Subcategory dropdown lists only the subcategories of the product's category (ValueList with the
// category_code In parameter); changing the category empties a subcategory of the old category
// (draft PATCH handler plus Common.SideEffects #CategoryChanged) and narrows the dropdown to the new
// category; a saved pair is shown by name. Laptop Pro 15 is restored to Electronics / Laptops at the
// end and no draft is left, so the seeded data the later journeys assert stays untouched.
sap.ui.define(
  ['sap/ui/test/opaQunit', './data/CategoryTexts', './data/SubcategoryTexts'],
  function (opaTest, CategoryTexts, SubcategoryTexts) {
    'use strict';

    const categories = CategoryTexts.names.en;
    const names = SubcategoryTexts.names.en;
    const SUBCATEGORY = 'subcategory_code';
    const generalInfo = { section: 'GeneralInfo' };
    const categoryField = { property: 'category_code' };
    const subcategoryField = { property: SUBCATEGORY };
    const laptopName = 'Laptop Pro 15';

    function namesOf(sCategoryCode) {
      return SubcategoryTexts.byCategory[sCategoryCode].map(function (sCode) {
        return names[sCode];
      });
    }

    // Same idiom as EditCategoryOnObjectPageJourney: selecting a value in the dropdown sends the
    // PATCH of the draft, and the field check waits until the field shows the selection.
    function chooseCategory(When, Then, sName) {
      When.onTheProductsObjectPage.onForm(generalInfo).iOpenValueHelp(categoryField);
      When.onTheCategoryDropdown.iSelectItem(sName);
      Then.onTheProductsObjectPage.onForm(generalInfo).iCheckField(categoryField, sName);
    }

    function chooseSubcategory(When, Then, sName) {
      When.onTheProductsObjectPage.onForm(generalInfo).iOpenValueHelp(subcategoryField);
      When.onTheCategoryDropdown.iSelectItem(sName, SUBCATEGORY);
      Then.onTheProductsObjectPage.onForm(generalInfo).iCheckField(subcategoryField, sName);
    }

    function seeSavedPair(Then, sCategory, sSubcategory) {
      Then.onTheProductsObjectPage.iSeeObjectPageInDisplayMode();
      Then.onTheProductsObjectPage.onForm(generalInfo).iCheckField(categoryField, sCategory);
      Then.onTheProductsObjectPage.onForm(generalInfo).iCheckField(subcategoryField, sSubcategory);
      Then.onTheProductsObjectPage.onHeader().iCheckTitle(laptopName, sCategory);
    }

    return function () {
      QUnit.module('Subcategory depends on the category');

      opaTest('The List Report shows the subcategory by name', function (Given, When, Then) {
        Given.iStartMyApp('products-display');
        Then.onTheProductsList.iSeeThisPage();
        Then.onTheProductsList.onTable().iCheckColumns(undefined, {
          subcategory_code: { header: SubcategoryTexts.labels.subcategory.en },
        });
        Then.onTheProductsList.onTable().iCheckRows(
          {
            name: laptopName,
            category_code: categories.ELECTRONICS,
            subcategory_code: names.LAPTOPS,
          },
          1
        );
        // Bluetooth Speaker and Wireless Earbuds (D1 seed).
        Then.onTheProductsList.onTable().iCheckRows({ subcategory_code: names.AUDIO }, 2);
      });

      opaTest(
        'In edit mode the subcategory dropdown lists only the subcategories of the category',
        function (Given, When, Then) {
          When.onTheProductsList.onTable().iPressRow({ name: laptopName });
          Then.onTheProductsObjectPage.iSeeThisPage();
          When.onTheProductsObjectPage.onHeader().iExecuteEdit();
          Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
          // Optional field (D2): no required marker, unlike Category.
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(subcategoryField, names.LAPTOPS, { required: false });
          When.onTheProductsObjectPage.onForm(generalInfo).iOpenValueHelp(subcategoryField);
          Then.onTheCategoryDropdown.iSeeItems(namesOf('ELECTRONICS'), SUBCATEGORY);
          // Closes the dropdown without changing the value.
          When.onTheCategoryDropdown.iSelectItem(names.LAPTOPS, SUBCATEGORY);
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(subcategoryField, names.LAPTOPS);
        }
      );

      opaTest(
        'Changing the category empties the subcategory and narrows the list',
        function (Given, When, Then) {
          chooseCategory(When, Then, categories.FURNITURE);
          // Polls until the side-effect read after the category PATCH has emptied the field.
          Then.onTheObjectPageForm.iSeeFormFieldEmpty(SUBCATEGORY);
          When.onTheProductsObjectPage.onForm(generalInfo).iOpenValueHelp(subcategoryField);
          Then.onTheCategoryDropdown.iSeeItems(namesOf('FURNITURE'), SUBCATEGORY);
          When.onTheCategoryDropdown.iSelectItem(names.DESK_ORGANIZATION, SUBCATEGORY);
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(subcategoryField, names.DESK_ORGANIZATION);
        }
      );

      opaTest('Saving shows the new subcategory by name', function (Given, When, Then) {
        When.onTheProductsObjectPage.onFooter().iExecuteSave();
        seeSavedPair(Then, categories.FURNITURE, names.DESK_ORGANIZATION);
      });

      opaTest(
        'Restoring the original pair leaves the data as seeded',
        function (Given, When, Then) {
          When.onTheProductsObjectPage.onHeader().iExecuteEdit();
          Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
          chooseCategory(When, Then, categories.ELECTRONICS);
          Then.onTheObjectPageForm.iSeeFormFieldEmpty(SUBCATEGORY);
          chooseSubcategory(When, Then, names.LAPTOPS);
          When.onTheProductsObjectPage.onFooter().iExecuteSave();
          seeSavedPair(Then, categories.ELECTRONICS, names.LAPTOPS);
          // Back to the List Report by a restart (fallback of tests-ui.md; the page is in display
          // mode and the change is saved, so no dialog): all 15 rows, none with a draft marker.
          Given.iTearDownMyApp();
          Given.iStartMyApp('products-display');
          Then.onTheProductsList.iSeeThisPage();
          Then.onTheProductsList.onTable().iCheckRows({}, 15, { isDraft: false });
          Then.onTheProductsList.onTable().iCheckRows(
            {
              name: laptopName,
              category_code: categories.ELECTRONICS,
              subcategory_code: names.LAPTOPS,
            },
            1
          );
        }
      );

      opaTest('Teardown', function (Given) {
        Given.iTearDownMyApp();
      });
    };
  }
);
