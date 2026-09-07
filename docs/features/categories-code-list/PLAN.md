# Categories как справочник с value help: план

Дата: 2026-09-07. Статус: выполнен (2026-09-07, `docs-keeper`, шаг 17; ревью — «готово к коммиту» без блокирующих). Режим ворот: полуавтономный.

Контекст и исследование: `CONTEXT.md` в этом каталоге, включая раздел «Экраны» от `ux-designer`. Имя фичи `categories-code-list`, ветка `feature/categories-code-list`. Первый прогон конвейера `/feature`: фазы и коммиты по скиллу `feature`, отчёты агентов по протоколу, раздел 7. Решения пользователя от 2026-09-07 (переданы оркестратором) и дополнения дизайнера внесены; фаза 2 стартует по этой версии.

## Ключевые решения плана

| Вопрос | Решение | Обоснование |
|---|---|---|
| Имя и форма поля | `category : Association to Categories` в `Products`; внешний ключ `category_code : String(20)` генерирует компилятор | Паттерны «Справочник с выбором из списка» и «Ссылка на другую сущность»; имя `category` сохраняется, чтобы UI-аннотации и тесты менялись минимально. Контракт OData меняется осознанно: свойство `category` (Edm.String 50) заменяется на `category_code` (Edm.String 20) плюс NavigationProperty `category`; снапшот `test/__snapshots__/metadata.test.js.snap` обновляется через `npx vitest -u` с записью в CHANGELOG. Единственный потребитель контракта это `app/products` |
| Где живёт `Categories` | `db/schema.cds`, namespace `my.catalog` | Та же предметная область, отдельный модуль `db/<module>.cds` по CONVENTIONS нужен только новому домену |
| Экспозиция `Categories` | явная проекция `@readonly entity Categories as projection on catalog.Categories;` в `CatalogService` | Паттерн «Только чтение»; autoexposed-сущность нельзя аннотировать в `srv/annotations` (урок «Титулы живут на проекции»); одна проекция на сущность |
| Валидация | `@mandatory` остаётся, добавляется `@assert.target` на `category` | Паттерн «Проверка существования цели ассоциации»; хендлер не нужен |
| Коды справочника | `ACCESSORIES`, `ELECTRONICS`, `FURNITURE`, `KITCHEN`, `SPORTS`, `STATIONERY` (UPPER_SNAKE, `String(20)`) | ADR-0010, принято 2026-09-07 |
| Данные справочника | `db/data/my.catalog-Categories.csv` (`code;name`, en, строки в алфавитном порядке английских названий) и `db/data/my.catalog-Categories.texts.csv` (`code;locale;name`, только `ru`); `descr` не заполняется | Паттерн «Переводимые тексты данных», правило `data.md` (разделитель `;`). Файлы создаются `cds add data --filter Categories --records 6`, затем нормализуются: генератор пишет `,` и случайные локали (проверено в CONTEXT). Алфавитный порядок по требованию `ux-designer`: у сгенерированного ValueList нет сортировки, список приходит в порядке сервера |
| Существующие товары | В `my.catalog-Products.csv` колонка `category` переименовывается в `category_code`, значения заменяются кодами по таблице ниже; ID и остальные колонки не трогаются | Правило `data.md`: внешний ключ `<assoc>_<key>`, согласованность ссылок |
| Value help: источник | `Common.ValueList` руками не пишется: его генерирует компилятор из `@cds.odata.valuelist` аспекта CodeList (так уже работает `currency_code`). Старый блок ValueList с `CollectionPath: 'Products'` удаляется | ADR-0011 часть 1, принято 2026-09-07; проверено компиляцией (CONTEXT) |
| Value help: представление | На ассоциации `Products.category` в `app/products/annotations/Products.cds`: `Common.Text: category.name`, `Common.TextArrangement: #TextOnly`, `Common.ValueListWithFixedValues: true` (выпадающий список: в фильтре с множественным выбором, в форме с одиночным; без диалога) | ADR-0011 часть 2, принято 2026-09-07; обоснование дизайнера в CONTEXT «Решение по представлению» |
| Текст элементов списка | Новый файл `app/products/annotations/Categories.cds`: на `CatalogService.Categories.code` аннотации `Common.Text: name`, `Common.TextArrangement: #TextOnly`; строка `using from './annotations/Categories';` в `app/products/annotations.cds` | Обязательное дополнение `ux-designer`: у `sap.common.Currencies` `@Common.Text: name` стоит на `code` в самом определении из `@sap/cds/common`, аспект `CodeList` этого не даёт, поэтому без аннотации выпадающий список покажет `ELECTRONICS`, а не «Electronics». Зафиксировано в ADR-0011 |
| Где `category_code` в UI | `UI.SelectionFields`, `UI.LineItem`, `UI.HeaderInfo.Description`, `UI.FieldGroup#GeneralInfo`: везде `category` заменяется на `category_code` | Как в `templates/annotations-ui.cds`; TextOnly показывает название во всех местах |
| Подписи | `Products.category` = «Category» / «Категория» (есть); `Categories.code` = «Category» / «Категория»; `Categories.name` = «Category Name» / «Название категории»; `Categories.descr` = «Category Description» / «Описание категории» | Решение пользователя 5: над колонкой с названиями заголовок «Category Code» вводил бы в заблуждение |
| Страница справочника | не создаётся, `manifest.json` не меняется | Подтверждено `ux-designer`: справочник `@readonly`, ведётся через CSV; Fiori MCP `list_functionality`/`execute_functionality` не нужны |
| Мок-режим | `localService/metadata.xml` перегенерируется; добавляются `mockdata/Categories.json` (6) и `mockdata/Categories_texts.json` (6 записей `ru`); `mockdata/Products.json` переводится на `category_code` и синхронизируется с 15 записями CSV | Решение пользователя 4; паттерны «Обновление снимка metadata.xml», «UI без бэкенда»; закрывает долг STATE «мок-данные не синхронизированы» |
| Тесты бэкенда | `test/catalog-service.test.js`, `test/metadata.test.js`; к тесту локализации добавляется fallback (`Accept-Language: de` → английское название) | Паттерны «Тест сервиса», «Контракт OData»; дополнение `ux-designer` |
| Тесты UI | В этой фиче (шаг 13, `test-ui`): `@sap-ux/ui5-test-writer` и `ui5-test-runner` в devDependencies `app/products`, Test Starter, OPA5-журнеи на `sap.fe.test.ListReport`/`ObjectPage`, запуск `ui5-test-runner` против живого стека (`npm run watch` + `npm start`) | Решение пользователя 3; закрывает долг STATE «тестов UI нет». Мок-режим для журнеев не используется: `metadata.xml` собран с `-l en`, `sap-fe-mockserver` не учитывает `Accept-Language`, сценарий `ru` там непроверяем |
| Хендлеры | не добавляются | Всё выражено аннотациями и `localized` |

