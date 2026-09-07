# Выученные уроки

Записи добавляют все агенты через скилл `retro` и человек. Формат: дата, что случилось, почему, как избежать, источник. Новые записи сверху. Список типовых ошибок агентов в CAP и Fiori из публикаций: `docs/ai-pipeline-plan.md`, раздел 3.4.

## 2026-09-07. `$filter` при мультивыборе в фильтре FE V4 виден только внутри `$batch`

Что: при выборе нескольких значений в выпадающем фильтре (MultiComboBox) FE V4 отправляет запрос через `POST .../$batch`; отдельного GET с `$filter` в сети нет, итоговое выражение (`category_code eq 'KITCHEN' or category_code eq 'SPORTS'`) видно только в multipart-теле batch-запроса. Замечено `ui-verifier` при проверке фильтра категорий в фиче `categories-code-list`.
Как избежать: проверять сеть через `list_network_requests` (фильтр `resourceTypes: ["xhr","fetch"]`) и `get_network_request` на найденный `$batch`, а не искать отдельный GET с `$filter` в URL.

## 2026-09-07. Фаза дизайна дала реальные правки плана: `Common.Text` на ключе собственного CodeList обязателен

Что: при подготовке экранов `ux-designer` через `mcp__cds-mcp__search_model` по `CatalogService.Currencies` обнаружил, что `@Common.Text: name` у `sap.common.Currencies.code` задан в самом определении `@sap/cds/common`, а не наследуется от аспекта `CodeList`; у новой `Categories : CodeList { key code }` такой аннотации не будет, и без неё выпадающий список и колонки диалога value help покажут код (`ELECTRONICS`), а не название. `PLAN.md` дополнен обязательным шагом: `app/products/annotations/Categories.cds` с `Common.Text: name` + `Common.TextArrangement: #TextOnly` на `code`.
Как избежать: для любого нового собственного `CodeList` явно проверять и добавлять `Common.Text` на его ключ в `app/<app>/annotations/<CodeList>.cds`, не полагаться на то, что аспект `CodeList` даёт эту аннотацию сам. Закреплено в ADR-0011, часть 1.

## 2026-09-07. Выпадающий список `ValueListWithFixedValues` в FE V4 это typeahead-таблица, а не `sap.m.List`

Что: в OPA-журнее проверка элементов выпадающего списка категорий (`sap.m.List` + `sap.m.DisplayListItem`, как в `sap.fe.test.api.FilterBarActions#iSelectDropDownOption`) 60 секунд не находила контролы, хотя список на скриншоте открыт. Дамп через `sap/ui/test/OpaPlugin` в кадре приложения показал: SAP Fiori elements для OData V4 (1.152) рендерит фиксированный список как typeahead `sap.m.Table` с id `...::FilterFieldValueHelp::category_code::Popover::qualifier::::SuggestTable` (родители `sap.ui.mdc.valuehelp.content.MTable` → `sap.ui.mdc.valuehelp.Popover`), строки `sap.m.ColumnListItem` в режиме `MultiSelect` (чекбокс с суффиксом `-selectMulti`), ячейка `sap.fe.macros.Field` → `FieldWrapper` → `sap.m.Text`, причём один и тот же текст рендерится двумя `sap.m.Text` (pop-in), а кода в строке нет. Заметил `test-ui` в фиче `categories-code-list`.
Как избежать: для проверок списка искать `sap.m.Table` по regex id `category_code::Popover::.*SuggestTable$` с `isDialogElement(true)`, брать `ColumnListItem`, сравнивать множество уникальных видимых текстов строки с названием; выбор в фильтре нажатием `Press({ idSuffix: 'selectMulti' })` на строке. Стандартный `iSelectDropDownOption` для этой конструкции не подходит. Page object: `app/products/webapp/test/integration/pages/CategoryDropdown.js`.

## 2026-09-07. `fiori run` (:8080) не поднимает приложение через FLP-интент, OPA гоняется против `cds watch` (:4004)

