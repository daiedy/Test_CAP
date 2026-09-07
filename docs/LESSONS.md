# Выученные уроки

Записи добавляют все агенты через скилл `retro` и человек. Формат: дата, что случилось, почему, как избежать, источник. Новые записи сверху. Список типовых ошибок агентов в CAP и Fiori из публикаций: `docs/ai-pipeline-plan.md`, раздел 3.4.

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