Таблица переноса значений `category` → `category_code` в `my.catalog-Products.csv` (порядок строк для `my.catalog-Categories.csv`):

| Было | Код | `name` (en) | `name` (ru) | Товары |
|---|---|---|---|---|
| Accessories | `ACCESSORIES` | Accessories | Аксессуары | Backpack, Smartphone Stand |
| Electronics | `ELECTRONICS` | Electronics | Электроника | Laptop Pro 15, Wireless Mouse, Bluetooth Speaker, Wireless Earbuds |
| Furniture | `FURNITURE` | Furniture | Мебель | Office Chair, Desk Lamp, Reading Lamp, Monitor Stand |
| Kitchen | `KITCHEN` | Kitchen | Кухня | Coffee Maker, Water Bottle, Kitchen Knife Set |
| Sports | `SPORTS` | Sports | Спорт | Yoga Mat |
| Stationery | `STATIONERY` | Stationery | Канцелярия | Notebook Set |

Ключи i18n (обе локали в одном изменении, `_i18n/i18n.properties` и `_i18n/i18n_ru.properties`):

| Ключ | en | ru |
|---|---|---|
| `Categories.code` | Category | Категория |
| `Categories.name` | Category Name | Название категории |
| `Categories.descr` | Category Description | Описание категории |

`Products.category` («Category» / «Категория») сохраняется и становится label внешнего ключа и `Label` сгенерированного ValueList. Новых ключей в `app/products/webapp/i18n/*` нет (подтверждено `ux-designer`).

## Критерии готовности

Бэкенд, проверяются `npm test` (`test/catalog-service.test.js`, если не указано иное):

