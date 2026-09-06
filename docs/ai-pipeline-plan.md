# План агентного конвейера для разработки CAP-приложений

Документ описывает, как превратить репозиторий Test_CAP в основу конвейера на ИИ для создания приложений SAP CAP (Node.js) с UI на Fiori Elements или свободном UI5. Он отвечает на вопрос «что, почему и на каких основаниях», а не «как именно писать код»: реализация идёт следующим этапом.

Дата исследования: 2026-09-06. Все версии и ссылки проверены в этот день по npm registry, GitHub API и первоисточникам. Раздел «Источники» в конце.

Обновлено 2026-09-07: по решению автора проекта из плана убран внешний командный сервер памяти, проект silruntime не рассматривается.

---

## 1. Краткое резюме

Что строим: набор файлов в `.claude/` и `docs/`, который превращает Claude Code в дисциплинированную команду из специализированных субагентов. Каждый агент работает по одному общему протоколу, обязан сверяться с документацией фреймворков через MCP-серверы SAP и с внутренней документацией проекта, а качество гарантируют детерминированные хуки, а не доверие к модели.

Ключевые решения:

1. **Не изобретать SAP-специфику.** SAP уже выпускает три официальных MCP-сервера (CAP, Fiori, UI5), наборы скиллов (capire/skills, UI5 plugins, SAP AI Skills Library) и эталонный репозиторий с методологией «MCP-first». Берём их как есть и строим поверх.
2. **Единый протокол для всех агентов.** Один скилл `project-protocol` предзагружается в каждого субагента через поле `skills` фронтматтера. Так все агенты видят одни и те же правила независимо от сессии.
3. **Одна задача, один способ.** Каталог паттернов `docs/architecture/PATTERNS.md`: для каждой повторяющейся задачи ровно один утверждённый способ и ссылка на пример в коде. Правила по путям (`.claude/rules/*.md`) подгружают нужный раздел при работе с файлами соответствующего типа.
4. **Реестр переиспользования генерируется, а не пишется руками.** Скрипт собирает из скомпилированной CDS-модели и исходников список сущностей, сервисов, действий, хендлеров, фрагментов и утилит. Хук помечает реестр устаревшим при изменении кода, а перед завершением работы требует его обновить.
5. **Ворота качества в хуках.** Линтеры (`cds lint`, `ui5lint`, eslint) после каждого редактирования, тесты и проверка свежести документации перед завершением задачи, запрет на правку защищённых файлов.
6. **Актуальность знаний о фреймворках без дорогих затрат.** Три слоя: живые MCP-серверы с документацией, еженедельный дешёвый агент-наблюдатель, который скриптом собирает ленты релизов и пишет дайджест, и Renovate для обновления зависимостей.
7. **Спецификация раньше кода.** Каждая фича проходит через `docs/features/<name>/` с контекстом, планом и верификацией, как в эталоне SAP-samples/cap-agentic-engineered.

Первый обязательный шаг: установить Node.js 22 и перевести проект с cds 8 на cds 10. Все актуальные инструменты SAP требуют Node 22 и ориентированы на cds 10.

---

## 2. Требования и как они закрыты

| Ваше требование | Решение в плане | Раздел |
|---|---|---|
| Агенты, скиллы, хуки на уровне репозитория | Структура `.claude/` с субагентами, скиллами, правилами, хуками и `.mcp.json` | 5 |
| Подключить UI5 MCP | `@ui5/mcp-server` плюс два других официальных сервера SAP | 4.1, 5.7 |
| Больше специализированных агентов: проектирование, код, вёрстка, дизайн | 11 субагентов с ролями и ограничением инструментов | 5.4 |
| Подходящие MCP | Официальные три плюс Chrome DevTools, адаптер `@cap-js/mcp`, позже HANA и BTP | 4.1 |
| Стабильная консистентная архитектура, все работают сообща | Общий протокол, каталог паттернов, правила по путям, агент-ревьюер | 5.1, 5.3 |
| Файлы одного типа в одном стиле | Шаблоны в `templates/`, правила по путям, линтеры в хуках, Prettier | 5.3, 5.6 |
| Не писать заново то, что уже есть | Генерируемый реестр `docs/registry/`, обязательный `search_model` перед кодом, ревьюер ищет дубли | 5.8 |
| Полная документация, сверка при разработке фич | Спецификации фич, ADR, STATE.md, генерируемые реестры, хук свежести документации | 5.8, 5.9 |
| Приложение с Fiori и без | Две ветки UI: Fiori Elements через `fiori-mcp` и свободный UI5 через `ui5-mcp` и скиллы best practices | 5.4 |
| Тесты бэкенда и фронтенда | `@cap-js/cds-test` с Vitest, QUnit, OPA5-журнеи из `@sap-ux/ui5-test-writer`, wdi5 для E2E | 5.10 |
| Конвейер разбирается в UI5, CAP, Fiori | MCP-серверы с поиском по документации, официальные скиллы, `llms.txt` | 4.2, 4.4 |
| Недорогая актуальность по обновлениям | Агент-наблюдатель на дешёвой модели раз в неделю, скрипты вместо токенов, Renovate | 5.11 |
| Быстро разбираться с багами после обновлений | Скилл `debug-after-upgrade`: сопоставление падений с changelog за диапазон версий из lockfile | 5.11 |

---

## 3. Что исследовано

### 3.1 Проект silruntime

Не найден ни на этой машине, ни в доступных репозиториях GitHub. По решению автора проекта (2026-09-07) не рассматривается. План опирается на официальные инструменты SAP и эталонный репозиторий SAP-samples.

### 3.2 Текущее состояние Test_CAP

Известно из предыдущего обзора и зафиксировано в `CLAUDE.md`: cds 8 при cds-dk 9, Node не установлен, мок-сервер не работает, `ui5.yaml` ссылается на неустановленный middleware, `mta.yaml` не готов к деплою. Проект маленький, это удобная площадка для обкатки конвейера.

### 3.3 Официальные инструменты SAP для coding-агентов

Подробно в разделе 4. Главный вывод: за 2025–2026 SAP выстроила полноценную экосистему для агентной разработки под лицензией Apache-2.0, ориентированную в первую очередь на Claude Code.

### 3.4 Наработки сообщества

Публичных многоагентных конвейеров для CAP мало, всего три конкретных примера. Остальное сводится к схеме «один агент плюс MCP плюс скиллы».

| Что | Что полезно | Оговорки |
|---|---|---|
| `secondsky/sap-skills`, 435 звёзд, самый крупный набор | Плагин `sap-cap-capire`: 4 агента (`cap-cds-modeler`, `cap-service-developer`, `cap-project-architect`, `cap-performance-debugger`), 5 команд, `hooks.json`, 22 справочных документа и шаблоны (schema, service, аннотации, хендлер, mta, xs-security). Структура агентов с allowlist инструментов MCP пригодна как образец | Лицензия GPL-3.0, встраивать код в свой репозиторий нельзя, только брать идеи. Хук «валидации CDS» проверяет лишь секреты и `eval`, а не `cds compile`. MCP закреплён на старой версии |
| `michal-majer/sap-cap-fiori-ai-agents`, 49 звёзд | 6 Markdown-агентов и 8-фазный оркестратор `sap-full-stack-orchestrator`; плейбук по аннотациям Fiori Elements на 2400 строк; правила: отдельные `*-flows.cds`, `*-constraints.cds`, `access-control.cds`, CSV `<namespace>-<Entity>.csv`, «никогда не создавать структуру Fiori руками, только генератором», `TextArrangement` для скрытия UUID, value help на каждый внешний ключ | Без лицензии, формат Cursor, не обновлялся с января 2026, до cds 10 |
| CAPforge, `automatizatodo/capforge` | MCP-сервер верификации: `cap_project_context` (компиляция в CSN и «используй ровно эти имена»), `cap_scaffold_entity`, `cap_validate` (цикл `cds compile`), `cap_lint`, `cap_deploy_check` (временный SQLite и загрузка CSV), `ui5_validate_view` (XML плюс проверка, что хендлер существует) | Версия 0.1, 0 звёзд, создан июль 2026. Идея верна, реализацию мы делаем хуками |
| `marianfoo/mcp-sap-docs`, 219 звёзд | Гибридный поиск по документации CAP, UI5, wdi5, BTP, ABAP, Cloud SDK и по SAP Community и Help. Публичная точка `https://mcp-sap-docs.marianzeis.de/mcp` | Сторонний хостинг без аутентификации. Полезен как дополнение к трём официальным серверам, особенно по wdi5 и BTP |
| `mauriciolauffer/eslint-plugin-better-cap-config` | 43 правила ESLint против устаревшей конфигурации CAP в `package.json` и `.cdsrc.json` | Годится как хук и как проверка в CI |
| AGENTS.md в реальных проектах: `SAP-samples/cloud-cap-hana-swapi`, `marianfoo/ui5-call-action`, `SAP-samples/cloud-cap-with-javascript-basics` | Конкретные правила из практики: разделять `*-service.cds` и `*-fiori.cds`; никогда не ставить `@odata.draft.enabled` на родителя и ребёнка композиции одновременно; UUID-ключи везде; таблицы-справочники вместо enum; пути в аннотациях через точку, а не слэш; «не изобретать команды тестов, если раннер не настроен» | Разрозненные файлы, не система |

