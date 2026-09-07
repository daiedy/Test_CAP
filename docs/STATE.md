# Состояние проекта

Обновляется агентом `docs-keeper` в конце каждой задачи и хуком PreCompact. Первые 40 строк выводятся в начале каждой сессии.

## Где мы

- Дата: 2026-09-07
- Ветка: `feature/categories-code-list` от `main` 2b4a820 (этапы 0–4 конвейера закоммичены и запушены 2026-09-07)
- Текущая фаза конвейера: этапы 0–4 плана реализованы (окружение, конституция, агенты и скиллы, хуки и тесты бэкенда, наблюдатель релизов). Не сделано: CI для тестов, упаковка в плагин (этап 5)
- Фича `categories-code-list` завершена (первый полный прогон конвейера `/feature`): `1e0bd04` (спецификация, ADR-0010, ADR-0011), `9c8623d` (бэкенд: `Categories`, `category_code`), `4bfecd8` (фикс команды снимка metadata), `ce05c8a` (фикс `npm run watch`), `64e0cf0` (UI-аннотации, value help, OPA5), плюс завершающий коммит документации (`docs-keeper`, шаг 17). Ревью дало вердикт «готово к коммиту» без блокирующих. Следующий шаг: `/retro` по фиче, затем слияние ветки `chore/english-pipeline`
- Параллельно: перевод всех файлов конвейера на английский и переименование `release-watcher` → `upstream-watcher` в ветке `chore/english-pipeline` (фоновый агент); слияние после завершения фичи

## Что работает

- Бэкенд на cds 10.0.6, Node 22: `npm run watch` (`cds watch`, порт 4004), `npm run lint`, `npm test` (15 тестов, снапшот $metadata), `npm run docs:registry`
- UI: `npm start` (прокси) и `npm run start-mock` (мок-сервер SAP) в `app/products`; `ui5lint` без ошибок
- Тесты UI: `npm run test:ui` в `app/products` (`ui5-test-runner` против `npm run watch` на :4004) — 11 пройдено, 5 пропущено (`EditCategoryOnObjectPageJourney` под `opaTest.skip`, нет draft)
- Плагины Claude Code на уровне проекта: `ui5`, `cap-developer`; MCP: `cds-mcp`, `fiori-mcp`, `chrome-devtools` (после перезапуска сессии)
- Конвейер: 11 субагентов в `.claude/agents`, 12 скиллов, 11 правил по путям, 6 хуков в `.claude/settings.json`, реестр `docs/registry`, наблюдатель релизов `scripts/watch-releases.mjs` и workflow `release-check.yml`

## Открытый долг

| Пункт | Решение | Кто |
|---|---|---|
| CSP: inline-скрипты в `webapp/index.html` и `webapp/test/flpSandbox.html` (4 предупреждения ui5lint) | Прогнать скилл `modernize-flp-sandbox` из плагина `ui5-modernization` первой задачей конвейера | пользователь решает, ставить ли плагин |
| Хак клавиатуры для кнопки Explore в `Component.js` (setTimeout, внутренний id ushell) | Осознанное решение автора. Не трогать без запроса; альтернатива через `CommandExecution` описана в LESSONS | пользователь |
| `Products.price` Decimal(10, 2) вместо конвенции Decimal(15, 2) | Оставлено, ADR-0003. Менять при первой миграции модели | architect |
| `mta.yaml`, `xs-security.json` черновики без зависимостей продуктива | Отдельный ADR перед работой по деплою | пользователь |
| Нет CI для `npm test` и линтеров (есть только `release-check.yml`) | Добавить `ci.yml`: `npm ci --ignore-scripts`, lint, test, ui5lint | пользователь решает |
| Хуки, MCP и субагенты проверены в живой сессии 2026-09-07 только точечными вызовами, полный `/feature` не прогонялся | Первый `/feature` прогнан на фиче `categories-code-list`; после него `/retro` | пользователь |
| `run_manifest_validation` UI5 MCP 0.2.18 падает с ошибкой схемы draft-06 | Обход через `ui5lint`; ждать новую версию `@ui5/mcp-server` через `release-check` | release-watcher |
| Object Page `Products` без draft не имеет режима редактирования; сценарий редактирования категории в `EditCategoryOnObjectPageJourney.js` под `opaTest.skip` | Решение о draft это отдельная фича с ADR | пользователь |
| `npm start` в `app/products` (`fiori run`, :8080) не поднимает приложение из FLP-песочницы: `/products/webapp` не обслуживается, CDN-бутстрап обходит прокси; рабочий вход только через :4004 | Закрыть вместе с `modernize-flp-sandbox` | пользователь решает |
| Тесты UI идут только против живого стека (`npm run watch`); мок (`npm run start-mock`) не отдаёт `ru` | Известное ограничение `sap-fe-mockserver`, альтернативы не найдено | |

## Накопленные решения

См. `docs/decisions/`. Ключевые: cds 10 + Node 22 (ADR-0001), Vitest + cds-test (ADR-0002), аннотации разделены на семантику в `srv/annotations` и UI в `app/<app>/annotations` (ADR-0004), JavaScript и ESM (ADR-0005), Fiori Elements V4 через Fiori MCP (ADR-0007), мок через `sap-fe-mockserver` (ADR-0008), MCP-first и закреплённые версии (ADR-0009), формат кода `UPPER_SNAKE` для собственных справочников (ADR-0010), ValueList для ассоциаций на CodeList генерируется компилятором и выпадающий список для фиксированных справочников (ADR-0011).

## Сессии
