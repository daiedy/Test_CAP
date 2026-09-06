---
paths:
  - "srv/**/*.js"
---
# Хендлеры и библиотеки (srv/*.js, srv/lib/*.js)

## Перед правкой
1. Убедиться, что задача не решается аннотацией: PATTERNS «Обязательное поле», «Проверка формата или диапазона», «Только чтение», «Авторизация». Хендлер только когда аннотацией не выразить.
2. `mcp__cds-mcp__search_model` по сущности и событию, `mcp__cds-mcp__search_docs` по API (`req.reject`, `srv.before`, `cds.ql`, `cds.log`).
3. `docs/registry/HANDLERS.md`: нет ли уже обработчика этого события. Один обработчик на событие и сущность.
4. `docs/registry/REUSE-CATALOG.md`: нужная функция может уже лежать в `srv/lib/`.

## Правила
- ESM. `import cds from '@sap/cds'`. Класс `export default class <Service> extends cds.ApplicationService`, вся регистрация в `async init()`, в конце `return super.init()`.
- Порядок в `init()`: `before` → `on` → `after`.
- Ошибки: `req.reject(<status>, '<MESSAGE_KEY>', [args])`, ключ в `_i18n/messages.properties` и `_i18n/messages_ru.properties`.
- Логи: `const LOG = cds.log('<module>')` на уровне модуля. `console.*` запрещён.
- Запросы только через `cds.ql`. Никаких ручных транзакций, `cds.tx()` не открывать вручную.
- Общий код: `srv/lib/<topic>.js`, именованные экспорты, JSDoc, без обращения к `req`.
- Шаблоны: `templates/handler.js`, `templates/lib.js`.

## После правки
- `npx prettier --write <file>`, `npx eslint <file>`.
- Тест на каждый хендлер в `test/<service>.test.js`, запуск `npm test`, вывод в отчёт.
- `npm run docs:registry`.

## Запрещено
- Дублировать то, что делает generic service provider (CRUD, `@mandatory`, `@assert`).
- Хардкод строк, URL, учётных данных, ID тенантов.
- `await` внутри `cds.on('served', ...)` без обработки ошибок; `process.chdir`.