Методологические публикации SAP, которые подтверждают выбранную архитектуру:

- **«The Agentic Code Quality Funnel»** (SAP Office of the CTO, 2026-04-27): четыре слоя, MCP-серверы → скиллы с маршрутизацией по путям → спецификация → ворота безопасности и ревью. Измерено: без опоры 4 из 15 архитектурных решений агента были неверны, 53 уязвимости из устаревших зависимостей, необъявленные virtual-поля ломали drill-down в OData V4. Наш план повторяет эти четыре слоя.
- **«Teaching AI Agents Best Practices: A Skills Workspace for CAP»** (команда CAP, 2026-06-09): скилл это «уточнение, а не исправление», 1–6 тысяч токенов; один источник истины и симлинки в `.claude/`, `.opencode/`, `.agents/`; evals «со скиллом и без»; принцип «один путь, а не все пути»; ретроспектива в конце сессии дописывает скилл; методологию записывать в README и CLAUDE.md, чтобы агенты коллег работали так же.
- **«Claude Code: Best Practices for Developers»** (SAP, 2026-05-12): многоуровневый CLAUDE.md (жёсткие правила → рабочий поток → стандарты кода), ворота plan-mode, «никаких заявлений о готовности без свежей проверки», субагент на задачу плюс агент-ревьюер.
- **Критика**: «The SAP MCP dilemma» (Tobias Hofmann, 2026-03): MCP-серверы SAP это заплатки с документацией, три сервера используют три разные стратегии поиска, контекст переучивается каждую сессию. Вывод для нас: MCP нужен, но недостаточен, поэтому знания о проекте живут в `docs/` и правилах, а не только в MCP.
- **«Putting the compiler in the loop»** (2026-08-11): поиск по документации не равен верификации; перечень типовых ошибок агентов, см. ниже.

Типовые ошибки агентов в CAP и Fiori по публикациям, стартовый список для `docs/LESSONS.md` и проверок ревьюера:

1. Придуманный синтаксис CDS и несуществующие термы аннотаций.
2. Синтаксис OData V2 в модели V4; неверные значения criticality.
3. Игнорирование существующей модели: новые сущности и поля вместо переиспользования; императивная валидация вместо `@assert`.
4. `@odata.draft.enabled` одновременно на родителе и ребёнке композиции.
5. Структура Fiori-приложения и `manifest.json` написаны руками, а не генератором; ошибки именованных моделей.
6. Пути в аннотациях через слэш вместо точки; отсутствие `TextArrangement`, из-за чего видны UUID.
7. Unbound action привязан к кнопке без пути выполнения; нет авторизации на уровне сервиса и действия; virtual-поля без значений.
8. Устаревшие API UI5: `sap.ui.getCore()`, `jQuery.sap.*`, синхронная загрузка, глобальные переменные; наивная замена создаёт циклические зависимости.
9. Обработчик `press` объявлен в XML, но отсутствует в контроллере.
10. Файл controller extension назван `*.controller.js` вместо `*.js`, модуль не загружается.
11. Преждевременное усложнение: MTA и XSUAA на стадии прототипа, `cds add sample`.
12. Дрейф при обновлениях: забыт глобальный `@sap/cds-dk`, ломающие изменения cds 9 и 10.
13. Заявление «тесты проходят» без запуска.

Пробелы, которые закрывает наш план, потому что в публичном пространстве этого нет: ни один открытый репозиторий не запускает `cds compile`, `cds lint` или `ui5lint` в хуках Claude Code; нет генератора документации из CDS в Markdown (единственная встроенная помощь это `cds compile --to mermaid`); нет проекта CAP с ADR для агентов.

**Безопасность.** 2026-04-29 атака Shai Hulud внедряла вредоносный хук в `settings.json` Claude Code в репозитории CAP и собирала `.claude.json` с конфигурацией MCP. Отсюда правило: `.claude/settings.json`, `.mcp.json` и скрипты хуков считаются чувствительными к безопасности файлами, версии MCP-серверов закрепляются, установка зависимостей идёт с `--ignore-scripts`, а ревью правок в этих файлах обязательно. Подробнее в 5.13.

### 3.5 Механика Claude Code

Сверено с официальной документацией на 2026-09-06. Используемые возможности: субагенты с постоянной памятью и предзагрузкой скиллов, скиллы с привязкой к путям файлов, правила по путям в `.claude/rules/`, хуки типов command, prompt, agent и mcp_tool, проектный `.mcp.json`, плагины, планировщик задач.

---

## 4. Ландшафт готовых инструментов

### 4.1 MCP-серверы

**Официальные SAP, обязательные для конвейера:**

| Сервер | Пакет, версия | Инструменты | Зачем нам |
|---|---|---|---|
| CAP MCP | `@cap-js/mcp-server` 0.0.5 (2026-04-27), bin `cds-mcp` | `search_model` (fuzzy-поиск по скомпилированной CDS-модели: сущности, связи, аннотации, HTTP-эндпоинты), `search_docs` (локальный семантический поиск по документации capire, эмбеддинги лежат в пакете) | Агенты обязаны искать существующие определения перед созданием новых и сверять синтаксис CDS и API CAP |
| Fiori MCP | `@sap-ux/fiori-mcp-server` 1.12.2 (2026-09-03), Node ≥22 | `search_docs` (Fiori Elements, аннотации, UI5, OPA5, Fiori tools), `list_fiori_apps`, `generate_fiori_app_cap`, `generate_fiori_app_odata`, трёхшаговая модификация `list_functionality` → `get_functionality_details` → `execute_functionality` (страницы, controller extensions, manifest), `list_sap_systems`, `download_odata_service_metadata` | Генерация и модификация Fiori Elements приложений через официальный инструментарий, а не правками manifest вручную |
| UI5 MCP | `@ui5/mcp-server` 0.2.18 (2026-08-13) | `create_ui5_app`, `create_integration_card`, `get_api_reference` (с учётом версии UI5 проекта), `get_guidelines`, `get_project_info`, `get_version_info`, `run_manifest_validation`, `run_ui5_linter`, `get_integration_cards_guidelines`, `get_typescript_conversion_guidelines` | Свободный UI5: API контролов, гайдлайны, линтер и валидация manifest. Живые данные с CDN, не устаревают |

Все три анонсированы SAP Build 2025-09-03 как официальный мост к Cursor, Copilot, Cline и Claude Code. Fiori MCP в README рекомендует использовать его вместе с двумя другими.

**Дополнительные, по мере необходимости:**