Что: `flpSandbox.html` и `index.html` резолвят компонент по `url: "/products/webapp"` и грузят UI5 абсолютными ссылками на `https://ui5.sap.com`. `fiori run` (`npm start`, `ui5.yaml`) отдаёт webapp в корне (`/Component.js` 200, `/products/webapp/Component.js` 404), поэтому в headless Chrome на `http://localhost:8080/test/flpSandbox.html#products-display` List Report не появляется за 3 минуты; на `http://localhost:4004/products/webapp/test/flpSandbox.html#products-display` (`cds watch` отдаёт `app/` статикой) таблица появляется. Кроме того, прокси `fiori-tools-proxy` закрепляет `/resources` на `minUI5Version` 1.136.0, а html-страницы приложения берут CDN «latest» (1.152.0): тестовый кадр с `../resources/` и кадр приложения работали бы на разных версиях `sap.fe`.
Как избежать: тестовые страницы Test Starter бутстрапятся с того же CDN, что и приложение (`https://ui5.sap.com/resources/sap/ui/test/starter/createSuite.js` и `runTest.js`; `prefer-test-starter` принимает абсолютный путь, оканчивающийся на `/resources/sap/ui/test/starter/...`), а `npm run test:ui` целится в `:4004/products/webapp/test/testsuite.qunit.html` при `npm run watch`. Флаг `--page-timeout 900000` в скрипте ограничивает страницу 15 минутами (по умолчанию 0, то есть без лимита), чтобы зависший OPA-прогон не держал раннер бесконечно; `--parallel 1`, потому что страница одна и живой бэкенд общий. Дефект самого `npm start` (URL `/products/webapp` в sandbox-конфиге и абсолютный CDN вместо `resources/`) закрывается вместе с долгом `modernize-flp-sandbox`, решает `fiori-app-dev`/пользователь.

## 2026-09-07. Каркас `@sap-ux/ui5-test-writer` 1.9.6 нужно доводить до Test Starter, journeys генератора непригодны

Что: `generateOPAFiles(projectPath, { htmlTarget: 'test/flpSandbox.html' })` создаёт page objects `pages/<Target>.gen.js` (годятся как есть: `appId`, `componentId`, `contextPath` из manifest) и `pages/JourneyRunner.js`, но `testsuite.qunit.html/js` в legacy-формате `parent.jsUnitTestSuite`, `integration/opaTests.qunit.html` с собственным bootstrap (`sap_fiori_3`) и `QUnit.start()` в `opaTests.qunit.js`, что ловит `ui5lint` `prefer-test-starter`. Журнеи `*Journey.gen.js` вызывают `Given.iStartMyApp()` без интента (в FLP sandbox это домашняя страница шелла, не List Report); с `scriptName` журней ссылается на `onTheProductsList`, а раннер регистрирует `onTheProductsListGenerated`. При чтении аннотаций генератор печатает «UI.LineItem annotation has not been defined» (аннотации в `metadata.xml`, локальных файлов в manifest нет), поэтому проверок колонок в журнеях нет.
Как избежать: брать у генератора только `pages/*.gen.js`; `testsuite.qunit.*`, `Test.qunit.html`, `opaTests.qunit.js` писать по Test Starter (журнеи экспортируют функции, `runner.run([...])` один раз); интент передавать в `iStartMyApp('products-display', { 'sap-ui-language': 'ru' })`.

## 2026-09-07. Teardown OPA-журнея должен быть отдельным последним `opaTest`

Что: `Given.iTearDownMyApp()` в конце последнего содержательного теста не выполняется, если тест упал раньше (OPA останавливает очередь), и следующий журней падает с «sap.ui.test.launchers.iFrameLauncher: Launch was called twice without teardown», превращая одну ошибку в каскад. У `sap.fe.test.BaseArrangements#iTearDownMyApp` есть `.description('Tearing down my app')`, то есть свой assertion, поэтому отдельный `opaTest('Teardown', function (Given) { Given.iTearDownMyApp(); })` (шаблон Fiori tools) не даёт «Expected at least one assertion».
Как избежать: в каждом журнее последний тест только teardown; данные, изменённые журнеем, восстанавливать до него.

## 2026-09-07. `npm run watch` (`cds-serve --watch`) падает, `npx cds watch` работает

