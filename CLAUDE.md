# CLAUDE.md

Конституция проекта Test_CAP. Короткая по замыслу: инварианты и указатели. Детали в `docs/`, правила по типам файлов в `.claude/rules/` (подгружаются автоматически), рабочие потоки в `.claude/skills/`.

## Что это

Product Catalog: SAP CAP (Node.js 22, `@sap/cds` 10, OData V4, SQLite in-memory в разработке) плюс Fiori Elements V4 (List Report + Object Page). Одна сущность `my.catalog.Products`, сервис `CatalogService` на `/odata/v4/catalog`. Проект одновременно является площадкой агентного конвейера, план в `docs/ai-pipeline-plan.md`.

## Карта документации

| Вопрос | Файл |
|---|---|
| Где мы сейчас, открытый долг | `docs/STATE.md` |
| Как устроено и почему | `docs/architecture/ARCHITECTURE.md` |
| Как называть, где что лежит, стиль | `docs/architecture/CONVENTIONS.md` |
| Единственный способ решить типовую задачу | `docs/architecture/PATTERNS.md` |
| Версии и инструменты | `docs/architecture/STACK.md` |
| Как тестировать | `docs/architecture/TESTING.md` |
| Что уже есть в коде (генерируется) | `docs/registry/*.md` |
| Почему так решили | `docs/decisions/ADR-*.md` |
| Спецификации фич | `docs/features/<name>/` |
| Выученные уроки, типовые ошибки | `docs/LESSONS.md` |
| Что изменилось | `docs/CHANGELOG.md` |
| Что нового во фреймворках | `docs/framework/UPDATES.md` |
| Эталонные файлы | `templates/` |

## Инварианты

1. **MCP-first.** Перед созданием или изменением любого SAP-артефакта запроси нужный сервер. Если MCP противоречит твоим знаниям, прав MCP.

   | Меняешь | Сервер и инструменты |
   |---|---|
   | CDS: сущности, проекции, действия, хендлеры | `cds-mcp`: `search_model`, затем `search_docs` |
   | `@UI.*`, `@Common.*`, Fiori Elements, `manifest.json` | `fiori-mcp`: `search_docs`; manifest только через `list_functionality` → `execute_functionality` |
   | Контролы, XML-вью, контроллеры UI5 | UI5 MCP из плагина `ui5`: `get_api_reference`, `get_guidelines`, `run_ui5_linter`, `run_manifest_validation` |
   | Версии, «что нового» | не MCP: `cds version`, `npm view`, `docs/framework/UPDATES.md` |

2. **Спецификация раньше кода.** Изменение кода начинается с `docs/features/<name>/PLAN.md`, утверждённого пользователем. Оркестратор: `/feature`, только план: `/spec`.
3. **Реестр раньше реализации.** Перед новой функцией, хендлером, фрагментом, типом: `docs/registry/` и `search_model`. Дубликат существующего это блокирующая ошибка ревью.
4. **Одна задача, один способ.** Способ берётся из `PATTERNS.md`. Нет строки, значит нужен ADR, а не второй способ.
5. **Слои аннотаций.** Семантика (`@title`, `@mandatory`, `@assert.*`, `@readonly`) в `srv/annotations/<Entity>.cds`; представление (`@UI.*`, `@Common.ValueList`, `@Common.Text`) в `app/<app>/annotations/<Entity>.cds`; в `db/` аннотаций нет.
6. **Декларативно раньше императивно.** Хендлер пишется, когда аннотации не хватает.
7. **Тексты через i18n.** `en` и `ru` в одном изменении. Строк для пользователя в коде нет.
8. **Ворота, а не доверие.** Хуки запускают линтеры после правок, а тесты и проверку документации перед завершением. «Тесты проходят» без свежего вывода не принимается.
9. **Документация в том же изменении.** `npm run docs:registry`, строка в `docs/CHANGELOG.md`, актуальный `docs/STATE.md`.

## Стиль в двух строках

CDS: PascalCase сущности во множественном числе, camelCase элементы, `cuid, managed`, длины у строк, CodeList вместо enum. JS: ESM, `extends cds.ApplicationService`, `cds.log`, `req.reject(code, 'KEY')`, `cds.ql`, Prettier. UI: только XML, `sap.ui.define`, без глобальных `sap.*`, JavaScript, Fiori Elements по умолчанию, manifest только через Fiori MCP.

## Команды

```bash
npm run watch                    # CAP на :4004, UI http://localhost:4004/products/webapp/test/flpSandbox.html
npm test                         # Vitest + @cap-js/cds-test, снапшот $metadata в test/__snapshots__
npm run lint                     # cds lint
npm run docs:registry            # регенерация docs/registry
node scripts/check-docs-fresh.mjs
cd app/products && npm start     # UI5 dev server с прокси на :4004
cd app/products && npm run start-mock   # UI без бэкенда (sap-fe-mockserver)
cd app/products && npm run lint  # ui5lint
cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml   # снимок после изменения модели
```

PATH в GUI-сессиях может не содержать Node: `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`.

## Конвейер

- Субагенты в `.claude/agents/`: `architect`, `ux-designer`, `cap-backend-dev`, `fiori-app-dev`, `ui5-freestyle-dev`, `test-backend`, `test-ui`, `ui-verifier`, `reviewer`, `docs-keeper`, `release-watcher`. Все предзагружают скилл `project-protocol` и работают по нему.
- Скиллы: `/feature`, `/spec`, `/add-entity`, `/gen-docs`, `/run-app`, `/test-all`, `/review`, `/retro`, `/release-check`, `/debug-after-upgrade`, `/upgrade-cds`. Внешние: `cap-developer`, `cap-upgrade` (плагин `cap`), `ui5-best-practices*` (плагин `ui5`).
- Хуки (`.claude/settings.json`, скрипты в `scripts/hooks/`): SessionStart выводит STATE и проверяет окружение; PreToolUse запрещает правку защищённых файлов; PostToolUse запускает компиляцию и линтеры по типу файла и помечает реестр устаревшим; SubagentStop блокирует сдачу с ошибками линтера; Stop требует свежий реестр, обновлённые STATE и CHANGELOG и зелёный `npm test`. Обход только по решению пользователя: `PIPELINE_SKIP_GATE=1`, `PIPELINE_ALLOW_PROTECTED=1`.
- MCP в `.mcp.json` с закреплёнными версиями: `cds-mcp` 0.0.5, `fiori-mcp` 1.12.2, `chrome-devtools` 1.8.0. UI5 MCP приходит с плагином `ui5`.

## Не делать без явного запроса пользователя

- Править `mta.yaml`, `xs-security.json`, `ui5-deploy.yaml`, `package-lock.json`, `.claude/**`, `.mcp.json`, `scripts/hooks/**`, `docs/registry/**`, `docs/ai-pipeline-plan.md`.
- Менять хак клавиатуры в `app/products/webapp/Component.js`.
- Поднимать версии `@sap/cds`, `@sap/cds-dk`, MCP-серверов; это делают `/release-check` и `/upgrade-cds` с решением пользователя.
- Создавать Fiori-приложение или `manifest.json` руками; `cds add sample`; TypeScript в UI (ADR-0005).
- Коммитить и пушить. Коммиты делает оркестратор `/feature` по фазам или пользователь.

## Известный долг

Смотри `docs/STATE.md`, раздел «Открытый долг». Ключевое на сегодня: CSP inline-скрипты в тестовых html (снимается скиллом `modernize-flp-sandbox` из плагина `ui5-modernization`), `Products.price` Decimal(10, 2) вместо конвенции, деплой не настроен.
