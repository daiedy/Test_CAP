---
paths:
  - "test/**"
---
# Тесты бэкенда (test/)

## Перед правкой
1. `mcp__cds-mcp__search_docs` по `cds.test`, `defaults.auth`, `containSubset`, если API неочевиден.
2. `mcp__cds-mcp__search_model`: точные имена сущностей, действий, полей.
3. Прочитать `docs/architecture/TESTING.md`, раздел «Правила» и «Особенности cds 10».

## Правила
- Один файл на сервис: `test/<service>.test.js`. Контракт: `test/metadata.test.js`.
- Первая строка после импорта cds: `const { GET, POST, PATCH, DELETE, expect, defaults } = cds.test(import.meta.dirname + '/..')`. До этого никаких импортов подмодулей cds.
- `defaults.auth = { username: 'alice' }`, отказ в доступе проверяется отдельным `it` с другим пользователем.
- Данные из `db/data/*.csv`; проверять подмножество: `to.containSubset`, а не `deep.equal` целого ответа.
- Decimal и Int64 приходят строками: `expect(price).to.equal('1299.99')`.
- Имена тестов описывают поведение: `rejects negative stock`.
- Снапшот metadata обновляется только `npx vitest -u` с записью причины в `docs/CHANGELOG.md`.
- Шаблоны: `templates/service.test.js`, `templates/metadata.test.js`.

## После правки
- `npm test`, полный вывод в отчёт. Заявление «тесты проходят» без запуска запрещено.
- `npx prettier --write test/`.

## Запрещено
- Runner-специфичные функции (`vi.mock`, fake timers) внутри тестов cds.test.
- `process.chdir`, запуск второго сервера, реальные внешние системы.