- [x] `GET /odata/v4/catalog/Categories` возвращает ровно 6 записей с кодами `ACCESSORIES`, `ELECTRONICS`, `FURNITURE`, `KITCHEN`, `SPORTS`, `STATIONERY`; тест «lists the 6 seeded categories».
- [x] `GET /Categories?$filter=code eq 'KITCHEN'` с `Accept-Language: ru` возвращает `name` «Кухня», с `Accept-Language: en` «Kitchen», с `Accept-Language: de` (перевода нет) «Kitchen»; тест «returns localized category names with English fallback».
- [x] `GET /Products?$filter=category_code eq 'KITCHEN'&$select=name` возвращает Coffee Maker, Kitchen Knife Set, Water Bottle; тест «filters products by category code» (замена текущего «filters by category»).
- [x] `GET /Products?$filter=name eq 'Backpack'&$expand=category($select=code,name)` возвращает `category: { code: 'ACCESSORIES', name: 'Accessories' }`; тест «expands the category of a product».
- [x] `POST /Products` с `category_code: 'FURNITURE'` и обязательными полями отвечает 201 и возвращает `category_code`; тест «creates a product with the mandatory fields and fills managed fields» (обновление текущего).
- [x] `POST /Products` с `category_code: 'UNKNOWN'` отвечает 400 (`@assert.target`); тест «rejects an unknown category code».
- [x] `POST /Products` без `category_code` отвечает 400 (`@mandatory`); тест «rejects a product without a category».
- [x] `POST /Categories` отвечает 405 (`@readonly`); тест «does not allow creating categories».
- [x] Существующие тесты «lists the 15 seeded products», «returns price as a string», «rejects a product without a name», «rejects negative stock», «exposes Currencies» проходят без изменения смысла (в теле «rejects a product without a name» поле `category` заменяется на `category_code`).
- [x] `test/metadata.test.js`: снапшот EDMX обновлён осознанно и содержит `Property Name="category_code" ... MaxLength="20"`, `NavigationProperty Name="category"`, `EntitySet Name="Categories"`, `EntitySet Name="Categories_texts"`; на `Products/category_code` аннотации `Common.Text Path="category/name"` с `UI.TextArrangement TextOnly`, `Common.ValueListWithFixedValues Bool="true"` и ровно один `Common.ValueList` с `CollectionPath="Categories"`; на `Categories/code` `Common.Text Path="name"` с `UI.TextArrangement TextOnly`; на `EntityContainer/Categories` `Capabilities.InsertRestrictions/UpdateRestrictions/DeleteRestrictions`; свойства `category` типа Edm.String в `Products` больше нет. Тест «serves $metadata over HTTP with English labels» проходит.
- [x] `npm run lint` (cds lint) без ошибок; `npx prettier --check test/` чист.

UI, проверяются OPA5-журнеями (`test-ui`, шаг 13), `ui-verifier` (сценарии в `VERIFICATION.md` со скриншотами) и линтером:

- [x] List Report: фильтр «Category» это выпадающий список с множественным выбором из 6 названий, без диалога value help и без вкладки условий; после выбора «Kitchen» таблица содержит 3 товара, токен фильтра показывает название, не код; при выборе «Kitchen» и «Sports» 4 товара и два токена, запрос содержит `category_code eq 'KITCHEN' or category_code eq 'SPORTS'`. Подтверждено `ui-verifier` 2026-09-07, `VERIFICATION.md`.
- [x] List Report: колонка «Category» показывает названия («Electronics»), не коды. Подтверждено `ui-verifier` 2026-09-07.
- [x] Object Page: в шапке (Description) и в секции «General Information» показано название категории. Подтверждено `ui-verifier` 2026-09-07. Часть про режим редактирования **не подтверждена**: на Object Page нет кнопки «Edit» (`Products` без draft, ожидаемый риск PLAN/CONTEXT), выпадающий список формы и сохранение значения физически не проверяемы в этой фиче.
- [x] Локаль `ru` (`?sap-ui-language=ru`): в фильтре, элементах списка, колонке названия на русском («Электроника»), label «Категория». Подтверждено `ui-verifier` 2026-09-07 на List Report. Object Page на `ru` в этой сессии не открывался (сокращённый прогон), считать непроверенным для Object Page.
- [x] Элементы выпадающих списков фильтра нигде не показывают коды ни в `en`, ни в `ru` (подтверждено `ui-verifier`). Для формы Object Page недостижимо (нет Edit).
- [x] Клавиатурный сценарий (открытие списка, навигация стрелками, выбор Enter) проходит на List Report. На Object Page не проверен — нет режима редактирования.
- [x] Консоль браузера без ошибок, относящихся к фиче, на List Report и Object Page. Подтверждено `ui-verifier` 2026-09-07 (два постороних сообщения framework/infra, см. `VERIFICATION.md`).
- [ ] `npm run lint` в `app/products` (ui5lint) без ошибок, включая правило `prefer-test-starter` для новых тестовых страниц; `npm run start-mock` поднимается, List Report в мок-режиме показывает категории из `mockdata/Categories.json` (только `en`). Не перепроверялось `ui-verifier` в этой сессии (вне объёма браузерной верификации); зафиксировано ранее `fiori-app-dev`/`test-ui`.
- [x] OPA5-журнеи «filter products by category», «category is shown as a name», «edit category on the object page», «russian locale shows translated categories» проходят в `ui5-test-runner` против `npm run watch` + `npm start`; вывод раннера приложен к отчёту `test-ui` и к `VERIFICATION.md`. Выполнено 2026-09-07 (`test-ui`): три журнея проходят, «edit category on the object page» помечен `opaTest.skip` с причиной (сущность без draft, Object Page не показывает Edit; сценарий сохранён в файле); прогон против `npm run watch` на `:4004/products/webapp` (`npm start` на :8080 не поднимает приложение через FLP-интент, см. LESSONS); вывод раннера в отчёте `test-ui`, в `VERIFICATION.md` его переносит `ui-verifier`.

