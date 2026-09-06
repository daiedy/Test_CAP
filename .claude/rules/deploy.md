---
paths:
  - "mta.yaml"
  - "xs-security.json"
  - "app/**/ui5-deploy.yaml"
---
# Файлы деплоя (защищены)

`mta.yaml`, `xs-security.json`, `ui5-deploy.yaml` являются черновиками под Cloud Foundry и не готовы к использованию (нет `@cap-js/hana`, `@sap/xssec`, профиля `[production]`).

## Правила
- Правки только по явному запросу пользователя в текущей сессии. Задача «сделать фичу» никогда не включает эти файлы.
- Любая работа по деплою начинается с ADR в `docs/decisions/` (целевая платформа, БД, аутентификация) и отдельной ветки.
- Перед правкой: `mcp__cds-mcp__search_docs` по `cds add hana`, `cds add xsuaa`, `cds add mta`, `cds build --production`. Предпочитать `cds add <feature>` ручному редактированию.
- После правки: `cds build --production` без ошибок, `mbt build` при наличии.

## Запрещено
- Хранить учётные данные, service keys, URL тенантов в этих файлах.
- Менять `xs-security.json` без описания ролей в `docs/architecture/ARCHITECTURE.md`.
