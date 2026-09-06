# ADR-0001: Node.js 22 и cds 10 как базовая платформа

Дата: 2026-09-07. Статус: принято.

## Контекст
Проект был на `@sap/cds` 8.9 при `@sap/cds-dk` 9.4, без установленного Node.js. cds 8 вышел из поддержки, а все актуальные инструменты SAP для агентной разработки (`@sap-ux/fiori-mcp-server`, `@cap-js/cds-test` 1.x, `@sap/cds-dk` 10) требуют Node ≥ 22. Мажорные версии CAP выходят раз в год, предыдущий мажор получает только критические исправления 12 месяцев.

## Решение
Node.js 22 LTS (Homebrew `node@22`), `@sap/cds` ^10, `@sap/cds-dk` ^10 глобально и в devDependencies, `@cap-js/sqlite` ^3. Проект переведён без `cds upgrade`, так как кастомного кода не было. Поле `engines.node: ">=22"` в package.json.

## Альтернативы
| Вариант | Почему отклонён |
|---|---|
| Остаться на cds 8 | Нет поддержки, инструменты SAP несовместимы, MCP-серверы ориентированы на cds 9+ |
| cds 9 | Через год повторный переход; cds-dk уже 10 |
| nvm вместо Homebrew | Лишний слой для одной версии; Homebrew уже установлен |

## Последствия
- Драйвер SQLite по умолчанию `node:sqlite`; предупреждение ExperimentalWarning в логах допустимо.
- `cds.features.ieee754compatible: true`: Decimal и Int64 из SQLite приходят строками, тесты сравнивают строки (TESTING.md).
- Операции записи возвращают `{ affected }`; `srv.entities` это геттер.
- Обновления мажоров планируются на июнь каждого года через `release-check` и скилл `cap-upgrade`.

## Источники
- https://cap.cloud.sap/docs/releases/schedule
- https://cap.cloud.sap/docs/releases/migration/cds10
- https://cap.cloud.sap/docs/releases/2026/jun26
