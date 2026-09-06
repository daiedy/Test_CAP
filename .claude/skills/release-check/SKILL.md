---
name: release-check
description: Еженедельная проверка обновлений фреймворков (CAP, UI5, Fiori tools, MCP-серверы SAP) и запись дайджеста в docs/framework/UPDATES.md. Используй при словах «обновления фреймворков», «release check», «что нового в CAP/UI5», «проверь релизы», «есть ли новые версии», а также по расписанию агента release-watcher.
allowed-tools: Bash, Read, Write, WebFetch
---

# Проверка обновлений фреймворков

Цель: за один проход понять, что изменилось у SAP CAP, SAPUI5, Fiori tools и MCP-серверов, и записать в `docs/framework/UPDATES.md` короткий дайджест с оценкой влияния на проект. Ничего не обновлять в `package.json` и `.mcp.json`, только рекомендовать.

## Шаг 1. Собрать diff скриптом

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
node scripts/watch-releases.mjs --out "$SCRATCHPAD/release-diff.md"
```

`$SCRATCHPAD` это каталог scratchpad сессии. Скрипт сам обновляет `docs/framework/versions.json`. Если в выводе есть раздел `## Errors`, перечисли эти источники в дайджесте как «не проверено» и не делай по ним выводов.

Если diff пустой (`No changes since the last run.`), добавь в `UPDATES.md` раздел из одной строки «`<дата>` — изменений нет, проверено N источников» и закончи.

## Шаг 2. Оценить каждое изменение

Для каждого пункта в разделах diff определи, влияет ли он на проект:

1. Открой `docs/architecture/STACK.md` и `package.json` (корень и `app/products`), а также `.mcp.json`.
2. Пакет есть в проекте и вышла новая версия → **влияет**. Мажор → влияет сильно, нужна отдельная задача.
3. Пакет запланирован на будущий этап (см. STACK.md, раздел «Планируется») → влияет, пометка «учесть при установке».
4. Пакет не используется и не запланирован → **не влияет**.
5. Новые заголовки в CAP changelog: посмотри, упоминают ли они `@sap/cds`, `@sap/cds-dk`, `@cap-js/sqlite`, `@cap-js/cds-test`, аннотации или OData V4. Да → влияет.
6. UI5: смена активной версии CDN влияет всегда, потому что CDN не зафиксирован (ADR-0006). Новая LTS → рекомендация зафиксировать версию.
7. Ленты SAP/open-ux-tools и plugins-coding-agents: влияет только релиз `@sap-ux/fiori-mcp-server`, `@sap-ux/ui5-middleware-fe-mockserver`, `@sap-ux/ui5-test-writer` или плагина `ui5`.

## Шаг 3. Дочитать первоисточник для влияющих пунктов

Только для пунктов «влияет»: WebFetch конкретной страницы, не всего сайта.

- CAP: `https://cap.cloud.sap/docs/releases/<год>/changelog.md`, ищи заголовок с версией; для мажоров `https://cap.cloud.sap/docs/releases/<год>/<mon><yy>.md`.
- `@cap-js/*`, `@ui5/*`, wdi5: ссылка из diff на GitHub release.
- UI5: `https://ui5.sap.com/test-resources/sap/fe/core/relnotes/changes-<версия>.json` и то же для `sap/m`, `sap/ui/core`.
- Fiori MCP: `https://github.com/SAP/open-ux-tools/blob/main/packages/fiori-mcp-server/CHANGELOG.md`.

Правило версий: снапшоты документации в MCP-серверах могут отставать. Любое утверждение о версии сверяй с `npm view <pkg> version` или страницей релиза, а не с ответом `search_docs`.

## Шаг 4. Записать дайджест

Вставь новый раздел сразу после вводного текста в `docs/framework/UPDATES.md`, выше предыдущих разделов:

```markdown
## <YYYY-MM-DD>

Проверено N источников, ошибок K.

### Влияет на проект
- `<пакет>` a.b.c → x.y.z: <что изменилось в одну фразу>. Источник: <url>.

### Не влияет
- <пункт>: <почему>.

### Рекомендуемые действия
- [ ] поднять пин `<пакет>` в `.mcp.json` до x.y.z после проверки changelog
- [ ] запустить `/upgrade-cds` (только при мажоре CAP)
- [ ] зафиксировать UI5 <версия> LTS в ui5.yaml и manifest (при новой LTS)
```

Действия формулируй так, чтобы их можно было выполнить без повторного исследования. Если рекомендация меняет зависимости, укажи, какой тест или команда подтвердит успех.

## Шаг 5. Итог

Заверши одним абзацем: сколько источников проверено, сколько пунктов влияет, какое действие первое по приоритету. Никаких изменений в коде, `package.json` и `.mcp.json` в рамках этого скилла.
