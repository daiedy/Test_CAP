---
paths:
  - "db/**/*.cds"
---
# Доменная модель (db/)

Применяется к `db/schema.cds`, `db/common.cds`, `db/<module>.cds`. Данные CSV см. `data.md`.

## Перед правкой
1. `mcp__cds-mcp__search_model` по каждой затрагиваемой сущности и ассоциации: что уже есть, кто на неё ссылается.
2. `mcp__cds-mcp__search_docs` по конструкции, которую собираешься использовать (aspect, composition, localized, calculated element).
3. Прочитать `docs/registry/DOMAIN-MODEL.md`: не дублировать сущности и типы, переиспользовать существующие.
4. Убедиться, что для задачи есть спецификация `docs/features/<name>/PLAN.md`.

## Правила
- `CONVENTIONS.md` раздел 3 полностью. Ключевое: `cuid, managed`, PascalCase множественное число для сущностей, camelCase элементы, длины у всех строк, `Association to` в единственном числе, `Composition of many` во множественном.
- Справочники для пользователя: `sap.common.CodeList`, не `enum` (PATTERNS: «Справочник с выбором из списка»).
- Деньги: `Decimal(15, 2)` + `currency : Currency`.
- Никаких аннотаций `@UI.*`, `@Common.*`, `@title`, `@mandatory` в `db/`. Семантика в `srv/annotations/<Entity>.cds`, представление в `app/<app>/annotations/`.
- Новый модуль домена: отдельный файл `db/<module>.cds` с `namespace my.catalog.<module>;`.
- Шаблон: `templates/entity.cds`.

## После правки
- `cds compile db --to json` без ошибок, затем `npm run lint`.
- Сгенерировать или обновить CSV: `cds add data --filter <Entity> --records 10`, затем заменить плейсхолдеры реальными значениями (см. `data.md`).
- Обновить снимок `cds compile '*' --to edmx-v4 -s CatalogService -l en > app/products/webapp/localService/metadata.xml`.
- Обновить или добавить тест сервиса и снапшот metadata (`npx vitest -u` только осознанно).
- `npm run docs:registry`.

## Запрещено
- Менять тип или удалять существующий элемент без ADR и записи в `docs/CHANGELOG.md`.
- Выставлять сущности `db/` напрямую без проекции в сервисе.
- `cds add sample`.
