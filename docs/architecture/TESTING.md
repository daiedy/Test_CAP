# Стратегия тестирования

## Уровни

| Уровень | Инструмент | Где | Когда запускается |
|---|---|---|---|
| Статика | `cds lint`, `ui5lint`, `prettier --check` | корень, `app/products` | PostToolUse-хук на каждом изменённом файле, CI |
| Контракт OData | Vitest снапшот EDMX объединённой модели (`cds compile '*' --to edmx-v4 -s CatalogService`) | `test/metadata.test.js` | `npm test`, Stop-хук, CI |
| Сервис | `@cap-js/cds-test` + Vitest, SQLite in-memory | `test/<service>.test.js` | `npm test`, Stop-хук, CI |
| Юнит UI | QUnit | `app/products/webapp/test/unit/` | `ui5-test-runner`, CI (этап 3) |
| Сценарии UI | OPA5-журнеи на `sap.fe.test` | `app/products/webapp/test/integration/` | `ui5-test-runner`, CI (этап 3) |
| Сквозные | wdi5 против `cds watch` | `app/products/webapp/test/e2e/` | по расписанию и перед релизом (этап 3) |

## Правила

1. Каждое изменение в `db/` или `srv/` сопровождается тестом сервиса или обновлением существующего. Каждое изменение контракта фиксируется обновлением снапшота командой `npx vitest -u` и строкой в `docs/CHANGELOG.md`.
2. Тесты используют данные из `db/data/*.csv`. Тест не создаёт данные, которые может взять из CSV.
3. `cds.test()` вызывается первым, до любых импортов подмодулей cds. Папка проекта передаётся явно: `cds.test(import.meta.dirname + '/..')`.
4. Проверяется поведение, а не полный ответ: `expect(data.value).to.containSubset([...])` вместо `deep.equal` целого ответа.
5. Авторизация: `defaults.auth = { username: 'alice' }`; тест на отказ в доступе идёт отдельным `it`.
6. Тест не считается выполненным, пока не запущен: агент прикладывает вывод `npm test` в отчёт.
7. Заявление «тесты проходят» без свежего запуска запрещено протоколом.

## Команды

```bash
npm test                  # все тесты бэкенда, тихий вывод
npm run test:watch        # в разработке
npm run test:coverage     # покрытие v8 в coverage/
npm run lint              # cds lint
cd app/products && npm run lint   # ui5lint
```

## Особенности cds 10

- Decimal и Int64 из SQLite приходят строками: `expect(product.price).to.equal('1299.99')`.
- Операции записи возвращают `{ affected }`, а не изменённые строки.
- `srv.entities` это геттер, не функция.