Документация:

- [ ] `npm run docs:registry` выполнен, `node scripts/check-docs-fresh.mjs` зелёный; `docs/registry/DOMAIN-MODEL.md` содержит `my.catalog.Categories`, `SERVICES.md` показывает проекцию `Categories` как readonly, `UI-ARTIFACTS.md` показывает тесты `webapp/test/integration`. Не закрыто полностью: колонка «Value help» у `Products` в `SERVICES.md` пуста — `scripts/gen-registry.mjs` компилирует модель через `cds.compile.for.nodejs` и видит только явный `@Common.ValueList`; по ADR-0011 он больше не пишется руками, а генерируется компилятором при OData/EDMX-компиляции (виден в `app/products/webapp/localService/metadata.xml`, EDMX-снапшоте контракта и в браузере, `VERIFICATION.md`). Правка генератора реестра — код, вне мандата `docs-keeper`; решение за `architect`/пользователем.
- [x] `docs/CHANGELOG.md`: строки по областям db, srv, app, test, deps, docs, включая явную запись об изменении контракта `category` → `category_code` и об установке `@sap-ux/ui5-test-writer`, `ui5-test-runner`.
- [x] `docs/STATE.md`: активная фича закрыта, ADR-0010/0011 в накопленных решениях; `docs/architecture/STACK.md` и `TESTING.md` отражают установленные инструменты UI-тестов.
- [x] `docs/features/categories-code-list/SUMMARY.md` и `VERIFICATION.md` заполнены; `PLAN.md` отмечен выполненным.
- [x] `docs/architecture/PATTERNS.md`: примеры в строках «Справочник с выбором из списка» (`Categories`), «Переводимые тексты данных» (`Categories.name`), «Проверка существования цели ассоциации» (`Products.category`), «Выбор значения из справочника» (`Products.category_code`, формулировка по ADR-0011), «Сценарий пользователя» (`webapp/test/integration/`) обновлены; `templates/annotations-ui.cds` приведён к ADR-0011.
- [x] `docs/decisions/ADR-0010`, `ADR-0011`: статус «принято» (сделано architect 2026-09-07); в ADR-0003 раздел «Последствия» пока не правится (указание оркестратора), отметка о выполнении делается в фазе документации по решению пользователя.

## Шаги

