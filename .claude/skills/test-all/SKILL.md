---
name: test-all
description: Полный прогон проверок проекта: cds lint, тесты бэкенда, ui5lint, свежесть реестра. Используй перед коммитом, ревью и при словах «прогони все проверки», «всё зелёное?».
allowed-tools: Bash, Read
---

Выполни по порядку из корня (PATH с `/opt/homebrew/opt/node@22/bin`), не останавливаясь на первой ошибке, и собери таблицу «проверка → результат»:

1. `npm run lint`
2. `npm test`
3. `cd app/products && npm run lint`
4. `node scripts/check-docs-fresh.mjs`
5. `npm run format:check`

Для каждой красной проверки приведи последние 20 строк вывода и предложи, какой агент чинит (`cap-backend-dev`, `fiori-app-dev`, `test-backend`, `docs-keeper`). Не чини сам. Никогда не пиши «всё зелёное» без вывода команд.
