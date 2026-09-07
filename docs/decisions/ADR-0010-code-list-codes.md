# ADR-0010: Коды пользовательских справочников

Дата: 2026-09-07. Статус: принято (пользователь, 2026-09-07, фича `categories-code-list`).

## Контекст
Фича `categories-code-list` (`docs/features/categories-code-list/`) вводит первый собственный справочник проекта `my.catalog.Categories : sap.common.CodeList` с ключом `code`. Существующие значения категорий в `db/data/my.catalog-Products.csv` это отображаемые тексты (`Electronics`, `Furniture`). ADR-0003 и `CONVENTIONS.md` требуют CodeList с ключом `code`, но не задают формат и длину кода; `UPPER_SNAKE` в CONVENTIONS относится только к `enum`. Без правила следующий справочник (например, статусы или единицы измерения) получит другой формат кодов. Шаблон `templates/entity.cds` уже использует `key code : String(20)`.

## Решение
Ключ собственных справочников проекта объявляется как `key code : String(20)`. Значения кодов: латиница в верхнем регистре, цифры и подчёркивание (`ELECTRONICS`, `HOME_OFFICE`), стабильные на всё время жизни данных, не переводятся и не показываются пользователю: интерфейс показывает `name` через `Common.Text` и `TextArrangement: #TextOnly` (ADR-0011). Отображаемые названия живут в `name` (en в базовом CSV, переводы в `<Entity>.texts.csv`). Справочники из `@sap/cds/common` и `@sap/cds-common-content` (`Currencies`, `Countries`, `Languages`) сохраняют свои ISO-коды, правило на них не распространяется. В коде и тестах коды используются как литералы (`category_code eq 'KITCHEN'`). Первое применение: `Categories` с кодами `ACCESSORIES`, `ELECTRONICS`, `FURNITURE`, `KITCHEN`, `SPORTS`, `STATIONERY`.

## Альтернативы
| Вариант | Почему отклонён |
|---|---|
| Код равен отображаемому тексту (`Electronics`) | Код становится похож на текст и провоцирует показывать и «править» его; переименование категории потребует замены ключа во всех товарах и текстах; расходится с `UPPER_SNAKE` для `enum`, хотя роль та же |
| UUID через `cuid` | CodeList в CAP и Fiori рассчитан на семантический `code`; CSV, URL и сообщения `@assert.target` становятся нечитаемыми; value help показывает UUID при отсутствии текста |
| Числовые коды (`1`, `2`) | Ничего не говорят в CSV и тестах; порядок добавления превращается в смысл |
| Без длины или `String(10)` | CONVENTIONS требуют длину у строк; 10 символов мало для составных кодов вроде `HOME_OFFICE` |

## Последствия
- `CONVENTIONS.md`, раздел 3: строка о справочниках дополняется форматом кода (выполняет `docs-keeper` в фазе документации фичи).
- `PATTERNS.md`, строка «Справочник с выбором из списка»: пример `Categories`, упоминание формата кода.
- `templates/entity.cds` соответствует решению без изменений.
- Данные `my.catalog-Products.csv` при первой миграции переводятся на коды; последующие справочники следуют правилу без обсуждения.

## Источники
- https://cap.cloud.sap/docs/cds/common#code-lists
- https://cap.cloud.sap/docs/guides/domain/ (Domain Modeling)
- ADR-0003; `docs/features/categories-code-list/CONTEXT.md` и `PLAN.md` (решения пользователя от 2026-09-07)