| # | Фаза | Агент | Файлы | Паттерн | Проверка |
|---|---|---|---|---|---|
| 1 | Исследование | `architect` | `CONTEXT.md`, `PLAN.md`, `docs/decisions/ADR-0010`, `ADR-0011` | | выполнено; план утверждён 2026-09-07 |
| 2 | Дизайн | `ux-designer` | `CONTEXT.md`, раздел «Экраны» | Выбор значения из справочника; гайдлайн «Value Help as a Dropdown» | выполнено; дополнения внесены в план (шаги 4, 7, 9, 10, 13, 15) |
| 3 | Бэкенд: модель | `cap-backend-dev` | `db/schema.cds` | Справочник с выбором из списка; Ссылка на другую сущность | `mcp__cds-mcp__search_model` по `Products`/`Categories` до правки, `search_docs` по CodeList; `cds compile db --to json` без ошибок; выполнено 2026-09-07 (`cap-backend-dev`) |
| 4 | Бэкенд: данные | `cap-backend-dev` | `db/data/my.catalog-Categories.csv`, `db/data/my.catalog-Categories.texts.csv`, `db/data/my.catalog-Products.csv` | Переводимые тексты данных; Новая сущность (`cds add data --filter Categories --records 6`, затем нормализация) | `cds deploy --to sqlite::memory:` без предупреждений CSV; 6 кодов в алфавитном порядке английских названий, 6 строк `ru`, разделитель `;`, 15 товаров с валидными `category_code`; выполнено 2026-09-07 (`cap-backend-dev`) |
| 5 | Бэкенд: сервис | `cap-backend-dev` | `srv/catalog-service.cds` | Только чтение; Новая сущность (проекция) | `cds compile srv --to json`: наборы `Categories`, `Categories_texts`; `npm run lint`; выполнено 2026-09-07 (`cap-backend-dev`) |
| 6 | Бэкенд: семантика и тексты | `cap-backend-dev` | `srv/annotations/Products.cds`, `srv/annotations/Categories.cds` (новый, по `templates/annotations-semantic.cds`), `_i18n/i18n.properties`, `_i18n/i18n_ru.properties` | Обязательное поле; Проверка существования цели ассоциации | `cds compile srv --to json` без предупреждений о ключах i18n; `npm run lint`; паритет ключей en/ru; выполнено 2026-09-07 (`cap-backend-dev`) |
| 7 | Бэкенд: тесты и контракт | `test-backend` | `test/catalog-service.test.js`, `test/metadata.test.js` (без изменений кода, только снапшот), `test/__snapshots__/metadata.test.js.snap`, строка в `docs/CHANGELOG.md` | Тест сервиса; Контракт OData | `npm test` зелёный, вывод в отчёт; снапшот обновлён `npx vitest -u` с записью причины; `npx prettier --write test/`. Примечание: аннотации `Categories/code` и `ValueListWithFixedValues` появятся в снапшоте только после шагов 9–10, поэтому снапшот обновляется дважды: здесь и в шаге 14; выполнено 2026-09-07 (`test-backend`), повторное обновление снапшота остаётся за шагом 14 |
| 8 | Ворота фазы 2 | оркестратор | | | `npm run lint`, `npm test`; коммит `feat(srv): categories code list with localized names` (файлы шагов 3–7) |
| 9 | UI: аннотации Products | `fiori-app-dev` | `app/products/annotations/Products.cds` | Выбор значения из справочника (ADR-0011); Колонки таблицы, фильтры, шапка, секции | `mcp__fiori-mcp__search_docs` по `Common.Text`, `TextArrangement`, `ValueListWithFixedValues` до правки; `cds compile '*' --to edmx-v4 -s CatalogService -l en`: на `Products/category_code` ровно один `Common.ValueList` с `CollectionPath="Categories"`, `Common.ValueListWithFixedValues Bool="true"`, `Common.Text Path="category/name"`; grep по `category` в `app/` не находит строкового поля; выполнено 2026-09-07 (`fiori-app-dev`) |
| 10 | UI: аннотации Categories | `fiori-app-dev` | `app/products/annotations/Categories.cds` (новый), `app/products/annotations.cds` | Выбор значения из справочника (ADR-0011, `Common.Text` на ключе справочника) | `cds compile '*' --to edmx-v4 -s CatalogService -l en`: на `Categories/code` `Common.Text Path="name"` с вложенным `UI.TextArrangement TextOnly`; никаких `@UI.*` для `Categories`; выполнено 2026-09-07 (`fiori-app-dev`) |
| 11 | UI: снимок и мок | `fiori-app-dev` | `app/products/webapp/localService/metadata.xml`, `localService/mockdata/Categories.json`, `Categories_texts.json`, `Products.json` | Обновление снимка metadata.xml; UI без бэкенда | `cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml`; `npm run start-mock` поднимается, `/odata/v4/catalog/Categories` в моке отдаёт 6 записей, `Products` 15; выполнено 2026-09-07 (`fiori-app-dev`) |
| 12 | UI: тексты | `fiori-app-dev` | `app/products/webapp/i18n/*` | Тексты | по решению `ux-designer` новых ключей нет; шаг пропускается с пометкой в отчёте; выполнено 2026-09-07 (`fiori-app-dev`): ключей в `webapp/i18n/*` не добавлено |
| 13 | Тесты UI | `test-ui` | `app/products/package.json` (devDependencies), `app/products/package-lock.json` (следствие установки), `app/products/webapp/test/testsuite.qunit.html`, `testsuite.qunit.js`, `webapp/test/integration/**` | Сценарий пользователя (OPA5 на `sap.fe.test.*`); правило `.claude/rules/tests-ui.md` | скиллы `ui5-best-practices-opa5`/`qunit` и `mcp__fiori-mcp__search_docs` («OPA5 Fiori elements», `JourneyRunner`) до правки; `npx ui5-test-runner --url http://localhost:8080/test/testsuite.qunit.html` при `npm run watch` (корень) и `npm start` (`app/products`), вывод в отчёт; `npm run lint` в `app/products` без ошибок; выполнено 2026-09-07 (`test-ui`): Test Starter (`testsuite.qunit.html/js`, `Test.qunit.html`), page objects из `@sap-ux/ui5-test-writer` (`pages/*.gen.js`), четыре журнея, «edit category» через `opaTest.skip` (у Object Page без draft нет кнопки Edit); прогон `ui5-test-runner` против `npm run watch` на `http://localhost:4004/products/webapp/test/testsuite.qunit.html`, потому что `fiori run` (:8080) не отдаёт `/products/webapp`, прописанный в `flpSandbox.html` (см. LESSONS); скрипт `npm run test:ui` |
| 14 | Ворота фазы 3 | оркестратор | | | `npm run lint` в `app/products` без ошибок; `npm test` в корне зелёный (снапшот metadata обновлён повторно после шагов 9–10, причина в CHANGELOG); коммит `feat(app): category dropdown value help and OPA5 journeys` (файлы шагов 9–13) |
| 15 | Верификация | `ui-verifier` | `docs/features/categories-code-list/VERIFICATION.md`, скриншоты | | критерии UI на `npm run watch` в `en` и `ru`, плюс сценарии `ux-designer` «сверх критериев» (элементы списка без кодов, «Kitchen»+«Sports», отсутствие диалога и вкладки условий, клавиатура, дерево доступности); первым проверяется наличие кнопки «Edit» на Object Page (риск non-draft); консоль без ошибок; вердикт «готово к ревью» |
| 16 | Ревью | `reviewer` | | | ноль блокирующих замечаний; отдельно проверить: нет хендлеров, ровно один ValueList на `category_code`, `@Common.*` только в `app/`, `@mandatory`/`@assert.target` только в `srv/annotations`, `category` нигде не остался строкой (grep по `db/`, `srv/`, `app/`, `test/`), в CSV разделитель `;` и только локаль `ru`, журнеи не ищут по тексту, а используют id и i18n |
| 17 | Документация | `docs-keeper` | `docs/registry/*` (генерация), `docs/CHANGELOG.md`, `docs/STATE.md`, `docs/architecture/STACK.md`, `TESTING.md`, `PATTERNS.md` (примеры и формулировка по ADR-0011), `templates/annotations-ui.cds` (по ADR-0011), `docs/features/categories-code-list/SUMMARY.md`, `docs/LESSONS.md` | | `node scripts/check-docs-fresh.mjs` зелёный; коммит `docs: categories-code-list summary and registry`. Правка `.claude/rules/ui-annotations.md` (следствие ADR-0011) только по отдельному запросу пользователя, файл защищён |

