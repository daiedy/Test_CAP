---
name: gen-docs
description: Регенерирует docs/registry из модели и исходников и проверяет свежесть документации. Используй при словах «обнови реестр», «документация устарела», после изменений в db/, srv/, app/.
allowed-tools: Bash(npm run docs:registry), Bash(node scripts/check-docs-fresh.mjs*), Read
---

1. `npm run docs:registry` (PATH должен содержать `/opt/homebrew/opt/node@22/bin`).
2. `node scripts/check-docs-fresh.mjs`: должен вывести «docs/registry актуален».
3. Прочитай diff реестра (`git diff --stat docs/registry`) и коротко скажи пользователю, что изменилось в модели, сервисах, хендлерах или UI.
4. Если изменился код, напомни о строках в `docs/CHANGELOG.md` и обновлении `docs/STATE.md`; при необходимости делегируй `docs-keeper`.
