# Конвенции кода и файлов

Единственный источник правил о том, как выглядят файлы в этом репозитории. Правила по путям в `.claude/rules/` ссылаются сюда и не должны противоречить этому документу. Отклонение допустимо только через новый ADR в `docs/decisions/`.

## 1. Языки

| Что | Язык |
|---|---|
| Идентификаторы в CDS, JS, XML, ключи i18n | английский |
| Комментарии в коде, сообщения коммитов | английский |
| Документация в `docs/`, CLAUDE.md, правила и скиллы для агентов | русский, технические термины на английском |
| Тексты для пользователя | только через i18n: `en` по умолчанию, `ru` перевод |

## 2. Структура репозитория

```
db/schema.cds                     доменная модель, namespace my.catalog
db/common.cds                     общие типы и аспекты проекта (создаётся при первой надобности)
db/data/<namespace>-<Entity>.csv  тестовые данные, генерируются `cds add data --records N`
srv/<name>-service.cds            сервис: проекции, действия, функции, @requires/@restrict
srv/<name>-service.js             хендлеры того же сервиса, класс extends cds.ApplicationService
srv/annotations/<Entity>.cds      семантические аннотации сущности: @title, @mandatory, @assert.*, @readonly
srv/lib/<topic>.js                переиспользуемая логика без зависимости от req/res
_i18n/i18n.properties             тексты бэкенда (labels), _i18n/i18n_ru.properties перевод
_i18n/messages.properties         сообщения ошибок req.reject, _i18n/messages_ru.properties
app/<app>/annotations.cds         точка входа UI-аннотаций приложения, только `using from`
app/<app>/annotations/<Entity>.cds  UI-аннотации: @UI.*, @Common.ValueList, @Common.Text
app/<app>/webapp/manifest.json    только через Fiori MCP или Fiori tools
app/<app>/webapp/ext/controller/<Page>Ext.js   controller extensions FE, без .controller. в имени
app/<app>/webapp/ext/fragment/<Name>.fragment.xml
app/<app>/webapp/model/formatter.js
app/<app>/webapp/i18n/i18n.properties, i18n_ru.properties
app/<app>/webapp/test/            testsuite.qunit.*, unit/, integration/ (OPA5)
app/<app>/webapp/localService/    metadata.xml (снимок), mockdata/<EntitySet>.json (массив)
test/<service>.test.js            тесты бэкенда на @cap-js/cds-test и Vitest
test/__snapshots__/               снапшоты $metadata
templates/                        эталонные файлы каждого типа
scripts/                          скрипты конвейера (ESM, Node 22)
docs/                             документация, см. ARCHITECTURE.md
```

Правило разделения аннотаций: всё, что описывает смысл данных и валидацию (labels, mandatory, assert, readonly, restrict), лежит в `srv/annotations/`. Всё, что описывает представление (LineItem, Facets, FieldGroups, HeaderInfo, SelectionFields, ValueList, Text) лежит в `app/<app>/annotations/`. В файлах сервисов и в `db/schema.cds` аннотаций UI нет.

## 3. CDS

- Отступ 2 пробела, один элемент на строку, аннотации выровнены по `@`.
- `namespace my.catalog;` в `db/schema.cds`. Новые модули домена получают под-namespace `my.catalog.<module>` в отдельном файле `db/<module>.cds`.
- Сущности: PascalCase, во множественном числе (`Products`, `Categories`). Типы и аспекты: PascalCase в единственном числе. Элементы: camelCase.
- Ключ: `cuid` (`key ID : UUID`). Составные ключи только для текстовых и кодовых таблиц.
- Аудит: аспект `managed`. Временные интервалы: `temporal`.
- Ассоциации: `Association to Target` с именем в единственном числе (`category`), внешний ключ автоматически `category_ID`. Композиции: `Composition of many Items` с именем во множественном числе.
- Справочники для пользователя: сущность на основе `sap.common.CodeList` с ключом `code`, не `enum`. `enum` только для внутренних статусов, которые не редактирует пользователь.
- Деньги: `Decimal(15, 2)` плюс `currency : Currency` и `@Measures.ISOCurrency: currency_code` в аннотациях. Существующее `price : Decimal(10, 2)` сохраняется до отдельного ADR.
- Строки всегда с длиной: `String(100)`. Локализуемые тексты: `localized String(255)`.
- У каждого элемента `@title: '{i18n>Entity.element}'` в `srv/annotations/<Entity>.cds`, не в схеме.
- Сервис: `service CatalogService @(path: '/catalog')` не задаётся, путь по умолчанию `/odata/v4/<service>`. Одна проекция на сущность; выставлять только нужные поля через `excluding` или явный список.
- Никаких `cds add sample`. Данные только `cds add data --records <N>` с последующей правкой значений.