| Сервер | Роль | Когда подключать |
|---|---|---|
| Chrome DevTools MCP | Проверка UI в реальном браузере: скриншоты, консоль, сеть. SAP включает его в плагин ui5-modernization | Этап 3, для агента верификации UI |
| `@cap-js/mcp` 1.4.3 (адаптер протокола, Beta) | Выставляет ваши CAP-сервисы как MCP: `describe`, `query`, `call_action`. Автоматически регистрируется в `~/.claude.json` при `cds watch` | Этап 3, чтобы тест-агент и ревьюер смотрели живые данные без написания HTTP-запросов |
| `hana-cli` MCP 4.202607.1 | 186 инструментов для HANA Cloud | Только когда появится HANA |
| MCP Server for SAP BTP Administration (GA 2026-08-27) | Администрирование аккаунтов, сервисов, безопасности через OAuth | Только при выходе на деплой в BTP |
| `@ui5/webcomponents-mcp-server` 0.1.2 | API и гайдлайны UI5 Web Components | Только если выберете третью ветку UI без классического UI5 |
| `mcp-sap-docs` (сообщество, Marian Zeis) | Единый поиск по документации CAP, UI5, wdi5, BTP, Cloud SDK и SAP Community | Этап 3, для тест-агента (wdi5) и вопросов по BTP; сторонний хостинг, только чтение |
| CAPforge (сообщество) | Верификация через компиляцию и проверку деплоя | Наблюдать за развитием; функции реализуем хуками |

### 4.2 Официальные скиллы и плагины

| Источник | Содержимое | Как ставить |
|---|---|---|
| `capire/skills` (команда CAP) | `cap-developer` (моделирование, декларативный подход, хендлеры Node.js и Java, правила sample data), `cap-upgrade` (миграция на cds 10 с рабочим потоком), `cap-add-remote-service`, `cap-trivia`. У каждого скилла есть `evals/` | `/plugin marketplace add capire/skills` и `/plugin install cap-developer@cap`, либо `npx skills add https://github.com/capire/skills.git` |
| `UI5/plugins-coding-agents` (в официальном маркетплейсе Claude Code) | Плагин `ui5`: `.mcp.json` с UI5 MCP плюс скиллы `ui5-best-practices`, `-accessibility`, `-tables`, `-mdc`, `-smart-controls`, `-opa5`, `-qunit`, `-integration-cards`. Плагин `ui5-modernization`: 20 скиллов и пятифазный оркестратор с воротами верификации. Плагин `ui5-typescript-conversion` | `claude plugin install ui5@claude-plugins-official` |
| Скиллы в `@sap-ux/fiori-mcp-server` (в репозитории, не в npm) | `sap-fiori-app-development`, `sap-fiori-opa5-test-development`, `sap-fiori-create-cli`, `sap-fiori-eslint-plugin`, `sap-fiori-analytical-chart`, `sap-fiori-add-visual-filter`, `sap-fiori-tree-table` | Копировать из репозитория; официальный путь установки не задокументирован |
| SAP AI Skills Library, портал skills.cloud.sap | Реестр из 55 скиллов: CAP Developer, CAP Upgrade, UI5 Best Practices, Modernize UI5 App, SAP Fiori Guidelines, BTP CLI, CF CLI и другие | `npx skills add SAP/ai-skills-library` |
| `SAP/ui-theme-designer-plugins-for-coding-agents` | Скиллы по дизайн-токенам SAP Fiori и UI Theme Designer | `/plugin install ui-theme-designer@claude-plugins-official` |
| `SAP-samples/hana-cli-claude-plugin` | Плагин с HANA MCP | Позже |

Как SAP пишет скиллы, по `docs/Guidelines.md` и структуре репозиториев: `SKILL.md` с подробным `description` и ключевыми словами, каталоги `references/` для длинных материалов и `scripts/` для детерминированных проверок с тестами, `evals/` для проверки скилла, conventional commits. Мы повторяем этот формат.

### 4.3 Эталон: SAP-samples/cap-agentic-engineered

Референсное приложение CAP плюс Fiori Elements, полностью собранное Claude Code по методологии MCP-first. Что берём:

- **Таблица маршрутизации в AGENTS.md.** CDS, хендлеры → CAP MCP; аннотации `@UI`, Fiori Elements, manifest → Fiori MCP; контроллеры, XML-вью, API контролов → UI5 MCP. Правило: «если MCP противоречит знаниям модели, следовать MCP».
- **Скиллы с привязкой к путям.** `sap-cap` срабатывает на `**/db/**/*.cds`, `**/srv/**/*.cds`, `**/srv/**/*.js` и требует вызвать `mcp__cap__search_docs` до правок.
- **Каталог `spec/`.** `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` с процентом прогресса и накопленными решениями, `codebase/{ARCHITECTURE,CONVENTIONS,TESTING,STRUCTURE,STACK,CONCERNS}.md`, фазы с `PLAN`, `SUMMARY`, `VERIFICATION`.
- **`LESSONS_LEARNED.md`.** Например, файл controller extension для Fiori Elements должен называться `ListReportExt.js`, а не `ListReportExt.controller.js`, иначе модуль не загрузится.

Что не берём: в AGENTS.md эталона есть правила, не относящиеся к SAP (pnpm, keybindings). Их отсекаем.

### 4.4 Документация в машиночитаемом виде

- CAP: `https://cap.cloud.sap/docs/llms.txt`, `llms-full.txt` (3.5 МБ), `sitemap.md`; любая страница как Markdown при добавлении `.md` к URL.
- SAPUI5: `llms.txt` на ui5.sap.com нет. Есть репозиторий `SAP-docs/sapui5` с документацией в Markdown, включая «What's New» по версиям; `https://ui5.github.io/llms.txt` для TypeScript-документации.
- Fiori tools: репозиторий `SAP-docs/btp-fiori-tools`.
- Релизные данные JSON: `https://ui5.sap.com/versionoverview.json`, `https://ui5.sap.com/resources/sap-ui-version.json`, `https://ui5.sap.com/test-resources/sap/fe/core/relnotes/changes-<версия>.json`.

### 4.5 Линтеры и утилиты для хуков

| Инструмент | Пакет | Назначение |
|---|---|---|
| CDS lint | `@sap/eslint-plugin-cds` 4.2.5 через `cds add lint` и `cds lint` | Валидация модели и окружения; правило `latest-cds-version` ловит устаревший cds |
| UI5 linter | `@ui5/linter` 1.23.5, `npx ui5lint --format json`, `--fix` | Устаревшие API, глобальные переменные, CSP, готовность к современному UI5 |
| Fiori ESLint | `@sap-ux/eslint-plugin-fiori-tools` 10.9.3 | Правила для Fiori-приложений, flat config |
| Fiori CLI | `@sap-ux/create` 1.3.12 | Генерация OPA5-тестов и других артефактов из командной строки |
| Сервис UI5 внутри cds | `cds-plugin-ui5` 0.17.4 | Отдаёт UI5-приложения с tooling внутри `cds watch` на :4004 |
| Конфигурация CAP | `eslint-plugin-better-cap-config` | 43 правила против устаревших настроек в `package.json` и `.cdsrc.json` |
| Диаграммы | `cds compile --to mermaid` | Диаграмма модели для `docs/architecture/ARCHITECTURE.md` и `DOMAIN-MODEL.md` |

---

## 5. Целевая архитектура конвейера

### 5.1 Принципы

1. **Конституция сначала.** `CLAUDE.md` до 200 строк, только инварианты и указатели. Детали живут в `docs/` и правилах по путям.
2. **MCP-first.** Перед созданием или изменением любого SAP-артефакта агент обязан запросить соответствующий MCP. Это правило SAP из README трёх серверов, и оно закреплено в протоколе и в правилах по путям.
3. **Спецификация раньше кода.** Фича начинается с `docs/features/<name>/CONTEXT.md` и `PLAN.md`, код появляется после утверждения плана.
4. **Реестр раньше реализации.** Прежде чем писать функцию, хендлер, фрагмент или утилиту, агент ищет в `docs/registry/` и через `search_model`. Ревьюер отдельно ищет дубли.
5. **Одна задача, один способ.** Каталог паттернов утверждает единственный способ на каждую повторяющуюся задачу. Отклонение допустимо только через новый ADR.
6. **Ворота, а не доверие.** Линтеры, тесты и свежесть документации проверяют хуки с блокирующим кодом выхода.
7. **Слои знаний по убыванию стоимости.** Что-то нужно всегда → `CLAUDE.md`. Нужно при работе с типом файлов → `.claude/rules/`. Нужно для рабочего потока → скилл. Нужно свежее и большое → MCP.
8. **Дешёвые модели для механической работы.** Наблюдатель за релизами и хранитель документации работают на самой дешёвой модели; архитектор и ревьюер на самой сильной.
9. **Скиллы проверяются evals.** У каждого своего скилла есть `evals/` с фикстурами «правильно» и «с ошибкой», как в плагинах UI5 и capire/skills. Прогон «со скиллом и без» показывает, что скилл вообще влияет на результат.