Что: `cds-serve --watch` из `@sap/cds` 10.0.6 упал с `TypeError: this.load is not a function` (`bin/serve.js:333`), хотя `@sap/cds-dk` стоит локально; `npx cds watch` (cds-dk 10.0.7) поднимает сервер. Замечено `test-ui` при запуске живого стека для OPA.
Исправлено в коммите `ce05c8a`: `npm run watch` теперь `cds watch`; `npm start` остаётся `cds-serve` по документации CAP (работает без cds-dk).

## 2026-09-07. Ссылка на ассоциацию в `UI.DataField.Value` не переписывается на внешний ключ

Что: в `app/products/annotations/Products.cds` после перевода `category` на `Association to Categories` записи `{ $Type: 'UI.DataField', Value: category }` и `UI.SelectionFields: [ category ]` компилировались без предупреждений, но в EDMX давали `Path="category"` и `<PropertyPath>category</PropertyPath>`, то есть путь на NavigationProperty, а не на свойство; Fiori Elements ожидает в DataField путь на свойство. Аннотации самого элемента (`@title`, `@Common.Text`, `@Common.ValueListWithFixedValues`) компилятор с ассоциации на `category_code` копирует, а пути внутри `@UI.*` не трогает. Замечено агентом `fiori-app-dev` на базовой компиляции перед шагом 9 фичи `categories-code-list`.
Как избежать: в `@UI.LineItem`, `SelectionFields`, `HeaderInfo`, `FieldGroup` ссылаться на внешний ключ `<assoc>_<key>` (как в `templates/annotations-ui.cds`), а `@Common.Text`, `TextArrangement`, `ValueListWithFixedValues` ставить на ассоциацию. Проверка: `cds compile '*' --to edmx-v4 -s CatalogService | grep -n 'Path="category'` не должен показывать голый `Path="category"` вне `NavigationPropertyBinding`.

## 2026-09-07. Явный `@Common.ValueList` на ассоциации подавляет ValueList, сгенерированный из CodeList

Что: после перевода `Products.category` на `Association to Categories : CodeList` снапшот `$metadata` (`cds.load('*')`, то есть с `app/`) показал на `category_code` старый `Common.ValueList` с `CollectionPath="Products"` из `app/products/annotations/Products.cds`, а сгенерированного `CollectionPath="Categories"` не было. `cds compile srv --to edmx-v4` (без `app/`) показывает сгенерированный. Компилятор не генерирует ValueList из `@cds.odata.valuelist`, если на элементе уже есть явный `@Common.ValueList`, и явная аннотация с ассоциации копируется на внешний ключ.
Как избежать: при переводе поля на CodeList удалять старый `@Common.ValueList` в `app/` в том же изменении; проверять `cds compile '*' --to edmx-v4 | grep -A 6 'Products/category_code'`, а не `cds compile srv`. Второй позиционный аргумент CLI (`cds compile srv app`) игнорируется, слои объединяет только `'*'`.

## 2026-09-07. Ошибка `cds.test` (fetch) несёт `code` и `target` OData-ошибки

Что: `@cap-js/cds-test` 1.0.2 бросает `Object.assign(new Error, { response, status }, response.data.error)`: сообщение вида `400 - Provide the missing value.`, поля `code` (`ASSERT_MANDATORY`, `ASSERT_TARGET`, `ENTITY_IS_READ_ONLY`), `target` (`category_code`). `rejectedWith(/400/)` chai-as-promised резолвится в саму ошибку.
Как применять: `const err = await expect(POST(...)).to.be.rejectedWith(/400/); expect(err).to.containSubset({ code: 'ASSERT_TARGET', target: 'category_code' })`. Так негативный тест привязан к конкретной аннотации, а не к любому 400.

## 2026-09-07. Снимок metadata.xml нужно собирать из всей модели, а не из `srv`

Что: команда `cds compile srv --to edmx-v4` включает только `db` и `srv`, поэтому UI-аннотации из `app/products/annotations/` в снимок не попадали, и мок-режим показывал таблицу без колонок. Правильно: `cds compile '*' --to edmx-v4 -s CatalogService -l en`. То же относится к контрактному тесту: `cds.load('*')` берёт всю модель. Замечено агентом `test-backend` на первом прогоне фичи; команда исправлена в CLAUDE.md, PATTERNS, правилах и агентах.