### Детали шагов для разработчиков

Шаг 3, `db/schema.cds`. Импорт расширяется до `using { cuid, managed, Currency, sap.common.CodeList } from '@sap/cds/common';`. Добавляется сущность с doc-комментарием, как у `Products`:

```cds
/** Product category, user-facing code list. Labels: srv/annotations/Categories.cds */
entity Categories : CodeList {
  key code : String(20);
}
```

В `Products` строка `category : String(50);` заменяется на `category : Association to Categories;`. Аннотаций в `db/` нет.

Шаг 4, данные. После `cds add data --filter Categories --records 6` оба файла приводятся к виду: разделитель `;`, только колонки `code;name` и `code;locale;name`, значения из таблицы переноса, строки в порядке таблицы (алфавит английских названий), в текстах только локаль `ru` (генератор создаёт случайные локали и `,`). В `my.catalog-Products.csv` заголовок `category` → `category_code`, значения по таблице переноса; порядок строк и ID сохраняются.

Шаг 5, `srv/catalog-service.cds`. В сервис добавляется `@readonly entity Categories as projection on catalog.Categories;` после `Products`; в конец файла `using from './annotations/Categories';`. Ничего другого в файле сервиса не появляется.

Шаг 6, семантика. `srv/annotations/Products.cds`: строка `category` получает `@assert.target` рядом с `@mandatory`, титул не меняется. Новый `srv/annotations/Categories.cds` содержит только `annotate CatalogService.Categories with { code @title: '{i18n>Categories.code}'; name @title: '{i18n>Categories.name}'; descr @title: '{i18n>Categories.descr}'; };`. Ключи i18n из таблицы выше в оба файла `_i18n`.

Шаг 7, тесты. Имена тестов и ожидания из критериев готовности. Запрос с локалью: `GET(url, { headers: { 'Accept-Language': 'ru' } })`; тот же тест делает три запроса (`ru`, `en`, `de`) и проверяет «Кухня», «Kitchen», «Kitchen». Изменение контракта в снапшоте фиксируется в CHANGELOG словами «`Products.category` (String 50) заменён на `category_code` (String 20) и навигацию `category`; добавлены наборы `Categories`, `Categories_texts`».

Шаг 9, UI-аннотации `Products`. В `app/products/annotations/Products.cds`: во всех четырёх местах (`HeaderInfo.Description`, `SelectionFields`, `LineItem`, `FieldGroup#GeneralInfo`) `category` → `category_code`; блок `annotate CatalogService.Products with { category @Common.ValueList: { CollectionPath: 'Products', ... } }` заменяется на