## 4. JavaScript бэкенда

- ESM (`"type": "module"` в package.json). Импорт: `import cds from '@sap/cds'`.
- Хендлеры в классе: `export default class CatalogService extends cds.ApplicationService { async init() { ...; return super.init() } }`.
- Порядок в `init()`: `before` валидации, затем `on` действий, затем `after` побочных эффектов. Один обработчик на событие и сущность.
- Ошибки: `req.reject(400, 'PRODUCT_STOCK_NEGATIVE', [args])`. Ключ сообщения в `_i18n/messages.properties`. Никаких строк в коде.
- Логирование: `const LOG = cds.log('catalog')` на уровне модуля. `console.*` запрещён.
- Запросы к БД через `cds.ql` (`SELECT`, `INSERT`, `UPDATE`, `DELETE`), никакого raw SQL и ручных транзакций.
- Общий код в `srv/lib/<topic>.js` с именованными экспортами и JSDoc на каждой экспортируемой функции.
- Форматирование: Prettier, конфиг `.prettierrc` в корне. Стиль: 2 пробела, одинарные кавычки, точка с запятой, ширина 100.

## 5. UI

- Fiori Elements V4 по умолчанию. Свободный UI5 только когда экран нельзя выразить floorplan-ами, решение фиксируется в спецификации фичи.
- Новое приложение создаётся только через Fiori MCP `generate_fiori_app_cap`. Правки `manifest.json` только через `list_functionality` → `execute_functionality`; ручная правка допустима лишь при отсутствии подходящей функции, после неё обязательна `run_manifest_validation`.
- JavaScript, не TypeScript (ADR-0005). Пересмотр при первом свободном UI5-приложении.
- Только XML-вью. Модули через `sap.ui.define`, без глобальных обращений (`sap.ui.getCore()`, `jQuery.sap.*` запрещены). Загрузка асинхронная.
- Controller extension FE: файл `ext/controller/<Page>Ext.js`, без инфикса `.controller.`, иначе модуль не загрузится.
- Форматтеры в `model/formatter.js`, подключаются в XML через `core:require`.
- Все тексты через `i18n`. Ключи: `<page>.<element>.<property>` для UI, `<Entity>.<element>` для labels модели.
- `ui5lint` без ошибок для каждого изменённого файла. Известный долг (CSP inline scripts в тестовых html) зафиксирован в `docs/STATE.md`.
- Версия UI5 в manifest `minUI5Version` 1.136.0; на CDN используется актуальная версия без фиксации (ADR-0006).

## 6. Тесты

- Бэкенд: `test/<service>.test.js`, Vitest, `const { GET, POST, expect, defaults } = cds.test(import.meta.dirname + '/..')` первой строкой после импорта cds. Один `describe` на сущность или действие. Данные для тестов из `db/data`.
- Снапшот контракта: `test/metadata.test.js` сравнивает EDMX объединённой модели (`cds.load('*')`, эквивалент `cds compile '*' --to edmx-v4 -s CatalogService`) со снапшотом. Меняется осознанно через `vitest -u` с записью в CHANGELOG.
- UI: QUnit для форматтеров и extensions в `webapp/test/unit/`, OPA5-журнеи в `webapp/test/integration/`, Test Starter обязателен.
- Имя теста описывает поведение: `rejects negative stock`, а не `test1`.

## 7. Git

- Ветка `feature/<kebab-name>`, одна фича. Коммиты в стиле conventional commits: `feat(srv): add Categories code list`. Области: `db`, `srv`, `app`, `test`, `docs`, `pipeline`, `deps`.
- Один коммит на фазу рабочего потока фичи. Никакого `git add -A`; только файлы фазы.
- Не коммитятся: `node_modules/`, `gen/`, `dist/`, `*.sqlite*`, `.claude/settings.local.json`, `.env`.

## 8. Документация

- Каждое изменение кода сопровождается: обновлённым реестром (`npm run docs:registry`), записью в `docs/CHANGELOG.md`, актуальным `docs/STATE.md`.
- Новый паттерн или отклонение от существующего: ADR по шаблону `docs/decisions/ADR-0000-template.md`.
- Выученный урок (ошибка агента или неочевидное поведение фреймворка): запись в `docs/LESSONS.md` с датой и ссылкой на источник.
