# Дайджест обновлений фреймворков

Файл ведёт агент `release-watcher` через скилл `release-check`. Источник данных: скрипт `scripts/watch-releases.mjs`, который без участия модели скачивает npm dist-tags, страницы релизов CAP, Atom-ленты GitHub и JSON версий UI5, сравнивает их с `docs/framework/versions.json` и печатает diff. Агент читает только diff и записывает сюда новый раздел сверху: что изменилось, влияет ли это на проект, какие действия рекомендуются. Сам скрипт запускается локально (`node scripts/watch-releases.mjs`) или еженедельно в GitHub Actions (`.github/workflows/release-check.yml`).

Правило чтения: разделы идут от новых к старым. Каждый раздел содержит два списка, «Влияет на проект» и «Не влияет», и список рекомендуемых действий. Версии в `.mcp.json` и `package.json` этот файл не меняет, только рекомендует.

## 2026-09-07 — базовое состояние

Первый запуск, состояние зафиксировано в `docs/framework/versions.json`. Проверен 31 источник, ошибок нет.

| Пакет или источник | Версия на 2026-09-07 | В проекте |
|---|---|---|
| `@sap/cds` | 10.0.6 | ^10 (10.0.6) |
| `@sap/cds-dk` | 10.0.7 | ^10 (10.0.7), глобально 10.0.7 |
| `@sap/cds-compiler` | 7.0.3 | транзитивно |
| `@cap-js/cds-test` | 1.0.2 | ^1 (1.0.2) |
| `@cap-js/sqlite` | 3.0.2 | ^3 (3.0.2) |
| `@cap-js/mcp-server` | 0.0.5 | закреплено 0.0.5 в `.mcp.json` |
| `@sap-ux/fiori-mcp-server` | 1.12.2 | закреплено 1.12.2 в `.mcp.json` |
| `@ui5/mcp-server` | 0.2.18 | через плагин `ui5` 0.1.8 |
| `chrome-devtools-mcp` | 1.8.0 | закреплено 1.8.0 в `.mcp.json` |
| `@ui5/cli` | 4.0.65 | ^4 |
| `@ui5/linter` | 1.23.5 | ^1 |
| `@sap/ux-ui5-tooling` | 1.32.0 | ^1.32 |
| `@sap-ux/ui5-middleware-fe-mockserver` | 2.4.16 | ^2 |
| `@sap-ux/ui5-test-writer` | 1.9.6 | не установлен, этап 3 |
| `ui5-test-runner` | 5.14.0 | не установлен, этап 3 |
| `wdio-ui5-service` | 3.0.11 | не установлен, этап 3 |
| SAPUI5 на CDN | 1.152.0 | manifest `minUI5Version` 1.136.0, CDN без фиксации |
| SAPUI5 LTS | 1.148, 1.136, 1.120 и старше | ближайшая LTS для фиксации: 1.148 |
| CAP release notes | `releases/index.md`: 3 заголовка; `releases/2026/changelog.md`: 28 заголовков | |
| Ленты GitHub | cds-dbs (sqlite v2.4.1 в ветке 2.x), cds-test v1.0.2, mcp-server v0.0.5, open-ux-tools, UI5/linter v1.23.5, UI5/mcp-server v0.2.18, openui5 v1.152.0, wdi5 v3.0.11, plugins-coding-agents v0.1.8, capire/skills, SAP-docs/sapui5 What's New | |

Замечания базового состояния:

- Все версии в `package.json` совпадают с актуальными на npm, отставаний нет.
- Последний коммит в `capire/skills` меняет рекомендацию для Node.js на ESM, что совпадает с нашим ADR о ESM.
- Ветка `@cap-js/sqlite` 2.x продолжает получать патчи, но проект на 3.x, к нам не относится.