```cds
annotate CatalogService.Products with {
  // Category is a fixed code list: dropdown with localized names, never the code.
  // Common.ValueList is generated by the compiler from sap.common.CodeList (ADR-0011).
  category @(
    Common.Text                     : category.name,
    Common.TextArrangement          : #TextOnly,
    Common.ValueListWithFixedValues : true
  );
};
```

`FilterRestrictions`, `FilterDefaultValue`, `UI.Criticality` не добавляются (решение `ux-designer`).

Шаг 10, UI-аннотации `Categories`. Новый файл `app/products/annotations/Categories.cds` по `templates/annotations-ui.cds` (цель всегда проекция сервиса):

```cds
using { CatalogService } from '../../../srv/catalog-service';

// Presentation of the Categories code list in dropdowns and value help: localized name, never the code (ADR-0011).
annotate CatalogService.Categories with {
  code @(
    Common.Text            : name,
    Common.TextArrangement : #TextOnly
  );
};
```

В `app/products/annotations.cds` добавляется `using from './annotations/Categories';`. Других аннотаций (`@UI.*`) для `Categories` нет: страницы у справочника нет.

Шаг 11, мок. `Categories.json`: массив из 6 объектов `{ "code", "name", "descr": null }` в порядке таблицы переноса. `Categories_texts.json`: 6 объектов `{ "code", "locale": "ru", "name", "descr": null }`. `Products.json`: 15 объектов по CSV (ID, name, description, price строкой, currency_code, stock, category_code, imageUrl из CSV, managed-поля как сейчас).

Шаг 13, тесты UI. Установка в `app/products`: `npm i -D @sap-ux/ui5-test-writer ui5-test-runner` (решение пользователя 3; изменение `app/products/package-lock.json` это следствие явного запроса, версии фиксирует `docs-keeper` в STACK.md). Каркас генерируется `@sap-ux/ui5-test-writer` (Test Starter `webapp/test/testsuite.qunit.html` + `testsuite.qunit.js`, `webapp/test/integration/` с `opaTests.qunit.html`/`.js`, page objects на `sap.fe.test.ListReport` и `sap.fe.test.ObjectPage`, `JourneyRunner`); руками пишутся только журнеи:

| Журней | Шаги | Ожидание |
|---|---|---|
| filter products by category | List Report → фильтр «Category» → выбрать «Kitchen» → Go | 3 строки; токен с названием; затем добавить «Sports» → 4 строки |
| category is shown as a name | List Report → строка «Laptop Pro 15» → Object Page | колонка и Description шапки и поле «Category» показывают «Electronics» |
| edit category on the object page | Object Page → Edit → «Category» → выбрать «Furniture» → Save → вернуть «Electronics» → Save | после каждого сохранения поле и шапка показывают выбранное название; данные восстановлены в конце журнея |
| russian locale shows translated categories | запуск с `sap-ui-language=ru` → List Report | label «Категория», колонка «Электроника», элементы списка на русском |

Селекторы по id контролов и свойствам, тексты из i18n (правило `tests-ui.md`). Запуск: `npm run watch` в корне, `npm start` в `app/products`, затем `npx ui5-test-runner --url http://localhost:8080/test/testsuite.qunit.html`. npm-скрипт для запуска в этой фиче не добавляется: команда из правила единственная. Если журней «edit category» упирается в отсутствие кнопки «Edit» (риск non-draft), журней помечается `QUnit.skip` с комментарием и ссылкой на долг в STATE, остальные три обязательны.

## Решения, требующие ADR

Нет. ADR-0010 и ADR-0011 приняты пользователем 2026-09-07 (статусы обновлены). Следствия для `PATTERNS.md`, `CONVENTIONS.md`, `templates/annotations-ui.cds` выполняет `docs-keeper` в шаге 17; следствие для `.claude/rules/ui-annotations.md` требует отдельного запроса пользователя.

## Риски

