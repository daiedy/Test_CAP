# ADR-0007: Fiori Elements V4 по умолчанию; приложения и manifest только через Fiori MCP

Дата: 2026-09-07. Статус: принято.

## Контекст
Типичные ошибки агентов в UI: ручная сборка структуры Fiori-приложения, битые ссылки на модули в `manifest.json`, правки через персонализацию. SAP поставляет `@sap-ux/fiori-mcp-server` с генерацией приложений в CAP-проекте и трёхшаговой модификацией (`list_functionality`, `get_functionality_details`, `execute_functionality`).

## Решение
- Экраны реализуются на Fiori Elements V4 (List Report, Object Page, при необходимости другие floorplans). Свободный UI5 только когда экран не выражается floorplan-ами, решение фиксируется в `docs/features/<name>/CONTEXT.md`.
- Новые приложения создаёт только `generate_fiori_app_cap`. `manifest.json` меняется только через `execute_functionality`; ручная правка допустима при отсутствии функции с последующей `run_manifest_validation`.
- Поведение задаётся аннотациями; controller extensions только для чисто клиентской логики.

## Альтернативы
| Вариант | Почему отклонён |
|---|---|
| Ручная правка manifest по документации | Главный источник ошибок агентов по публикациям SAP и сообщества |
| Свободный UI5 как основа | Больше кода, тестов и линтера; FE даёт стандартное поведение бесплатно |
| Fiori Elements V2 | Проект на OData V4, V2 не рассматривается |

## Последствия
- Правило `.claude/rules/ui5-webapp.md`, паттерны раздела «UI Fiori Elements».
- Агент `fiori-app-dev` получает инструменты `mcp__fiori-mcp__*`.

## Источники
- https://github.com/SAP/open-ux-tools/tree/main/packages/fiori-mcp-server
- https://architecture.learning.sap.com/news/2026/04/27/agentic-engineering
- https://community.sap.com/t5/sap-cap-blog-posts/from-zero-to-fiori-building-sap-apps-with-ai-agents-and-why-i-use-markdown/ba-p/14288142
