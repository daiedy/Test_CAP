/* global QUnit */
// Journey "subcategory depends on the category" (feature products-subcategories, PLAN step 9,
// ADR-0024): the List Report shows the subcategory name in its own column; on the Object Page the
// Subcategory dropdown lists only the subcategories of the product's category (ValueList with the
// category_code In parameter); changing the category empties a subcategory of the old category
// (draft PATCH handler plus Common.SideEffects #CategoryChanged) and narrows the dropdown to the new
// category; a saved pair is shown by name. The edited product (Wireless Earbuds) is restored to
// Electronics / Audio at the end and no draft is left, so the seeded data the later journeys assert
// stays untouched.
// products-subcategory-cascade (PLAN step 6, ADR-0025): Common.FieldControl
// (category.code is null ? 0 : 7) disables Subcategory while the category is empty and makes it
// mandatory once a category is set. Asserted on the sap.ui.mdc.Field of the form through the state
// of onForm().iCheckField: editMode 'Disabled' or 'Editable' and the required marker. The create
// case discards its new draft; the emptying case cancels its edit draft.
sap.ui.define(
  ['sap/ui/test/opaQunit', './data/CategoryTexts', './data/SubcategoryTexts'],
  function (opaTest, CategoryTexts, SubcategoryTexts) {
    'use strict';

    const categories = CategoryTexts.names.en;
    const names = SubcategoryTexts.names.en;
    const CATEGORY = 'category_code';
    const SUBCATEGORY = 'subcategory_code';
    const generalInfo = { section: 'GeneralInfo' };
    const categoryField = { property: CATEGORY };
    const subcategoryField = { property: SUBCATEGORY };
    const laptopName = 'Laptop Pro 15';
    // The edit cases use Electronics / Audio Wireless Earbuds, a product without detail rows
    // (products-details-section, ADR-0026 D1): Laptop Pro 15 carries seeded detail rows that fit only
    // Laptops, so its Save with another subcategory is rejected by design and would leave a draft.
    const productName = 'Wireless Earbuds';

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

    // FieldControl 0 (category empty): a greyed input without the required marker, still rendered.
    function seeSubcategoryDisabled(Then) {
      Then.onTheProductsObjectPage
        .onForm(generalInfo)
        .iCheckField(subcategoryField, undefined, { editMode: 'Disabled', required: false });
    }

    // FieldControl 7 (category set): an editable input with the required marker.
    function seeSubcategoryRequired(Then) {
      Then.onTheProductsObjectPage
        .onForm(generalInfo)
        .iCheckField(subcategoryField, undefined, { editMode: 'Editable', required: true });
    }

    // Cancel in the footer and Discard in the confirmation popover.
    function discardDraft(When) {
      When.onTheProductsObjectPage.onFooter().iExecuteCancel();
      When.onTheProductsObjectPage.onFooter().iConfirmCancel();
    }

    // All 15 seeded rows, none with an editing-status marker: no draft left behind.
    function seeSeededListWithoutDraft(Then) {
      Then.onTheProductsList.iSeeThisPage();
      Then.onTheProductsList.onTable().iCheckRows({}, 15, { isDraft: false });
    }

    function seeSavedPair(Then, sCategory, sSubcategory) {
      Then.onTheProductsObjectPage.iSeeObjectPageInDisplayMode();
      Then.onTheProductsObjectPage.onForm(generalInfo).iCheckField(categoryField, sCategory);
      Then.onTheProductsObjectPage.onForm(generalInfo).iCheckField(subcategoryField, sSubcategory);
      Then.onTheProductsObjectPage.onHeader().iCheckTitle(productName, sCategory);
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
        'Create shows the subcategory disabled until a category is chosen',
        function (Given, When, Then) {
          When.onTheProductsList.onTable().iExecuteCreate();
          Then.onTheProductsObjectPage.iSeeThisPage();
          Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
          Then.onTheObjectPageForm.iSeeFormFieldEmpty(CATEGORY);
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(categoryField, undefined, { editMode: 'Editable', required: true });
          Then.onTheObjectPageForm.iSeeFormFieldEmpty(SUBCATEGORY);
          seeSubcategoryDisabled(Then);
        }
      );

      opaTest(
        'Choosing a category enables the subcategory with its subcategories',
        function (Given, When, Then) {
          chooseCategory(When, Then, categories.KITCHEN);
          // Switches on the client from the category value, no server round trip needed.
          seeSubcategoryRequired(Then);
          Then.onTheObjectPageForm.iSeeFormFieldEmpty(SUBCATEGORY);
          When.onTheProductsObjectPage.onForm(generalInfo).iOpenValueHelp(subcategoryField);
          Then.onTheCategoryDropdown.iSeeItems(namesOf('KITCHEN'), SUBCATEGORY);
          When.onTheCategoryDropdown.iSelectItem(names.CUTLERY, SUBCATEGORY);
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(subcategoryField, names.CUTLERY);
          // Discarding the new draft returns to the List Report without a new row.
          discardDraft(When);
          seeSeededListWithoutDraft(Then);
        }
      );

      opaTest(
        'In edit mode the subcategory dropdown lists only the subcategories of the category',
        function (Given, When, Then) {
          When.onTheProductsList.onTable().iPressRow({ name: productName });
          Then.onTheProductsObjectPage.iSeeThisPage();
          When.onTheProductsObjectPage.onHeader().iExecuteEdit();
          Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
          // Mandatory once a category is set (FieldControl 7), like Category.
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(subcategoryField, names.AUDIO, { required: true });
          When.onTheProductsObjectPage.onForm(generalInfo).iOpenValueHelp(subcategoryField);
          Then.onTheCategoryDropdown.iSeeItems(namesOf('ELECTRONICS'), SUBCATEGORY);
          // Closes the dropdown without changing the value.
          When.onTheCategoryDropdown.iSelectItem(names.AUDIO, SUBCATEGORY);
          Then.onTheProductsObjectPage
            .onForm(generalInfo)
            .iCheckField(subcategoryField, names.AUDIO);
        }
      );

      opaTest(
        'Changing the category empties the subcategory and narrows the list',
        function (Given, When, Then) {
          chooseCategory(When, Then, categories.FURNITURE);
          // Polls until the side-effect read after the category PATCH has emptied the field.
          Then.onTheObjectPageForm.iSeeFormFieldEmpty(SUBCATEGORY);
          // Emptied, but enabled and mandatory: the category is set (D1 = A).
          seeSubcategoryRequired(Then);
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
          chooseSubcategory(When, Then, names.AUDIO);
          When.onTheProductsObjectPage.onFooter().iExecuteSave();
          seeSavedPair(Then, categories.ELECTRONICS, names.AUDIO);
          // Back to the List Report by a restart (fallback of tests-ui.md; the page is in display
          // mode and the change is saved, so no dialog): all 15 rows, none with a draft marker.
          Given.iTearDownMyApp();
          Given.iStartMyApp('products-display');
          seeSeededListWithoutDraft(Then);
          Then.onTheProductsList.onTable().iCheckRows(
            {
              name: productName,
              category_code: categories.ELECTRONICS,
              subcategory_code: names.AUDIO,
            },
            1
          );
        }
      );

      opaTest(
        'Emptying the category empties and disables the subcategory',
        function (Given, When, Then) {
          When.onTheProductsList.onTable().iPressRow({ name: productName });
          Then.onTheProductsObjectPage.iSeeThisPage();
          When.onTheProductsObjectPage.onHeader().iExecuteEdit();
          Then.onTheProductsObjectPage.iSeeObjectPageInEditMode();
          // Clears the Category text and commits it with Enter: PATCH category_code null.
          When.onTheProductsObjectPage.onForm(generalInfo).iChangeField(categoryField, '');
          Then.onTheObjectPageForm.iSeeFormFieldEmpty(CATEGORY);
          // Polls until the side-effect read shows the subcategory the server emptied.
          Then.onTheObjectPageForm.iSeeFormFieldEmpty(SUBCATEGORY);
          seeSubcategoryDisabled(Then);
          discardDraft(When);
          seeSavedPair(Then, categories.ELECTRONICS, names.AUDIO);
          // Back to the List Report by a restart, as in the restoring case.
          Given.iTearDownMyApp();
          Given.iStartMyApp('products-display');
          seeSeededListWithoutDraft(Then);
        }
      );

      opaTest('Teardown', function (Given) {
        Given.iTearDownMyApp();
      });
    };
  }
);
