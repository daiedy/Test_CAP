# ADR-0011: Value help для ассоциаций на CodeList

Дата: 2026-09-07. Статус: принято (пользователь, 2026-09-07, обе части, фича `categories-code-list`).

Два независимых решения; приняты оба.

## Контекст
Строка «Выбор значения из справочника» в `PATTERNS.md` и шаблон `templates/annotations-ui.cds` предписывают писать `@Common.ValueList` руками, но единственный пример в коде (`Products.currency_code`) ValueList не содержит: его генерирует компилятор из `@cds.odata.valuelist`, который несёт аспект `sap.common.CodeList`. Эксперимент при планировании `categories-code-list` (cds-dk 10.0.7, см. `docs/features/categories-code-list/CONTEXT.md`, «Проверено компиляцией») показал: явная аннотация компилируется и «побеждает» автогенерацию, но дублирует десять строк и теряет `Label`; без явной аннотации компилятор создаёт ValueList с `Label` из `@title`, `CollectionPath` на проекцию справочника и параметрами `InOut code`, `DisplayOnly name`; `Common.ValueListWithFixedValues` с ассоциации копируется на внешний ключ. Гайдлайн Fiori Elements «Value Help as a Dropdown» рекомендует для фиксированного стабильного набора значений выпадающий список вместо диалога; у проекта не было строки, когда выбирать какое представление. `ux-designer` дополнительно установил (`search_model` по `CatalogService.Currencies`): у `sap.common.Currencies` аннотация `@Common.Text: name` стоит на элементе `code` в самом определении из `@sap/cds/common`, аспект `CodeList` её не даёт, поэтому у собственного справочника без такой аннотации элементы списка и колонки диалога показывают код.

## Решение

Часть 1, источник ValueList. Для ассоциации на сущность, основанную на `sap.common.CodeList` (собственную или из `@sap/cds/common`), `@Common.ValueList` руками не пишется: его даёт `@cds.odata.valuelist` аспекта, а `Label` берётся из `@title` элемента в `srv/annotations`. В `app/<app>/annotations/<Entity>.cds` на ассоциации остаются только аннотации представления: `Common.Text: <assoc>.name`, `Common.TextArrangement: #TextOnly` и флаги вроде `Common.ValueListWithFixedValues`. Для собственного справочника дополнительно создаётся `app/<app>/annotations/<CodeList>.cds` с `Common.Text: name` и `Common.TextArrangement: #TextOnly` на ключе `code` (у `Currencies` это уже есть в `@sap/cds/common`), чтобы элементы списка и колонки диалога показывали название. Явный `@Common.ValueList` допустим только для целей, не основанных на CodeList, или когда нужны дополнительные параметры (`In`/`Out` на другие поля, `ValueListParameterConstant`, `PresentationVariantQualifier` для сортировки); тогда он пишется по шаблону, и в EDMX всё равно должен остаться один ValueList на свойство.

Часть 2, представление. Справочник, который ведётся разработчиками через CSV и не имеет экрана ведения (фиксированный стабильный набор), получает `Common.ValueListWithFixedValues: true` на ассоциации: поле рендерится выпадающим списком (в фильтре с множественным выбором, в форме с одиночным). Справочники, которые растут, ведутся пользователями или содержат сотни значений (`Currencies`, `Countries`), остаются с диалогом value help по умолчанию. Если справочник получает экран ведения, он теряет фиксированность и возвращается к диалогу. Радиокнопки (`ValueListShowValuesImmediately`), `FilterRestrictions`, `FilterDefaultValue` и `ValueListForValidation` не используются.

Первое применение: `Products.category` → `Categories` (`app/products/annotations/Products.cds`, `app/products/annotations/Categories.cds`).

## Альтернативы
| Вариант | Почему отклонён |
|---|---|
| Явный `@Common.ValueList` для всех справочников (прежняя формулировка паттерна) | Дублирует вывод компилятора, теряет `Label`, расходится с единственным существующим примером; при изменении справочника нужно править два места |
| Диалог value help для всех справочников | Для 6 фиксированных категорий диалог тяжелее выпадающего списка и показывает колонку кода как параметр `InOut`; гайдлайн Fiori прямо рекомендует dropdown для фиксированных значений |
| Числовой порог (например, ≤ 20 значений) для dropdown | Гайдлайн такого порога не задаёт (число ≤ 8 относится только к радиокнопкам); критерий «стабильный набор без экрана ведения» проверяется по коду, а не по данным |
| Радиокнопки для очень коротких списков | Требуют `mandatory`, не поддерживают `TextArrangement`, не дают множественного выбора в фильтре |
| `Common.ValueListForValidation` на клиенте | Проверку существования кода уже делает `@assert.target` на сервере; с выпадающим списком ввод несуществующего значения недостижим |
| `Common.Text` на `code` в `srv/annotations/<CodeList>.cds` | Это представление, а не семантика данных: по ADR-0004 место в `app/` |

## Последствия
- `PATTERNS.md`, строка «Выбор значения из справочника»: переписать: «`Common.Text` + `Common.TextArrangement: #TextOnly` на ассоциации и на ключе собственного справочника (`app/<app>/annotations/<CodeList>.cds`); ValueList генерируется из CodeList; `Common.ValueListWithFixedValues: true` для фиксированных справочников без экрана ведения», пример `Products.category_code`.
- `templates/annotations-ui.cds`: убрать явный `Common.ValueList` из блока `category`, оставить `Text`, `TextArrangement`, `ValueListWithFixedValues`; добавить блок аннотации `Categories.code`.
- `.claude/rules/ui-annotations.md`: строка про ассоциацию на справочник дополняется словами «ValueList руками не писать для CodeList; `Common.Text` на ключе справочника» (файл защищён, правится по отдельному запросу пользователя).
- Reviewer считает дубликатом ручной `@Common.ValueList` на внешнем ключе к CodeList.
- Известное ограничение: сортировка и группировка по такой колонке идут по коду; сортировка по переведённому названию потребует явного ValueList с `PresentationVariantQualifier` (исключение из части 1).

## Источники
- https://cap.cloud.sap/docs/advanced/fiori#cds-odata-valuelist («Simple Value Helps», `@cds.odata.valuelist`)
- SAP Fiori elements, «Value Help as a Dropdown or Radio Button List», «Field Help (OData V4)», «Value Help Dialog», через `mcp__fiori-mcp__search_docs`
- Эксперимент и раздел «Экраны»: `docs/features/categories-code-list/CONTEXT.md`; решения пользователя: `PLAN.md` той же фичи
- ADR-0003, ADR-0004