Эта схема совпадает с четырьмя слоями «Agentic Code Quality Funnel» от SAP Office of the CTO: MCP → скиллы по путям → спецификация → ворота. Совпадение не случайно, план на неё опирается.

### 5.2 Структура репозитория

```
CLAUDE.md                          # конституция, ≤200 строк, импортирует docs/architecture/*
.mcp.json                          # cds-mcp, fiori-mcp, ui5-mcp-server, chrome-devtools (проектный scope)
.claude/
  settings.json                    # хуки, разрешения, общие для команды
  settings.local.json              # личное, в .gitignore
  rules/                           # правила по путям
    db-model.md                    # paths: db/**/*.cds
    srv-services.md                # paths: srv/**/*.cds
    srv-handlers.md                # paths: srv/**/*.js
    ui-annotations.md              # paths: app/**/*.cds, srv/annotations/**
    ui5-webapp.md                  # paths: app/**/webapp/**
    tests-backend.md               # paths: test/**
    tests-ui.md                    # paths: app/**/webapp/test/**
    i18n.md                        # paths: **/i18n/**, **/_i18n/**
    deploy.md                      # paths: mta.yaml, xs-security.json, ui5-deploy.yaml
  agents/                          # субагенты, раздел 5.4
  skills/                          # скиллы проекта, раздел 5.5
  agent-memory/                    # постоянная память агентов (memory: project), в git
docs/
  architecture/
    ARCHITECTURE.md                # слои, потоки данных, границы
    CONVENTIONS.md                 # именование, структура файлов, стиль
    PATTERNS.md                    # каталог «одна задача, один способ»
    STACK.md                       # версии, инструменты, зачем каждый
    TESTING.md                     # стратегия тестов и команды
  registry/                        # генерируется скриптом, руками не править
    DOMAIN-MODEL.md                # сущности, поля, аспекты, аннотации
    SERVICES.md                    # сервисы, проекции, действия, функции, эндпоинты
    HANDLERS.md                    # хендлеры: событие, сущность, файл, назначение
    UI-ARTIFACTS.md                # приложения, страницы, extensions, фрагменты, форматтеры
    REUSE-CATALOG.md               # утилиты srv/lib, общие типы, общие аннотации
  decisions/                       # ADR-0001-....md
  features/<name>/                 # CONTEXT.md, PLAN.md, SUMMARY.md, VERIFICATION.md
  framework/
    versions.json                  # зафиксированные версии и хеши лент
    UPDATES.md                     # еженедельный дайджест наблюдателя
  STATE.md                         # текущее положение, накопленные решения
  LESSONS.md                       # выученные уроки
  CHANGELOG.md
templates/                         # эталонные файлы: сущность, сервис, хендлер, аннотации, тест, i18n
scripts/
  gen-registry.mjs                 # cds compile → docs/registry/*
  check-docs-fresh.mjs             # сравнивает хеши исходников и реестра
  watch-releases.mjs               # тянет ленты, считает diff, пишет черновик дайджеста
```

### 5.3 Слои инструкций

**CLAUDE.md** содержит: назначение проекта, таблицу маршрутизации MCP (из эталона SAP), список неизменяемых правил (OData V4, PascalCase сущности и camelCase поля, аннотации только в `srv/annotations/` или `app/`, никаких `console.log`, i18n для всех строк, XML-вью без JS-вью), ссылку на протокол, команды и запреты. Импорты через `@docs/architecture/CONVENTIONS.md` и `@docs/architecture/PATTERNS.md`.

**Правила по путям** подгружаются только при обращении к файлам нужного типа, поэтому не раздувают контекст. Пример `.claude/rules/srv-handlers.md`:

```markdown
---
paths:
  - "srv/**/*.js"
---
# Хендлеры CAP

- До правки: `mcp__cds-mcp__search_model` по сущности и `mcp__cds-mcp__search_docs` по API.
- Сначала декларативно: `@assert.*`, `@mandatory`, `@readonly`, `@restrict`. Хендлер только когда аннотаций не хватает.
- Фазы: `before` для валидации, `on` для действий и функций, `after` для побочных эффектов.
- Ошибки через `req.reject(code, message)` и ключи из `_i18n/messages.properties`.
- Логирование через `cds.log('<module>')`.
- Никаких ручных транзакций.
- Общий код в `srv/lib/`, перед созданием проверить `docs/registry/REUSE-CATALOG.md`.
- Шаблон: `templates/handler.js`. Тест обязателен: `test/<service>.test.js`.
```

**Каталог паттернов** `docs/architecture/PATTERNS.md`: таблица «задача → единственный способ → пример в коде → ADR». Начальный список: валидация ввода, обязательные поля, value help, draft, действия и функции, обработка ошибок, логирование, i18n, вычисляемые поля, авторизация, кастомная кнопка в Fiori Elements, controller extension, фрагмент, форматтер, тестовый файл бэкенда, тестовый файл UI.

### 5.4 Субагенты

Все агенты получают `skills: [project-protocol]`, `memory: project` и явный список инструментов. Модель указана как рекомендация по стоимости.

| Агент | Роль | Инструменты | Модель |
|---|---|---|---|
| `architect` | Проектирование фичи: CONTEXT, PLAN, при необходимости ADR. Читает реестры, вызывает `search_model`, не пишет код | Read, Grep, Glob, Write только в `docs/`, `mcp__cds-mcp__*`, `mcp__fiori-mcp__search_docs` | Самая сильная |
| `cap-backend-dev` | CDS-модель, сервисы, хендлеры, sample data через `cds add data` | Read, Edit, Write, Bash, `mcp__cds-mcp__*` | По умолчанию |
| `fiori-app-dev` | Fiori Elements: аннотации, manifest, страницы, extensions через Fiori MCP | Read, Edit, Write, Bash, `mcp__fiori-mcp__*`, `mcp__ui5-mcp-server__run_manifest_validation` | По умолчанию |
| `ui5-freestyle-dev` | Свободный UI5: XML-вью, контроллеры, кастомные контролы. Ветка «без Fiori» | Read, Edit, Write, Bash, `mcp__ui5-mcp-server__*` | По умолчанию |
| `ux-designer` | Дизайн-ревью и макеты: гайдлайны Fiori, floorplans, токены темы, доступность. Пишет спецификацию экрана в Markdown | Read, Write в `docs/features/`, `mcp__fiori-mcp__search_docs`, `mcp__ui5-mcp-server__get_guidelines` | По умолчанию |
| `test-backend` | Тесты `@cap-js/cds-test` на Vitest, снапшот `$metadata` | Read, Edit, Write, Bash, `mcp__cds-mcp__search_docs` | По умолчанию |
| `test-ui` | QUnit, OPA5-журнеи через `@sap-ux/ui5-test-writer`, wdi5 E2E | Read, Edit, Write, Bash, `mcp__ui5-mcp-server__*`, `mcp__fiori-mcp__search_docs` | По умолчанию |
| `ui-verifier` | Запуск приложения и проверка в браузере: скриншоты, консоль, сеть | Bash, Chrome DevTools MCP | Дешёвая |
| `reviewer` | Ревью против CONVENTIONS, PATTERNS, реестров. Ищет дубли и отклонения. Только чтение | Read, Grep, Glob, `mcp__cds-mcp__search_model` | Самая сильная |
| `docs-keeper` | Запуск `gen-registry`, обновление STATE, CHANGELOG, SUMMARY фичи, LESSONS | Read, Write в `docs/`, Bash для скриптов | Дешёвая |
| `release-watcher` | Еженедельно: запуск `watch-releases.mjs`, чтение diff, дайджест в `docs/framework/UPDATES.md` с пометкой «влияет / не влияет на проект» | Bash, Read, Write в `docs/framework/`, WebFetch | Дешёвая |

Пример фронтматтера `.claude/agents/cap-backend-dev.md`:

```markdown
---
name: cap-backend-dev
description: Реализует бэкенд CAP по утверждённому PLAN.md фичи: CDS-модель в db/, сервисы и хендлеры в srv/, sample data. Используй для любой правки db/**, srv/** после того, как architect утвердил план.
tools: Read, Edit, Write, Grep, Glob, Bash, mcp__cds-mcp__search_model, mcp__cds-mcp__search_docs
skills: [project-protocol, cap-developer]
memory: project
maxTurns: 60
---
Ты бэкенд-разработчик CAP. Работай строго по docs/features/<name>/PLAN.md.
Перед первой правкой вызови search_model по каждой затронутой сущности и search_docs по каждому API.
Следуй docs/architecture/PATTERNS.md. Новую утилиту создавай только если её нет в docs/registry/REUSE-CATALOG.md.
По завершении: cds lint, тесты, отчёт о том, что изменено и какие пункты плана закрыты.
```

Почему протокол передаётся через `skills`, а не через надежду на CLAUDE.md: предзагрузка скилла детерминирована и одинакова для каждого агента в каждой сессии. Это прямой ответ на требование «все понимали, что происходит, и работали сообща».

### 5.5 Скиллы

**Свои, в `.claude/skills/`:**

| Скилл | Тип | Назначение |
|---|---|---|
| `project-protocol` | Скрытый, предзагружается во всех агентов | Общий протокол: порядок работы, обязательные MCP-запросы, где искать реестр, формат отчёта, запреты |
| `feature` | Оркестратор, вызывается пользователем `/feature <описание>` | Ведёт фичу через фазы: исследование → CONTEXT → PLAN → бэкенд → UI → тесты → ревью → документация → коммит. Ворота между фазами по образцу `modernize-ui5-app` из плагина SAP: режим выбирается один раз (автономный, полуавтономный, ручной) |
| `spec` | Пользовательский | Только фазы исследования и планирования, без кода |
| `add-entity`, `add-action`, `add-fiori-app`, `add-ui5-view` | Пользовательские | Короткие рабочие потоки для типовых операций с обязательными вызовами MCP и шаблонами |
| `gen-docs` | Пользовательский и вызываемый хуком | Запускает `scripts/gen-registry.mjs`, проверяет `docs/STATE.md` |
| `run-app` | Пользовательский | `cds watch`, открытие FLP, проверка через Chrome DevTools |
| `test-backend`, `test-ui`, `test-all` | Пользовательские | Запуск наборов тестов с разбором падений |
| `review` | Пользовательский | Вызывает агента `reviewer` для diff текущей ветки |
| `release-check` | Пользовательский и по расписанию | Скрипт лент → diff → дайджест. Раздел 5.11 |
| `debug-after-upgrade` | Пользовательский | Берёт диапазон версий из diff lockfile, тянет changelog `.md` за диапазон, ищет совпадения с текстом ошибки, предлагает исправление со ссылкой на запись |
| `upgrade-cds` | Пользовательский | Обёртка над `cap-upgrade` из capire/skills с нашими воротами |
| `retro` | Пользовательский, в конце сессии | Ретроспектива по методологии команды CAP: что агент сделал не так, какое правило или скилл надо уточнить; записывает в `docs/LESSONS.md` и предлагает правку скилла |

**Внешние, устанавливаются:** `cap-developer`, `cap-upgrade` (capire/skills), плагин `ui5` (8 скиллов best practices и UI5 MCP), `ui-theme-designer`, скиллы `sap-fiori-app-development` и `sap-fiori-opa5-test-development` из репозитория Fiori MCP.

Пример фронтматтера скилла с привязкой к путям, по образцу эталона SAP:

```markdown
---
name: cds-mcp-first
description: Обязательная проверка через CAP MCP перед правкой CDS и хендлеров.
paths:
  - "db/**/*.cds"
  - "srv/**/*.cds"
  - "srv/**/*.js"
user-invocable: false
---
```

### 5.6 Хуки

Определяются в `.claude/settings.json`. Тип `command` с кодом выхода 2 блокирует действие; `prompt` и `agent` дают семантические проверки; `mcp_tool` вызывает инструмент MCP.

| Событие | Матчер | Действие | Зачем |
|---|---|---|---|
| SessionStart | * | Вывести `docs/STATE.md` (первые 40 строк) и заголовок последнего дайджеста `docs/framework/UPDATES.md`; проверить `node -v`, `cds -v` против `docs/architecture/STACK.md` | Каждая сессия начинается с одного контекста |
| PreToolUse | Edit, Write на `mta.yaml`, `xs-security.json`, `package-lock.json`, `.claude/**`, `docs/registry/**` | Блокировать с сообщением «защищённый файл, нужен явный запрос пользователя» | Реестр правится только генератором, деплой-файлы только осознанно |
| PreToolUse | Write нового файла в `srv/lib/**`, `app/**/webapp/ext/**` | Хук типа `prompt`: «есть ли аналог в REUSE-CATALOG или UI-ARTIFACTS? ответь allow или deny с причиной» | Против повторного написания существующего |
| PostToolUse | Edit, Write `*.cds` | `cds compile <file> --to json` для проверки синтаксиса, `cds lint`; при ошибке вернуть текст в контекст | Битая модель ловится сразу |
| PostToolUse | Edit, Write `srv/**/*.js`, `test/**/*.js` | `eslint --fix <file>`, `prettier --write <file>` | Единый стиль без обсуждений |
| PostToolUse | Edit, Write `app/**/webapp/**/*.{js,xml,html}` | `npx ui5lint <file> --format json` | Устаревшие API и глобальные переменные ловятся сразу |
| PostToolUse | Edit, Write `app/**/manifest.json` | `mcp_tool`: `run_manifest_validation` UI5 MCP | Валидный manifest |
| PostToolUse | Edit, Write `db/**`, `srv/**`, `app/**` | Записать метку в `docs/registry/.stale` | Отметка, что реестр устарел |
| SubagentStop | `cap-backend-dev`, `fiori-app-dev`, `ui5-freestyle-dev` | Запуск линтеров по изменённым файлам; при ошибке блок с выводом | Агент не сдаёт работу с ошибками линтера |
| Stop | * | `scripts/check-docs-fresh.mjs`: если есть `.stale`, запустить `gen-registry` и потребовать обновить STATE и CHANGELOG; если изменён код, запустить `npm test -- --silent`; при падении код выхода 2 | Документация и тесты всегда актуальны к концу задачи |
| PreCompact | * | Дописать краткую сводку в `docs/STATE.md` | Контекст не теряется при сжатии |

Пример фрагмента `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "node scripts/hooks/post-edit.mjs", "timeout": 90 }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "node scripts/hooks/stop-gate.mjs", "timeout": 600 }
        ]
      }
    ]
  }
}
```

Один скрипт `post-edit.mjs` читает JSON события со stdin, смотрит путь файла и решает, какой линтер запускать. Так логика ветвления живёт в коде, а не в десятке записей settings.

### 5.7 Конфигурация MCP

Проектный `.mcp.json`, попадает в git, каждый участник подтверждает при первом запуске:

```json
{
  "mcpServers": {
    "cds-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@cap-js/mcp-server@0.0.5"]
    },
    "fiori-mcp": {
      "type": "stdio",
      "timeout": 600,
      "command": "npx",
      "args": ["--yes", "@sap-ux/fiori-mcp-server@1.12.2", "fiori-mcp"],
      "env": { "SAP_UX_FIORI_TOOLS_DISABLE_TELEMETRY": "true" }
    },
    "ui5-mcp-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@ui5/mcp-server@0.2.18"]
    },
    "chrome-devtools": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@<закрепить версию при установке>"]
    }
  }
}
```

Замечания: версии закреплены, а не `@latest`, как советуют README серверов. Причина в разделе 5.13, обновление версий делает `release-check`. Fiori MCP по умолчанию шлёт телеметрию, отключаем переменной. `search_docs` Fiori MCP при первом запуске скачивает модель эмбеддингов 86 МБ. CAP MCP хранит эмбеддинги документации внутри пакета, поэтому его версия влияет на свежесть знаний; в `release-check` входит проверка новой версии `@cap-js/mcp-server`. Имена инструментов для allowlist агентов: `mcp__cds-mcp__search_model`, `mcp__fiori-mcp__search_docs`, `mcp__ui5-mcp-server__get_api_reference` и так далее.

### 5.8 Документация как код