| Риск | Как обнаружится | Что делать |
|---|---|---|
| Изменение контракта ломает клиента: `category` исчезает из OData | `test/metadata.test.js` покраснеет до `vitest -u`; `ui-verifier` увидит пустую колонку | Все упоминания `category` в `app/` заменяются в шаге 9; reviewer делает grep |
| Object Page без draft: доступность кнопки «Edit» в FE V4 для non-draft сущности не подтверждена MCP | шаг 15, первый сценарий; журней «edit category» в шаге 13 | Если кнопки нет, зафиксировать в VERIFICATION и STATE как долг, журней пометить `skip`; value help остаётся проверяемым в фильтре. Включение draft в этой фиче не делается (отдельная фича и ADR) |
| `ValueListWithFixedValues` с ассоциации не копируется на `category_code` | проверка EDMX в шаге 9 | Эксперимент в CONTEXT показал копирование (`Common.ValueListWithFixedValues Bool="true"` на `category_code`); если в проекте иначе, вопрос architect, а не аннотация FK вторым способом |
| Без `Common.Text` на `Categories.code` список показывает коды | шаг 15, сценарий «элементы списка без кодов»; журней «filter products by category» | Шаг 10 обязателен и идёт до снимка metadata (шаг 11) |
| `cds add data` пишет `,` и случайные локали | шаг 4, `cds deploy --to sqlite::memory:` и `npm test` | Нормализация по таблице переноса |
| `@assert.target` требует, чтобы цель была в том же сервисе | `npm test`: «rejects an unknown category code» не даст 400 | `Categories` экспонируется в `CatalogService` явно (шаг 5) |
| Мок-сервер сгенерирует случайные `Categories_texts` при `generateMockData: true` | `npm run start-mock`, запрос `/Categories_texts` | Файл `Categories_texts.json` кладётся в шаге 11 |
| Снапшот metadata меняется дважды (фаза 2 и фаза 3) | `npm test` красный после шагов 9–10 | Повторный `npx vitest -u` в шаге 14 с отдельной строкой CHANGELOG; reviewer сверяет diff снапшота с критериями |
| `ui5-test-runner` тянет браузер (puppeteer/Chromium), установка может быть долгой или заблокированной | шаг 13, `npm i -D` | `test-ui` фиксирует в отчёте; при невозможности установки останавливается и возвращает вопрос пользователю, тесты без запуска не считаются выполненными |
| Журнеи против живого стека меняют данные in-memory | журней «edit category» | Журней восстанавливает значение; `cds watch` пересоздаёт БД при перезапуске |
| Мок-режим не отражает `ru` и обновлённые labels | ожидаемо | Мок используется только для `npm run start-mock` и `en`; журнеи и верификация против `npm run watch` |
| Сортировка и группировка по колонке «Category» идут по коду, для `ru` не по алфавиту | шаг 15 | Известное ограничение (6 значений), фиксируется в VERIFICATION, не чинится |
| Хук PostToolUse помечает реестр устаревшим после каждой правки, Stop-хук требует `npm test` зелёным | сообщения хуков в сессиях агентов | `npm run docs:registry` выполняет `docs-keeper` в шаге 17; между фазами реестр может быть устаревшим, это ожидаемо |
| Локализованное чтение в тестах: `Accept-Language` должен доходить до `$user.locale` через `cds.test` | тест «returns localized category names with English fallback» | `cds.test` передаёт заголовки axios как есть; если тест красный, проверить `req.locale` через `search_docs`, не писать хендлер |
| Расхождение команд снимка metadata: PATTERNS без `-l en`, CLAUDE.md и `fiori-app-dev` с `-l en` | diff `metadata.xml` покажет ключи i18n вместо текстов | Использовать вариант с `-l en` (текущий снимок собран так); `docs-keeper` выравнивает PATTERNS |

## Решения пользователя (2026-09-07)

Переданы оркестратором после утверждения плана.

1. Коды справочника UPPER_SNAKE (`ELECTRONICS`, `FURNITURE`, `KITCHEN`, `STATIONERY`, `ACCESSORIES`, `SPORTS`), `String(20)`. ADR-0010 принят.
2. ValueList автогенерируется из CodeList, в `app/` только `Common.Text` + `TextArrangement`; представление `Common.ValueListWithFixedValues` (выпадающий список). ADR-0011 принят в обеих частях. Дополнение `ux-designer`: `Common.Text` + `TextArrangement` на `Categories.code` в `app/products/annotations/Categories.cds` (шаг 10).
3. Тесты UI входят в фичу: шаг 13 (`test-ui`) с установкой `@sap-ux/ui5-test-writer` и `ui5-test-runner`, Test Starter, OPA5-журнеями на `sap.fe.test.*`, запуском через `ui5-test-runner`. Критерий «OPA5-журнеи проходят в `ui5-test-runner`, вывод приложен» добавлен.
4. `mockdata/Products.json` синхронизируется с 15 записями CSV; добавляются `Categories.json` и `Categories_texts.json` (шаг 11).
5. Ключ `Categories.code` = «Category» / «Категория».

Дополнения `ux-designer`, принятые architect: алфавитный порядок строк `my.catalog-Categories.csv` и нормализация `.texts.csv` (шаг 4); тест fallback локали `Accept-Language: de` (шаг 7); уточнение критерия фильтра «выпадающий список с множественным выбором, без диалога»; проверки EDMX в шагах 9–10; сценарии верификации сверх критериев (шаг 15).

План утверждён 2026-09-07. Фаза 2 стартует по этой версии.
