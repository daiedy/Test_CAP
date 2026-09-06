# <Имя фичи>: план

Дата: YYYY-MM-DD. Статус: черновик | утверждён | выполнен. Режим ворот: полуавтономный | автономный | ручной.

## Критерии готовности
- [ ] Поведение 1, проверяется тестом `test/<service>.test.js` «...»
- [ ] Поведение 2, проверяется сценарием OPA5 «...»
- [ ] Документация обновлена: реестр, STATE, CHANGELOG

## Шаги

| # | Фаза | Агент | Файлы | Паттерн | Проверка |
|---|---|---|---|---|---|
| 1 | Бэкенд: модель | `cap-backend-dev` | `db/schema.cds`, `db/data/...csv` | Новая сущность | `cds compile`, `npm run lint` |
| 2 | Бэкенд: сервис | `cap-backend-dev` | `srv/catalog-service.cds`, `srv/annotations/<Entity>.cds`, `_i18n/*` | Обязательное поле | `npm test` |
| 3 | Бэкенд: логика | `cap-backend-dev` | `srv/catalog-service.js` | Действие над одной записью | `npm test` |
| 4 | UI | `fiori-app-dev` | `app/products/annotations/<Entity>.cds`, `webapp/i18n/*` | Колонки таблицы | `ui5lint`, metadata snapshot |
| 5 | Тесты UI | `test-ui` | `webapp/test/...` | Сценарий пользователя | `ui5-test-runner` |
| 6 | Верификация | `ui-verifier` | `VERIFICATION.md` | | скриншоты, консоль без ошибок |
| 7 | Ревью | `reviewer` | | | ноль блокирующих замечаний |
| 8 | Документация | `docs-keeper` | `docs/registry`, `STATE.md`, `CHANGELOG.md`, `SUMMARY.md` | | `check-docs-fresh` |

## Решения, требующие ADR
Список или «нет».

## Риски
Что может пойти не так и как это обнаружится.