Ручные документы: ARCHITECTURE, CONVENTIONS, PATTERNS, STACK, TESTING, ADR, спецификации фич, STATE, LESSONS. Их ведут `architect` и `docs-keeper`, а хук Stop проверяет, что STATE и CHANGELOG тронуты, если менялся код.

Генерируемые документы в `docs/registry/`, скрипт `scripts/gen-registry.mjs`:

1. `cds compile srv --to json` даёт полную модель CSN: сущности, элементы, типы, аспекты, аннотации, сервисы, действия, функции. Из неё строятся `DOMAIN-MODEL.md` и `SERVICES.md`.
2. Разбор `srv/**/*.js` регулярными выражениями или через `@babel/parser`: вызовы `srv.before/on/after('<событие>', '<сущность>', ...)` и экспортируемые функции `srv/lib/**` дают `HANDLERS.md` и `REUSE-CATALOG.md`.
3. Разбор `app/**/webapp/manifest.json` и файлов в `ext/`, `fragment/`, `model/formatter.js` даёт `UI-ARTIFACTS.md`.
4. `cds compile db --to mermaid` даёт диаграмму сущностей и связей, она вставляется в `DOMAIN-MODEL.md`.
5. В шапку каждого файла пишется хеш исходников, по которому `check-docs-fresh.mjs` определяет устаревание.

Стоимость нулевая в токенах: генерация детерминирована. Агенты читают Markdown-реестры, а для точечных вопросов используют `search_model`.

### 5.9 Рабочий поток фичи

Скилл `/feature "<описание>"`, режим ворот выбирается один раз.

| Фаза | Кто | Артефакты | Ворота |
|---|---|---|---|
| 0. Подготовка | оркестратор | Ветка `feature/<name>`, каталог `docs/features/<name>/` | Чистое рабочее дерево |
| 1. Исследование | `architect` | `CONTEXT.md`: затронутые сущности из `search_model`, существующие хендлеры и UI-артефакты из реестров, релевантные записи PATTERNS и LESSONS | Список переиспользуемого не пуст или явно «ничего нет» |
| 2. Дизайн | `ux-designer` при наличии UI | Раздел «Экраны» в CONTEXT: floorplan, поля, действия, состояния | Соответствие гайдлайнам Fiori по `search_docs` |
| 3. План | `architect` | `PLAN.md`: шаги, файлы, тесты, критерии готовности; ADR, если появляется новый паттерн | Пользователь подтверждает в полуавтономном и ручном режимах |
| 4. Бэкенд | `cap-backend-dev` | CDS, хендлеры, данные, тесты бэкенда | Линтеры, `npm test` |
| 5. UI | `fiori-app-dev` или `ui5-freestyle-dev` | Аннотации и manifest, либо вью и контроллеры; тесты UI от `test-ui` | `ui5lint`, валидация manifest, OPA5 |
| 6. Верификация | `ui-verifier` | Скриншоты и лог консоли в `VERIFICATION.md` | Нет ошибок в консоли, сценарии из PLAN проходят |
| 7. Ревью | `reviewer` | Замечания против CONVENTIONS, PATTERNS, реестров | Ноль блокирующих замечаний |
| 8. Документация | `docs-keeper` | Реестры, `SUMMARY.md`, STATE, CHANGELOG, LESSONS при необходимости | `check-docs-fresh` зелёный |
| 9. Коммит | оркестратор | Один коммит на фазу в стиле conventional commits, как в плагине SAP | Пользователь решает про push |

### 5.10 Стратегия тестирования

**Бэкенд.** `@cap-js/cds-test` 1.0.2 с Vitest: capire с апреля 2026 называет Vitest основным раннером и предупреждает об отказе от Jest. In-memory SQLite. Тесты в `test/<service>.test.js`: CRUD через `GET/POST` из `cds.test`, действия, авторизация с `defaults.auth`, валидации `@assert`. Отдельный снапшот-тест `$metadata` через `cds compile srv --to edmx` и `toMatchSnapshot()`: любая непреднамеренная смена контракта OData ломает тест. Покрытие через `@vitest/coverage-v8`. Учесть изменения cds 10: Decimal и Int64 из SQLite приходят строками, операции записи возвращают `{ affected }`.

**UI, Fiori Elements.** Генерация OPA5-журнеев из метаданных через `@sap-ux/ui5-test-writer` 1.9.6: page objects на `sap.fe.test.ListReport` и `ObjectPage`, JourneyRunner, testsuite. Запуск без браузера через `ui5-test-runner` 5.14.0 (`karma-ui5` снят с поддержки). QUnit для форматтеров и controller extensions.

**UI, свободный UI5.** QUnit по правилам скилла `ui5-best-practices-qunit`, OPA5 по `ui5-best-practices-opa5`, Test Starter обязателен (правило `prefer-test-starter` линтера).

**E2E.** wdi5 (`wdio-ui5-service` 3.0.11) против запущенного `cds watch`, `FioriElementsFacade` для Fiori Elements, BasicAuth для мок-пользователей CAP. Немного сценариев, только критичные пути.

**Статика.** `cds lint`, `ui5lint`, `@sap-ux/eslint-plugin-fiori-tools`, Prettier. Всё в хуках и в CI.

**CI.** GitHub Actions: `npm ci`, линтеры, `npm test`, `ui5-test-runner`, wdi5 по расписанию или на main. Один workflow `ci.yml`.

### 5.11 Актуальность знаний о фреймворках

Три слоя, от бесплатного к дешёвому.

**Слой 1. Живые знания через MCP.** UI5 MCP берёт API и гайдлайны с CDN под версию проекта, ничего не устаревает. Fiori MCP индексирует документацию при выпуске, версии выходят почти еженедельно (155 версий с сентября 2025). CAP MCP держит эмбеддинги в пакете, обновляется редко (0.0.5 от 2026-04-27), поэтому для свежих тем агент дополнительно читает `cap.cloud.sap/docs/releases/<год>/changelog.md`. Правило протокола: при вопросе о версиях доверять `cds version`, `npm view` и живым страницам, а не снапшоту в MCP. Это же предупреждение стоит в скилле `cap-developer` от команды CAP.

**Слой 2. Еженедельный наблюдатель.** Скрипт `scripts/watch-releases.mjs` без участия модели скачивает и хеширует:

- npm dist-tags: `@sap/cds`, `@sap/cds-dk`, `@sap/cds-compiler`, `@cap-js/cds-test`, `@cap-js/sqlite`, `@cap-js/mcp-server`, `@ui5/linter`, `@ui5/mcp-server`, `@sap-ux/fiori-mcp-server`, `@sap-ux/ui5-test-writer`, `@sap/ux-ui5-tooling`, `wdio-ui5-service`, `ui5-test-runner`;
- CAP: `cap.cloud.sap/docs/releases/index.md`, `releases/2026/changelog.md`, свежая страница месяца `.md`, Atom-ленты `cap-js/cds-dbs`, `cap-js/cds-test`, `cap-js/mcp-server`, коммиты `capire/skills`;
- UI5: `versionoverview.json`, `sap-ui-version.json`, `test-resources/sap/fe/core/relnotes/changes-<версия>.json`, Atom-ленты `UI5/openui5`, `UI5/linter`, `UI5/mcp-server`, `UI5/plugins-coding-agents`, коммиты `SAP-docs/sapui5/docs/01_Whats-New`;
- Fiori tools: Atom `SAP/open-ux-tools` releases, `ui5-community/wdi5`.

Сравнение с `docs/framework/versions.json` даёт diff. Только если diff не пуст, запускается агент `release-watcher` на дешёвой модели: читает изменившиеся фрагменты, пишет раздел в `docs/framework/UPDATES.md` с двумя списками, «влияет на проект» и «не влияет», ссылками и рекомендуемым действием, и обновляет `versions.json`. Запуск: облачная routine через `/schedule` раз в неделю или GitHub Actions cron с `claude -p`. Оценка стоимости: скрипт бесплатен, агент тратит несколько десятков тысяч токенов дешёвой модели в неделю, это единицы центов.

**Слой 3. Зависимости.** Renovate или Dependabot с группировкой пакетов SAP и недельным расписанием. Changelog в PR появляется для `@cap-js/*`, `@ui5/*`, `@sap-ux/*` (открытые репозитории), но не для `@sap/cds*` (закрытый npm). Правило `latest-cds-version` из cds lint дублирует проверку.

