# ADR-0008: Мок-сервер @sap-ux/ui5-middleware-fe-mockserver вместо sap.ui.core.util.MockServer

Дата: 2026-09-07. Статус: принято.

## Контекст
Режим без бэкенда был реализован на `sap.ui.core.util.MockServer`, который не поддерживает OData V4, и не работал. В `ui5.yaml` был объявлен middleware `sap-fe-mockserver` без установленного пакета и с неверным путём к данным, из-за чего `npm start` падал и перехватывал `/odata`.

## Решение
- Пакет `@sap-ux/ui5-middleware-fe-mockserver` ^2 в devDependencies и `ui5.dependencies`.
- Отдельный `app/products/ui5-mock.yaml` с мок-сервером (`generateMockData: true`, данные из `webapp/localService/mockdata/<EntitySet>.json` как массивы). `ui5.yaml` содержит только прокси на `:4004`.
- Скрипты: `npm start` (прокси), `npm run start-mock` (мок). Файлы `mockserver.js`, `initMockServer.js`, `mockServer.html`, `ui5-local.yaml` удалены.
- Снимок `metadata.xml` регенерируется командой `cds compile srv --to edmx-v4`.

## Альтернативы
| Вариант | Почему отклонён |
|---|---|
| Дописать Sinon fake server | Собственная реализация OData V4 ($filter, $expand, $count) не окупается |
| Только реальный бэкенд | `cds watch` быстрый, но мок нужен для OPA5-журнеев и офлайна |

## Последствия
- Мок-данные поддерживаются вручную; правило `data.md` требует обновлять их вместе с CSV, если они должны совпадать.
- Проверено 2026-09-07: `$metadata`, `Products`, автогенерация `Currencies`, FLP-страница в мок-режиме отвечают 200.

## Источники
- https://github.com/SAP/open-ux-odata/tree/main/packages/ui5-middleware-fe-mockserver
- https://github.com/SAP/open-ux-odata/blob/main/docs/DefiningMockdata.md
