# Каталог паттернов: одна задача, один способ

Для каждой повторяющейся задачи здесь ровно один утверждённый способ. Агент, встретив задачу из таблицы, использует указанный способ и пример. Если способ не подходит, работа останавливается и создаётся ADR, а не второй способ. Ссылки на примеры указывают на текущий код; реестр в `docs/registry/` показывает, что уже существует.

## Модель данных

| Задача | Способ | Пример | Решение |
|---|---|---|---|
| Новая сущность | `entity X : cuid, managed { ... }` в `db/schema.cds`; проекция в сервисе; labels в `srv/annotations/X.cds`; UI в `app/<app>/annotations/X.cds`; данные `cds add data --filter X --records N`; тест `test/<service>.test.js` | `db/schema.cds` → `Products` | ADR-0003 |
| Справочник с выбором из списка | Сущность `: sap.common.CodeList` с ключом `code`, ассоциация из основной сущности, `@Common.ValueList` и `@Common.Text` в UI-аннотациях | паттерн `Currency` из `@sap/cds/common` | ADR-0003 |
| Внутренний статус без выбора пользователем | `enum` в типе элемента, значения UPPER_SNAKE | нет в коде | |
| Денежная сумма | `Decimal(15, 2)` + `currency : Currency` + `@Measures.ISOCurrency: currency_code` | `Products.price` (историческое `Decimal(10, 2)`) | |
| Вычисляемое значение | Calculated element `total : Decimal = price * quantity` в схеме; `virtual` + `after READ` только если выражение невозможно в SQL | нет в коде | |
| Связь родитель–дети (документ) | `Composition of many Items on items.parent = $self` в родителе, `parent : Association to Parent` в детях | нет в коде | |
| Ссылка на другую сущность | `Association to Target` в единственном числе | `Products.currency` | |
| Переводимые тексты данных | `localized String(N)`, CSV `<Entity>.texts` | нет в коде | |

## Сервис и логика

| Задача | Способ | Пример | Решение |
|---|---|---|---|
| Обязательное поле | `@mandatory` в `srv/annotations/<Entity>.cds` | `srv/annotations/Products.cds` | ADR-0004 |
| Проверка формата или диапазона | `@assert.format`, `@assert.range` в `srv/annotations/<Entity>.cds`; хендлер `before` только если аннотацией не выразить | `Products.stock @assert.range: [0, 1000000]` | ADR-0004 |
| Проверка существования цели ассоциации | `@assert.target` | | |
| Только чтение | `@readonly` на проекции в сервисе | | |
| Авторизация | `@requires: 'authenticated-user'` на сервисе, `@restrict` на сущности; мок-пользователи в `package.json` → `cds.requires.auth.users` | `srv/catalog-service.cds` | |
| Действие над одной записью | Bound action в проекции: `actions { action reorder(amount: Integer) }`; хендлер `this.on('reorder', 'Products', ...)`; в UI `DataFieldForAction` | нет в коде, шаблон `templates/service.cds` | |
| Действие над набором или без контекста | Unbound `action` в сервисе, только если bound невозможен | | |
| Ошибка бизнес-логики | `req.reject(400, 'KEY', [args])`, ключ в `_i18n/messages.properties` | `templates/handler.js` | |
| Логирование | `const LOG = cds.log('catalog')`; `LOG.info`, `LOG.warn`, `LOG.error` | `templates/handler.js` | |
| Общая функция для нескольких хендлеров | `srv/lib/<topic>.js`, именованный экспорт, JSDoc, unit-тест; перед созданием проверить `docs/registry/REUSE-CATALOG.md` | | |
| Черновики (draft) | `@odata.draft.enabled` только на корневой проекции приложения FE, которое редактирует данные; никогда одновременно на родителе и детях композиции | | |
| Побочный эффект после записи | `this.after('CREATE', 'Entity', ...)` или событие `srv.emit`; без ручных транзакций | | |

## UI Fiori Elements

| Задача | Способ | Пример | Решение |
|---|---|---|---|
| Новое приложение | Fiori MCP `generate_fiori_app_cap`; никогда вручную | `app/products` | ADR-0007 |
| Колонки таблицы, фильтры, шапка, секции | `@UI.LineItem`, `@UI.SelectionFields`, `@UI.HeaderInfo`, `@UI.Facets` + `@UI.FieldGroup` в `app/<app>/annotations/<Entity>.cds` | `app/products/annotations/Products.cds` | ADR-0004 |
| Выбор значения из справочника | `@Common.ValueList` с `CollectionPath` на CodeList, `@Common.Text` + `@Common.TextArrangement: #TextOnly`, чтобы не показывать UUID | `Products.currency_code` | |
| Кнопка действия | `DataFieldForAction` в LineItem или Identification на bound action; controller extension только для чисто клиентского поведения | | |
| Изменение manifest (FCL, initialLoad, страницы) | Fiori MCP `list_functionality` → `get_functionality_details` → `execute_functionality`; затем `run_manifest_validation` | `app/products/webapp/manifest.json` | ADR-0007 |
| Кастомная секция или колонка | `ext/fragment/<Name>.fragment.xml` + `controlConfiguration` через Fiori MCP | | |
| Клиентская логика | `ext/controller/<Page>Ext.js` (без `.controller.`), регистрация через Fiori MCP | | |
| Форматирование значения | `model/formatter.js`, в XML через `core:require` | | |
| Тексты | `webapp/i18n/i18n.properties` + `i18n_ru.properties`, ключи `<page>.<element>.<property>` | `webapp/i18n/` | |

## UI свободный UI5

| Задача | Способ | Пример | Решение |
|---|---|---|---|
| Новое приложение | UI5 MCP `create_ui5_app` внутри `app/`, JavaScript | | ADR-0005 |
| Любой контрол | Сначала `get_api_reference` UI5 MCP, затем скилл `ui5-best-practices` | | |
| Таблица | Матрица выбора из скилла `ui5-best-practices-tables`: `sap.m.Table` для ≤ 100 строк, `sap.ui.mdc.Table` для OData V4 с p13n | | |
| Доступность | Чеклист `ui5-best-practices-accessibility` перед ревью | | |

## Тесты

| Задача | Способ | Пример | Решение |
|---|---|---|---|
| Тест сервиса | `test/<service>.test.js`, `cds.test(import.meta.dirname + '/..')`, HTTP через `GET/POST`, проверки `expect(...).to...` | `test/catalog-service.test.js` | ADR-0002 |
| Контракт OData | `test/metadata.test.js` со снапшотом edmx | `test/metadata.test.js` | ADR-0002 |
| Форматтер или extension | QUnit в `webapp/test/unit/` | | |
| Сценарий пользователя | OPA5-журней в `webapp/test/integration/`, страницы на `sap.fe.test.*` | | |
| Сквозной сценарий | wdi5 против `cds watch`, минимум сценариев | | |

## Инфраструктура

| Задача | Способ | Пример | Решение |
|---|---|---|---|
| Запуск для разработки | `npm run watch` в корне, UI на http://localhost:4004/products/webapp/test/flpSandbox.html | | |
| UI без бэкенда | `npm run start-mock` в `app/products`, мок из `localService` | `app/products/ui5-mock.yaml` | ADR-0008 |
| Обновление снимка metadata.xml | `cds compile srv --to edmx-v4 > app/products/webapp/localService/metadata.xml` после любого изменения модели | | |
| Обновление зависимостей | Только через `release-check` и Renovate, версии MCP закреплены | | ADR-0009 |
| Деплой | Не настроен; `mta.yaml` черновик. Любая работа по деплою начинается с ADR | | |