**Отладка после обновления.** Скилл `debug-after-upgrade`: из `git diff package-lock.json` берёт диапазоны версий, тянет `changelog.md` CAP и `changes-<версия>.json` UI5 за диапазон, ищет совпадения с текстом ошибки и стеком, предлагает патч со ссылкой на конкретную запись. Для мажоров CAP дополнительно `cds upgrade` из cds-dk 10 и скилл `cap-upgrade`. Так время на «в чём проблема после апдейта» сокращается до одного прохода по changelog, который делает агент, а не человек.

### 5.12 Как закрываются риски консистентности

| Риск | Механизм |
|---|---|
| Агент пишет заново то, что уже есть | Реестры, обязательный `search_model`, prompt-хук при создании файлов в `srv/lib` и `ext`, ревьюер |
| Одна задача решается разными способами в разных сессиях | PATTERNS.md с единственным способом, шаблоны, правила по путям, ADR для отклонений |
| Разный стиль файлов | Prettier и ESLint в PostToolUse, шаблоны, `ui5lint --fix` |
| Агент не знает архитектуры | SessionStart выводит STATE, CLAUDE.md импортирует ARCHITECTURE, architect обязан прочитать реестры |
| Документация отстаёт | `.stale` после правок, Stop-хук блокирует завершение без регенерации и записи в STATE и CHANGELOG |
| Устаревшие знания о фреймворке | MCP-first, UPDATES.md, `debug-after-upgrade` |
| Агент правит то, что нельзя | PreToolUse блок на защищённые файлы |
| Разные агенты по-разному понимают задачу | Общий `project-protocol` в `skills` каждого агента, единый PLAN.md как источник задачи |

### 5.13 Безопасность конфигурации агентов

Файлы `.claude/settings.json`, `.mcp.json`, `.claude/agents/`, `.claude/skills/*/scripts/` и `scripts/hooks/` исполняются автоматически и поэтому равны по риску CI-скриптам. Правила:

1. Версии MCP-серверов и пакетов в `npx` закреплены точно; поднимает их только `release-check` после проверки changelog.
2. `npm ci --ignore-scripts` в CI и в хуках; lockfile всегда в git.
3. Правки перечисленных файлов запрещены агентам через PreToolUse (раздел 5.6) и проходят ревью человека.
4. Скрипты хуков не читают и не отправляют наружу `~/.claude.json`, `.env`, service keys. Сетевые обращения хуков ограничены списком доменов из раздела 5.11.
5. Внешние скиллы и плагины ставятся из официальных источников SAP и маркетплейса Claude Code; сторонние репозитории с GPL и без лицензии используются только как источник идей.
6. Правило семидневной выдержки для новых версий зависимостей, как в эталоне SAP.

---

## 6. Что берём готовым, что пишем сами

| Готовое | Пишем сами |
|---|---|
| Три MCP-сервера SAP, Chrome DevTools MCP | `.mcp.json`, allowlist инструментов в агентах |
| Скиллы `cap-developer`, `cap-upgrade`, плагин `ui5`, скиллы Fiori MCP, `ui-theme-designer` | `project-protocol`, `feature`, `gen-docs`, `release-check`, `debug-after-upgrade`, короткие `add-*` |
| Таблица маршрутизации MCP и структура `spec/` из эталона SAP | CLAUDE.md, правила по путям, PATTERNS.md, шаблоны |
| Пятифазный оркестратор с воротами как образец | Наш оркестратор фичи с нашими фазами |
| `@cap-js/cds-test`, `@sap-ux/ui5-test-writer`, `ui5-test-runner`, wdi5 | Тестовые шаблоны и конфигурация |
| Ленты релизов, `llms.txt`, JSON UI5 | Скрипты `watch-releases`, `gen-registry`, `check-docs-fresh`, хуки |

---

## 7. Этапы внедрения

**Этап 0. Окружение и база.** Установить Node 22, `npm i -g @sap/cds-dk@10`. Обновить проект на cds 10 скиллом `cap-upgrade` и миграционным гайдом. Починить или удалить мок-сервер и `ui5.yaml` (пункты 2 и 3 из CLAUDE.md), убрать `ecosystem.config.js`, поправить `.gitignore`. Подключить `.mcp.json`, установить плагин `ui5` и `cap-developer`. Проверить, что `cds watch` и FLP работают. Результат: чистый рабочий проект с MCP.

**Этап 1. Конституция и документация.** Переписать CLAUDE.md до 200 строк с таблицей маршрутизации и импортами. Написать ARCHITECTURE, CONVENTIONS, PATTERNS (первые 10 паттернов на текущем коде), STACK, TESTING, первые ADR (cds 10, Vitest, OData V4, аннотации в `srv/annotations`). Написать `gen-registry.mjs` и сгенерировать реестры. Правила по путям. Результат: любой агент понимает проект за одну сессию без обхода кода.

**Этап 2. Агенты и скиллы.** `project-protocol`, 11 агентов, оркестратор `feature`, короткие `add-*`. Прогнать одну небольшую фичу через весь поток на этом проекте, например «категории как отдельная сущность с value help». Результат: рабочий конвейер на одной фиче, выученные уроки в LESSONS.

**Этап 3. Ворота и тесты.** Хуки PostToolUse, Stop, PreToolUse, SubagentStop. `cds-test` с Vitest, снапшот `$metadata`, OPA5-журнеи, `ui5-test-runner`, один wdi5-сценарий, Chrome DevTools для верификации. CI в GitHub Actions. Результат: ни одна задача не завершается с красными тестами или устаревшей документацией.

**Этап 4. Актуальность.** `watch-releases.mjs`, агент `release-watcher`, routine раз в неделю, Renovate, скилл `debug-after-upgrade`. Результат: UPDATES.md обновляется без участия человека.

**Этап 5. Масштаб.** Упаковать `.claude/` в приватный плагин с локальным маркетплейсом для переноса в другие CAP-проекты. Ветка «без Fiori» на реальном экране. Результат: конвейер переносим между проектами.

Каждый этап заканчивается коммитом и записью в CHANGELOG. Этапы 0–1 реалистично закрыть за несколько сессий, этапы 2–3 самые трудоёмкие.

---

## 8. Открытые вопросы и решения за вами

1. **Переход на cds 10 и Node 22 первым шагом.** Рекомендую да: все инструменты SAP уже требуют этого, а на cds 8 плагины и MCP работать будут хуже.
2. **Ветка UI «без Fiori».** Свободный UI5 с XML-вью через UI5 MCP, или UI5 Web Components через отдельный MCP. Рекомендую первое, оно ближе к Fiori-стеку и покрыто скиллами best practices.
3. **TypeScript для UI5.** SAP даёт плагин конверсии и рекомендует TS для новых приложений. Для тестового проекта можно остаться на JS, для конвейера «на вырост» лучше TS с самого начала.
4. **Плагин или `.claude/` в репозитории.** Начать с `.claude/`, упаковать в плагин на этапе 5, когда появится второй проект.
5. **Модели и бюджет.** Архитектор и ревьюер на сильной модели, остальное по умолчанию, наблюдатель и хранитель документации на дешёвой. Бюджет наблюдателя единицы центов в неделю.
6. **Режим ворот по умолчанию.** Полуавтономный: агент делает фазу, показывает результат, ждёт «дальше». Полностью автономный включать после того, как хуки докажут надёжность.
7. **Markdown-агенты против MCP.** В сообществе есть позиция, что Markdown-инструкции переносимее и быстрее итерируются, чем MCP. План использует оба слоя: знания о проекте в Markdown, знания о фреймворках через MCP.
8. **Что делать с наработками GPL-репозитория secondsky/sap-skills.** Рекомендую не копировать, а переписать нужные шаблоны своими словами по официальной документации.

---

## 9. Источники

