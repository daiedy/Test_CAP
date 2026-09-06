---
paths:
  - "app/**/webapp/test/**"
---
# Тесты UI (app/<app>/webapp/test/)

## Перед правкой
1. Скиллы `ui5-best-practices-qunit` и `ui5-best-practices-opa5` из плагина `ui5`.
2. `mcp__fiori-mcp__search_docs` по «OPA5 Fiori elements», `sap.fe.test.ListReport`, `JourneyRunner`.
3. `docs/architecture/TESTING.md`.

## Правила
- Структура: `test/testsuite.qunit.html` + `testsuite.qunit.js` (Test Starter), `test/unit/` для QUnit, `test/integration/` для OPA5-журнеев, `test/e2e/` для wdi5.
- OPA5 для Fiori Elements: page objects на `sap.fe.test.ListReport` и `sap.fe.test.ObjectPage`, генерируются `@sap-ux/ui5-test-writer`; руками правятся только журнеи.
- QUnit: `const`/`let`, `async/await`, `assert.expect(N)` в каждом асинхронном тесте, `sinon.createSandbox()`.
- Запуск без браузера: `npx ui5-test-runner --url http://localhost:8080/test/testsuite.qunit.html` при запущенном `npm start`.
- `test/flpSandbox.html` это точка входа приложения, не тест; менять только через скилл `modernize-flp-sandbox`.

## После правки
- `npx ui5lint` в `app/<app>`: тестовые страницы тоже проверяются (`prefer-test-starter`).
- Запустить тесты и приложить вывод.

## Запрещено
- Тесты, зависящие от порядка выполнения или реальных таймеров.
- Удалять `flpSandbox.html` или `index.html`.
