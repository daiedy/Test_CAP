# ADR-0005: JavaScript для UI5, ESM для бэкенда, TypeScript отложен

Дата: 2026-09-07. Статус: принято, пересмотр при первом свободном UI5-приложении.

## Контекст
Существующее приложение `app/products` на JavaScript. SAP рекомендует TypeScript для новых UI5-приложений и даёт плагин конверсии. Бэкенд без кода; `cds init` в cds 10 создаёт ESM-проекты по умолчанию.

## Решение
- Бэкенд: ESM (`"type": "module"`), хендлеры как классы `extends cds.ApplicationService`, скрипты конвейера `.mjs`.
- UI: JavaScript с `sap.ui.define`, как в существующем приложении. Один язык на весь `app/`, чтобы правила, шаблоны и линтер были едины.
- TypeScript для UI пересматривается, когда появится первое свободное UI5-приложение (не Fiori Elements): тогда конверсия через плагин `ui5-typescript-conversion` и новый ADR.

## Альтернативы
| Вариант | Почему отклонён |
|---|---|
| TypeScript сразу | Fiori Elements приложение почти не содержит кода; конверсия существующего кода ради двух файлов не окупается |
| CommonJS на бэкенде | cds 10 и cds-test ориентированы на ESM; `import.meta.dirname` удобнее `__dirname` |

## Последствия
- `templates/handler.js`, `lib.js`, `service.test.js` в ESM.
- `eslint.config.mjs` от `cds add lint` работает без изменений.
- Шаблон `templates/handler.js` и правило `ui5-webapp.md` запрещают TypeScript до пересмотра.

## Источники
- https://cap.cloud.sap/docs/releases/2026/jun26
- https://github.com/UI5/plugins-coding-agents (ui5-typescript-conversion)