**Официальные MCP-серверы SAP**
- CAP MCP: https://github.com/cap-js/mcp-server, релиз-нота https://cap.cloud.sap/docs/releases/2025/aug25#cap-mcp-server, анонс https://community.sap.com/t5/technology-blog-posts-by-sap/boost-your-cap-development-with-ai-introducing-the-mcp-server-for-cap/ba-p/14202849
- Fiori MCP: https://github.com/SAP/open-ux-tools/tree/main/packages/fiori-mcp-server, анонс https://community.sap.com/t5/technology-blog-posts-by-sap/sap-fiori-tools-update-first-release-of-the-sap-fiori-mcp-server-for/ba-p/14204694, практикум https://github.com/SAP-samples/fiori-mcp-server-hands-on
- UI5 MCP: https://github.com/UI5/mcp-server, анонс https://community.sap.com/t5/technology-blog-posts-by-sap/give-your-ai-agent-some-tools-introducing-the-ui5-mcp-server/ba-p/14200825
- Общий анонс SAP Build: https://community.sap.com/t5/technology-blog-posts-by-sap/sap-build-introduces-new-mcp-servers-to-enable-agentic-development-for/ba-p/14205602
- Адаптер `@cap-js/mcp`: https://cap.cloud.sap/docs/guides/protocols/mcp
- UI5 Web Components MCP: https://github.com/UI5/webcomponents-mcp-server
- HANA CLI MCP: https://github.com/SAP-samples/hana-cli-claude-plugin, https://sap-samples.github.io/hana-developer-cli-tool-example/03-features/mcp/server-usage
- BTP Administration MCP: https://help.sap.com/docs/btp/sap-business-technology-platform/account-administration-using-mcp-servers
- Оценка MCP SAP на практике: https://community.sap.com/t5/technology-blog-posts-by-members/evaluating-sap-s-new-mcp-servers-ui5-cap-and-fiori-tools-in-practice/ba-p/14205611

**Скиллы и плагины SAP**
- capire/skills: https://github.com/capire/skills, методология https://community.sap.com/t5/technology-blog-posts-by-sap/teaching-ai-agents-best-practices-a-skills-workspace-for-cap-development/ba-p/14414367
- UI5 plugins for coding agents: https://github.com/UI5/plugins-coding-agents
- SAP AI Skills Library: https://skills.cloud.sap/, https://github.com/SAP/ai-skills-library
- UI Theme Designer plugins: https://github.com/SAP/ui-theme-designer-plugins-for-coding-agents
- Эталон MCP-first: https://github.com/SAP-samples/cap-agentic-engineered
- Релиз-ноты CAP июнь 2026 (cds 10, CAP-level Agents Alpha, CAP Skills Library Alpha): https://cap.cloud.sap/docs/releases/2026/jun26
- Каталог сообщества: https://github.com/marianfoo/sap-ai-mcp-servers

**Документация для машин**
- CAP llms.txt: https://cap.cloud.sap/docs/llms.txt, https://cap.cloud.sap/docs/llms-full.txt, статья https://community.sap.com/t5/technology-blog-posts-by-sap/unlocking-the-power-of-llms-in-cap-understanding-llms-txt-and-llms-full-txt/ba-p/14104573
- SAPUI5 в Markdown: https://github.com/SAP-docs/sapui5, Fiori tools: https://github.com/SAP-docs/btp-fiori-tools
- UI5 версии: https://ui5.sap.com/versionoverview.json, https://ui5.sap.com/resources/sap-ui-version.json, стратегия поддержки https://ui5.sap.com/docs/maintenancestrategy.pdf
- CAP расписание релизов: https://cap.cloud.sap/docs/releases/schedule, миграция на cds 10: https://cap.cloud.sap/docs/releases/migration/cds10

**Тестирование**
- cds-test: https://cap.cloud.sap/docs/node.js/cds-test, https://github.com/cap-js/cds-test
- cds lint: https://cap.cloud.sap/docs/tools/cds-lint/
- Best practices CAP Node.js: https://cap.cloud.sap/docs/node.js/best-practices
- OPA-тесты Fiori Elements: https://github.com/SAP-docs/sapui5/blob/main/docs/06_SAP_Fiori_Elements/writing-opa-tests-for-applications-1afe34f.md
- ui5-test-writer: https://github.com/SAP/open-ux-tools/tree/main/packages/ui5-test-writer
- wdi5: https://ui5-community.github.io/wdi5/, Fiori Elements facade https://github.com/ui5-community/wdi5/blob/main/docs/fe-testlib.md, аутентификация https://github.com/ui5-community/wdi5/blob/main/docs/authentication.md
- ui5-test-runner: https://arnaudbuchholz.github.io/ui5-test-runner/
- UI5 linter: https://github.com/UI5/linter, правила https://github.com/UI5/linter/blob/main/docs/Rules.md
- ESLint Fiori tools: https://github.com/SAP/open-ux-tools/tree/main/packages/eslint-plugin-fiori-tools
- cds-plugin-ui5: https://github.com/ui5-community/ui5-ecosystem-showcase/tree/main/packages/cds-plugin-ui5
- Снятие karma-ui5: https://community.sap.com/t5/technology-blog-posts-by-sap/deprecation-of-karma-ui5-plugin/ba-p/13954060

**Claude Code**
- Субагенты: https://code.claude.com/docs/en/sub-agents.md
- Скиллы: https://code.claude.com/docs/en/skills.md
- Хуки: https://code.claude.com/docs/en/hooks-guide.md, https://code.claude.com/docs/en/hooks.md
- Память и CLAUDE.md: https://code.claude.com/docs/en/memory.md
- MCP: https://code.claude.com/docs/en/mcp.md
- Плагины: https://code.claude.com/docs/en/plugins.md
- Расписания: https://code.claude.com/docs/en/scheduled-tasks.md, https://code.claude.com/docs/en/routines.md
- Настройки: https://code.claude.com/docs/en/settings.md

**Сообщество и методология**
- Agentic Code Quality Funnel (SAP Office of the CTO): https://architecture.learning.sap.com/news/2026/04/27/agentic-engineering
- Claude Code: Best Practices for Developers (SAP): https://community.sap.com/t5/artificial-intelligence-blogs-posts/claude-code-best-practices-for-developers/ba-p/14394164
- How I teach Claude Code to work my way (SAP): https://community.sap.com/t5/artificial-intelligence-blogs-posts/how-i-teach-claude-code-to-work-my-way/ba-p/14349299
- Agentic Coding with MCP: Extending CAP and Fiori Applications (SAP): https://community.sap.com/t5/technology-blog-posts-by-sap/agentic-coding-with-mcp-extending-cap-and-fiori-applications/ba-p/14290686
- The SAP MCP dilemma (критика): https://www.itsfullofstars.de/2026/03/the-sap-mcp-dilemma/
- Putting the compiler in the loop: https://community.sap.com/t5/technology-blog-posts-by-members/the-missing-half-of-ai-assisted-cap-development-putting-the-compiler-in-the/ba-p/14460862
- From Zero to Fiori (Markdown-агенты): https://community.sap.com/t5/sap-cap-blog-posts/from-zero-to-fiori-building-sap-apps-with-ai-agents-and-why-i-use-markdown/ba-p/14288142, репозиторий https://github.com/michal-majer/sap-cap-fiori-ai-agents
- secondsky/sap-skills (GPL-3.0): https://github.com/secondsky/sap-skills
- CAPforge: https://github.com/automatizatodo/capforge
- mcp-sap-docs: https://github.com/marianfoo/mcp-sap-docs
- eslint-plugin-better-cap-config: https://github.com/mauriciolauffer/eslint-plugin-better-cap-config
- AGENTS.md примеры: https://github.com/SAP-samples/cloud-cap-hana-swapi/blob/main/AGENTS.md, https://github.com/marianfoo/ui5-call-action/blob/main/AGENTS.md, https://github.com/SAP-samples/cloud-cap-with-javascript-basics/blob/main/CLAUDE.md
- CAP Bad Practices (архивная копия, живой URL сейчас 404): https://web.archive.org/web/20260124054332/https://cap.cloud.sap/docs/about/bad-practices
- CAP Domain Modeling: https://cap.cloud.sap/docs/guides/domain/
- Инцидент Shai Hulud с хуками Claude Code в репозиториях CAP: https://www.mend.io/blog/shai-hulud-sap-cap-supply-chain-attack-claude-code/
- reCAP 2026, записи: https://community.sap.com/t5/technology-blog-posts-by-sap/recap-2026-recordings-of-our-annual-cap-developer-conference/ba-p/14446111
- Спецификационные фреймворки: GSD https://github.com/gsd-build/get-shit-done, Superpowers https://github.com/obra/superpowers

