---
name: upgrade-cds
description: Обновление мажорной версии @sap/cds и cds-dk по официальному рабочему потоку скилла cap-upgrade с воротами проекта. Используй при словах «обнови cds», «переход на cds <N>», «upgrade CAP».
argument-hint: <целевой мажор, например 11>
disable-model-invocation: true
---

Целевая версия: $ARGUMENTS.

1. Прочитай последний дайджест в `docs/framework/UPDATES.md` и `docs/architecture/STACK.md`. Убедись, что рабочее дерево чистое, создай ветку `chore/cds-$ARGUMENTS`.
2. Вызови скилл `cap-upgrade` из плагина `cap` и следуй его потоку (миграционный гайд `https://cap.cloud.sap/docs/releases/migration/cds$ARGUMENTS.md`, `npx -p @sap/cds-dk@$ARGUMENTS cds upgrade`, отчёт в `.cds-upgrade/`).
3. Ворота проекта после каждого шага: `npm run lint`, `npm test`, `cd app/products && npm run lint`, `node scripts/check-docs-fresh.mjs`. Красное разбирай скиллом `debug-after-upgrade`.
4. Обнови `docs/architecture/STACK.md`, `docs/architecture/TESTING.md` (особенности версии), новый ADR `docs/decisions/ADR-XXXX-cds$ARGUMENTS.md`, строки в `docs/CHANGELOG.md`, `docs/LESSONS.md` при неожиданностях.
5. Версии MCP-серверов не трогай; напиши рекомендацию в `docs/framework/UPDATES.md`, если `@cap-js/mcp-server` вышел новее.

Коммит `chore(deps): upgrade to cds $ARGUMENTS` только после зелёных ворот и по указанию пользователя.
