---
paths:
  - "app/**/annotations.cds"
  - "app/**/annotations/**/*.cds"
---
# UI-аннотации приложения (app/<app>/annotations/)

`app/<app>/annotations.cds` содержит только строки `using from './annotations/<Entity>';`. Файлы `app/<app>/annotations/<Entity>.cds` содержат `@UI.*`, `@Common.ValueList`, `@Common.Text`, `@Common.TextArrangement`.

## Перед правкой
1. `mcp__fiori-mcp__search_docs` по нужному терму: `UI.LineItem`, `UI.Facets`, `UI.DataFieldForAction`, `Common.ValueList`, criticality.
2. `mcp__cds-mcp__search_model` по сущности: точные имена элементов и ассоциаций.
3. `docs/registry/UI-ARTIFACTS.md`: какие аннотации уже заданы, чтобы не создать вторую `LineItem` без квалификатора.
4. Прочитать строки PATTERNS раздел «UI Fiori Elements».

## Правила
- Цель аннотаций всегда `CatalogService.<Entity>`, никогда `my.catalog.*`.
- Пути в аннотациях через точку: `currency.name`, не `currency/name`.
- Все `Label` через i18n: `Label: '{i18n>Products.name}'`. Ключи в `app/<app>/webapp/i18n/i18n.properties` и `i18n_ru.properties`. Если label совпадает с `@title` элемента, `Label` не указывать вовсе.
- Ассоциация на справочник: `@Common.ValueList` + `@Common.Text` + `@Common.TextArrangement: #TextOnly` на внешнем ключе, чтобы пользователь не видел UUID.
- Кнопка: `DataFieldForAction` на bound action сервиса; controller extension не для этого.
- Существующее оформление сохранять: порядок полей, квалификаторы, стиль отступов 2 пробела.
- Шаблон: `templates/annotations-ui.cds`.

## После правки
- `cds compile srv --to json` без предупреждений об аннотациях.
- Обновить `app/<app>/webapp/localService/metadata.xml`.
- `npm test` (снапшот metadata меняется осознанно), `npm run docs:registry`.
- Проверить экран: `npm run watch`, открыть FLP, при наличии Chrome DevTools MCP снять скриншот в `docs/features/<name>/VERIFICATION.md`.

## Запрещено
- `@mandatory`, `@assert.*`, `@readonly`, `@restrict` здесь. Их место: `srv/annotations/`.
- Правки `manifest.json` для того, что выражается аннотацией.
