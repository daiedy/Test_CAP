# ADR-0004: Разделение аннотаций на семантику и представление, labels через i18n

Дата: 2026-09-07. Статус: принято.

## Контекст
Аннотации лежали в `srv/annotations/Products/{ui,valuehelps,constraints}.cds` с захардкоженными английскими labels, а `@title` в `db/schema.cds`. Fiori tools и Fiori MCP ожидают UI-аннотации в папке приложения (`app/<app>/annotations.cds`), а команда CAP рекомендует держать Fiori-аннотации вне определений сервисов.

## Решение
- `srv/annotations/<Entity>.cds`: семантика данных, одинаковая для всех клиентов: `@title` через i18n, `@mandatory`, `@assert.*`, `@readonly`, `@Measures.ISOCurrency`.
- `app/<app>/annotations/<Entity>.cds`: представление конкретного приложения: `@UI.*`, `@Common.ValueList`, `@Common.Text`, `@Common.TextArrangement`. Точка входа `app/<app>/annotations.cds` только с `using from`.
- В `db/schema.cds` аннотаций нет. Все тексты через `_i18n/` и `webapp/i18n/`, en по умолчанию, ru перевод.

## Альтернативы
| Вариант | Почему отклонён |
|---|---|
| Всё в `srv/annotations/<Entity>/` (как было) | Fiori tools и MCP пишут в `app/`; два приложения на один сервис получат конфликт UI-аннотаций |
| Всё в `app/` включая `@mandatory` | Валидация относится к данным, а не к экрану; второй клиент её потеряет |
| Одна папка `app/<app>/annotations.cds` без деления по сущностям | Файл растёт с каждой сущностью, конфликтуют правки агентов |

## Последствия
- Существующие аннотации перенесены, русские labels из старого снимка `metadata.xml` заменены ключами i18n.
- Правила `.claude/rules/srv-services.md` и `ui-annotations.md` запрещают аннотации «не в своём» файле.
- Снимок `metadata.xml` регенерируется после любой правки аннотаций.

## Источники
- https://github.com/capire/skills (cap-developer: «Keep Fiori UI annotations in app/»)
- https://github.com/SAP/open-ux-tools/tree/main/packages/fiori-mcp-server
