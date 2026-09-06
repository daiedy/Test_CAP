# ADR-0002: Vitest и @cap-js/cds-test для тестов бэкенда, снапшот $metadata как контракт

Дата: 2026-09-07. Статус: принято.

## Контекст
Тестов в проекте не было. capire с апреля 2026 называет Vitest основным раннером для `cds.test` и объявляет о постепенном отказе от Jest. Изменения контракта OData (новые поля, переименования) ломают Fiori-приложение молча, поэтому нужен контрактный тест.

## Решение
`@cap-js/cds-test` ^1 с Vitest ^5. Тесты сервисов в `test/<service>.test.js`, in-memory SQLite, данные из `db/data`. Контракт: `test/metadata.test.js` компилирует `CatalogService` в EDMX V4 через `cds.compile.to.edmx` и сравнивает со снапшотом Vitest. Снапшот обновляется только `npx vitest -u` с записью в `docs/CHANGELOG.md`. Команда `npm test` запускается Stop-хуком и в CI.

## Альтернативы
| Вариант | Почему отклонён |
|---|---|
| Jest | SAP объявила о снятии поддержки в `cds.test`; проблемы с ESM |
| `node --test` через `cds test` | Меньше практики в сообществе, нет снапшотов из коробки |
| Сравнение всего ответа `$metadata` по HTTP | capire советует проверять существенное; компиляция детерминированнее и быстрее |

## Последствия
- `import.meta.dirname` (Node 22) для указания корня проекта в `cds.test`.
- Все тесты в одном процессе: `cds.test()` первым вызовом, никаких runner-специфичных мок-функций.
- Покрытие через `@vitest/coverage-v8`.

## Источники
- https://cap.cloud.sap/docs/node.js/cds-test
- https://cap.cloud.sap/docs/releases/2026/apr26
- https://cap.cloud.sap/docs/releases/2026/jun26