## 2026-09-07. CAP MCP компилирует все `.cds` проекта, включая `templates/`

Что: `mcp__cds-mcp__search_model` падал с «Duplicate definition of artifact my.catalog.template.Orders»: четыре шаблона в `templates/*.cds` объявляли один namespace и одинаковые сущности. `cds compile srv` и тесты этого не видели, потому что берут только корни `db`, `srv`, `app`.
Как избежать: у каждого самостоятельного `.cds`-файла вне `db/srv/app` свой namespace (`my.catalog.tpl.<name>`). Проверка: `cds compile db srv app templates --to json` должна проходить.

## 2026-09-07. `run_manifest_validation` UI5 MCP 0.2.18 падает с ошибкой схемы

Что: инструмент возвращает «schema with key or id http://json-schema.org/draft-06/schema already exists» на любой вызов, повторно тоже. Дефект сервера, не manifest.
Как обойти: правила manifest проверяет `ui5lint` (`no-outdated-manifest-version`, `no-legacy-ui5-version-in-manifest`, `no-removed-manifest-property`, `no-deprecated-library`). Пока дефект не исправлен, после правки manifest достаточно `npm run lint` в `app/products`. Отслеживать через `release-check` по релизам `@ui5/mcp-server`.

## 2026-09-07. `ui5lint --fix` меняет `sap.ui.getCore().byId` на `Element.getElementById`

Что: автоисправление линтера заменило устаревший вызов в `Component.js` на `sap/ui/core/Element.getElementById` с добавлением зависимости в `sap.ui.define`. Поведение сохранено.
Как избежать: перед `--fix` фиксировать diff и проверять, что замена эквивалентна. Для новых файлов сразу использовать `Element.getElementById`.

## 2026-09-07. `sap.ui.core.util.MockServer` не поддерживает OData V4

Что: мок-режим на `MockServer` и Sinon не работал. Заменён на `@sap-ux/ui5-middleware-fe-mockserver` в `ui5-mock.yaml`.
Детали: мок ожидает файлы `<EntitySet>.json` с массивом записей в `mockdataPath`; `generateMockData: true` генерирует недостающие наборы (например `Currencies`). Свойство прокси называется `ignoreCertErrors`, во множественном числе.

## 2026-09-07. Middleware в `ui5.yaml` без установленного пакета ломает `fiori run`

Что: `ui5.yaml` ссылался на `sap-fe-mockserver`, пакет не был в devDependencies и в `ui5.dependencies`. Правило: middleware добавляется вместе с пакетом в `devDependencies` и в `package.json` → `ui5.dependencies`.

## 2026-09-07. Титулы элементов живут на проекции, а не на db-сущности

Что: по конвенции `@title` ставится в `srv/annotations/<Entity>.cds` на `CatalogService.<Entity>`. Значит, инструменты, читающие `my.catalog.Products` напрямую, титулов не увидят; генератор реестра берёт их с первой проекции.

## 2026-09-07. `cds add lint` переформатирует `mta.yaml`

Что: команда переписала отступы в `mta.yaml` (без смысловых изменений). Проверять diff после любого `cds add`.

## 2026-09-07. Файл controller extension Fiori Elements без `.controller.`

Что: ссылка в manifest `ns.ext.controller.ListReportExt.onAction` требует файл `ext/controller/ListReportExt.js`, а не `ListReportExt.controller.js`, иначе `ModuleError`. Источник: SAP-samples/cap-agentic-engineered, LESSONS_LEARNED.

## 2026-09-07. Хак клавиатуры для кнопки Explore

Что: `Component.js` навешивает обработчик Enter/Space на кнопку шелла `uh-explore-button` через `setTimeout(1500)`. Хрупко: зависит от таймера и внутреннего id ushell. Штатная альтернатива для собственных кнопок: `sap.ui.core.CommandExecution` и `sap.m.Button` с `ariaHasPopup`. Для кнопок шелла sandbox штатного способа нет; решение автора сохраняется.
