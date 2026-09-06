---
paths:
  - "srv/**/*.cds"
---
# Сервисы и семантические аннотации (srv/*.cds, srv/annotations/*.cds)

Файл `srv/<name>-service.cds`: проекции, действия, функции, авторизация. Файл `srv/annotations/<Entity>.cds`: `@title`, `@mandatory`, `@assert.*`, `@readonly`, `@Measures.ISOCurrency`. Определи, к какой части относится правка, и применяй соответствующий блок.

## Перед правкой
1. `mcp__cds-mcp__search_model` по сервису и сущности: существующие проекции, действия, аннотации.
2. `mcp__cds-mcp__search_docs` по конкретной аннотации или конструкции (`@restrict`, bound action, `excluding`, `@assert.range`).
3. `docs/registry/SERVICES.md`: нет ли уже действия или проекции с такой задачей.
4. Проверить строку в `docs/architecture/PATTERNS.md`, раздел «Сервис и логика».

## Сервис (`srv/<name>-service.cds`)
- Одна проекция на сущность, выставлять только нужные поля.
- Bound action предпочтительнее unbound. Имена действий camelCase глаголом: `reorder`, `publish`.
- `@requires` на сервисе, `@restrict` на проекциях. Мок-пользователи в `package.json` → `cds.requires.auth.users`.
- Аннотации UI в этом файле запрещены. Ничего, кроме `using`, `service`, проекций, действий, `@requires`, `@restrict`, `@readonly`, `@odata.draft.enabled`.
- Импорт семантики: `using from './annotations/<Entity>';` в конце файла.
- Шаблон: `templates/service.cds`.

## Семантика (`srv/annotations/<Entity>.cds`)
- `annotate CatalogService.<Entity> with { ... }`, только `@title: '{i18n>Entity.element}'`, `@mandatory`, `@assert.format`, `@assert.range`, `@assert.target`, `@readonly`, `@Measures.ISOCurrency`, `@Core.Description`.
- Ключи i18n добавляются в `_i18n/i18n.properties` и `_i18n/i18n_ru.properties` в том же изменении.
- Шаблон: `templates/annotations-semantic.cds`.

## После правки
- `cds compile srv --to json`, `npm run lint`, обновить `metadata.xml` снимок, `npm test`, `npm run docs:registry`.

## Запрещено
- `@UI.*`, `@Common.ValueList`, `@Common.Text` здесь. Их место: `app/<app>/annotations/`.
- Второй сервис ради одной сущности. Новый сервис только при другом круге пользователей (ADR).
