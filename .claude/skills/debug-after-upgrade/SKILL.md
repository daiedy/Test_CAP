---
name: debug-after-upgrade
description: Разбор поломки после обновления зависимостей CAP, UI5 или Fiori tools по changelog за диапазон версий. Используй при словах «после обновления сломалось», «тесты упали после апдейта», «разобраться с обновлением», «после bump не работает», «regression after upgrade», а также когда CI покраснел на коммите с изменением lockfile.
allowed-tools: Bash, Read, Grep, WebFetch, mcp__cds-mcp__search_docs
---

# Отладка после обновления зависимостей

Принцип: сначала найти запись в changelog, объясняющую поломку, и только потом править код. Патч без ссылки на источник не принимается.

## Шаг 1. Зафиксировать симптом

Собери текст ошибки и стек в переменную поиска: имена функций, ключи конфигурации, имена аннотаций, коды HTTP. Запусти падающую команду один раз сам (`npm test`, `npm run lint`, `cd app/products && npm run lint`, `cds compile srv --to json`), чтобы иметь свежий вывод.

## Шаг 2. Определить диапазон версий

```bash
git diff HEAD -- package-lock.json app/products/package-lock.json | grep -E '^[-+]\s+"(version|resolved)"' -B2 | head -80
```

Если lockfile уже закоммичен, найди коммит: `git log -5 --oneline -- package-lock.json app/products/package-lock.json` и возьми `git show <sha> -- package-lock.json`. Составь таблицу «пакет: было → стало». Учти транзитивные пакеты `@sap/cds-compiler`, `@cap-js/db-service`, `@sap/ux-specification`.

## Шаг 3. Чеклист известных изменений cds 10

Проверь первым делом, до чтения changelog:

| Симптом | Причина в cds 10 | Исправление |
|---|---|---|
| Тест ожидал число, пришла строка `'1299.99'` | Decimal и Int64 из SQLite приходят строками (`cds.features.ieee754compatible: true`) | Сравнивать со строкой или парсить в тесте, не отключать флаг |
| `INSERT`/`UPDATE` вернул `{ affected: 1 }` вместо строки | Результаты операций записи унифицированы | Делать `SELECT` после записи, если нужны данные |
| `srv.entities()` is not a function | `srv.entities` стал геттером | Убрать скобки |
| Ошибки SQLite, отсутствие `better-sqlite3` | Драйвер по умолчанию `node:sqlite`, Node ≥ 22 | Проверить `node -v`; `better-sqlite3` только через `cds.requires.db.driver` |
| `cds.test` не найден в `@sap/cds` | Тесты в отдельном пакете `@cap-js/cds-test` | `npm add -D @cap-js/cds-test` |
| Предупреждения про annotations without targets, duplicate elements | Ужесточённые проверки компилятора | Исправить модель, не подавлять |

Полный список: `https://cap.cloud.sap/docs/releases/migration/cds10.md`.

## Шаг 4. Найти запись в changelog

Для каждого изменившегося пакета возьми источник и найди в нём термины из шага 1 (WebFetch страницы, затем поиск по тексту):

| Пакет | Источник |
|---|---|
| `@sap/cds`, `@sap/cds-dk`, `@sap/cds-compiler` | `https://cap.cloud.sap/docs/releases/<год>/changelog.md`; для мажоров и минор-релизов `https://cap.cloud.sap/docs/releases/<год>/<mon><yy>.md`, например `jun26.md` |
| `@cap-js/sqlite`, `@cap-js/cds-test`, `@cap-js/mcp-server` | `https://github.com/cap-js/<repo>/releases` и `CHANGELOG.md` в репозитории |
| SAPUI5 (`sap.ui.core`, `sap.m`, `sap.fe.core`, `sap.fe.macros`) | `https://ui5.sap.com/test-resources/<lib/path>/relnotes/changes-<версия>.json`, например `sap/fe/core/relnotes/changes-1.152.json` |
| `@sap/ux-ui5-tooling`, `@sap-ux/*` | `https://github.com/SAP/open-ux-tools/blob/main/packages/<package>/CHANGELOG.md` |
| `@ui5/cli`, `@ui5/linter` | `https://github.com/UI5/<repo>/releases` |

Дополнительно `mcp__cds-mcp__search_docs` по формулировке ошибки, но помни: документация в MCP может отставать от установленной версии; версия проверяется командой `npm ls <pkg>`.

## Шаг 5. Исправить минимально

1. Процитируй найденную запись с URL в отчёте.
2. Предложи минимальный патч, который следует рекомендации из записи. Не откатывай версию и не включай kill switch, если запись предлагает миграцию кода; kill switch допустим только как временная мера с задачей на исправление.
3. Примени патч, повтори падающую команду, приложи вывод.
4. Если это мажор CAP: сначала `npx -p @sap/cds-dk cds upgrade` для отчёта в `.cds-upgrade/`, затем скилл `cap-upgrade`; правки руками только после его отчёта.

## Шаг 6. Записать урок

Добавь запись в `docs/LESSONS.md`:

```markdown
## <YYYY-MM-DD> <пакет> a.b.c → x.y.z: <симптом в одну фразу>
Причина: <запись changelog с URL>. Исправление: <что сделано>. Проверка: <команда>.
```

Если запись объясняет поведение, о котором должны знать все агенты, предложи правку в соответствующее правило `.claude/rules/*.md` или в `docs/architecture/PATTERNS.md`.
