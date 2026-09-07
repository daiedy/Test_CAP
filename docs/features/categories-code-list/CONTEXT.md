# Categories как справочник с value help: контекст

Дата: 2026-09-07. Автор: `architect`. Ветка: `feature/categories-code-list`.

## Запрос

Сейчас `Products.category` это свободный текст `String(50)`, а value help для него указывает на сам `Products` (список уже введённых значений). Нужно сделать категории настоящим справочником: сущность `Categories` на основе `sap.common.CodeList` (ADR-0003, паттерн «Справочник с выбором из списка»), ассоциация из `Products`, перенос шести существующих значений категорий из `db/data/my.catalog-Products.csv` (Electronics, Furniture, Kitchen, Stationery, Accessories, Sports) в данные справочника с русскими переводами через `localized`, value help на Object Page и в фильтрах List Report с показом названия вместо кода (`Common.Text` + `TextArrangement`), тесты бэкенда, обновление снапшота контракта, документация. Отдельная страница для ведения справочника не нужна, только value help.

## Затронутые сущности и сервисы

Результат `mcp__cds-mcp__search_model` (`Products`, `Currencies`, `CodeList`, `CatalogService`) и `docs/registry/DOMAIN-MODEL.md`, `SERVICES.md`:

| Объект | Есть сейчас | Что меняется |
|---|---|---|
| `my.catalog.Products` (`db/schema.cds`) | `category : String(50)` | `category : Association to Categories`; внешний ключ `category_code : String(20)` генерируется компилятором |
| `my.catalog.Categories` | нет | новая сущность `Categories : CodeList { key code : String(20); }` в `db/schema.cds` (тот же домен, отдельный модуль не нужен). `name`, `descr` приходят из аспекта как `localized`, компилятор создаёт `Categories.texts` |
| `CatalogService.Products` | проекция, `category @title @mandatory` в `srv/annotations/Products.cds` | `category @title @mandatory @assert.target`; в OData поле `category` (Edm.String 50) исчезает, появляются `category_code` (Edm.String 20) и NavigationProperty `category`. Осознанное изменение контракта, снапшот `test/__snapshots__/metadata.test.js.snap` обновляется |
| `CatalogService.Categories` | нет | явная проекция `@readonly entity Categories as projection on catalog.Categories`; титулы в `srv/annotations/Categories.cds`. Автоэкспозиция через `@cds.autoexpose` дала бы набор без возможности аннотировать его в `srv/annotations` (autoexposed-сущности не существуют в CSN до компиляции OData), поэтому проекция явная |
| `CatalogService.Categories_texts` | нет | появляется автоматически вместе с `Categories` (как `Currencies_texts` сегодня) |
| `CatalogService.Currencies` | autoexposed, образец CodeList | не меняется; служит образцом: `@cds.odata.valuelist` на CodeList уже даёт `Common.ValueList` для `currency_code` без единой строки в `app/` |
| `db/data/my.catalog-Products.csv` | колонка `category` с текстами | колонка `category_code` с кодами справочника |
| `db/data/my.catalog-Categories.csv`, `my.catalog-Categories.texts.csv` | нет | 6 кодов с английскими названиями; переводы `ru` |
| `app/products/annotations/Products.cds` | `category` в HeaderInfo.Description, SelectionFields, LineItem, FieldGroup#GeneralInfo; `@Common.ValueList` с `CollectionPath: 'Products'` | везде `category_code`; старый ValueList удаляется; на `category` добавляются `Common.Text: category.name`, `Common.TextArrangement: #TextOnly` (и, по решению ADR-0011, `Common.ValueListWithFixedValues`) |
| `app/products/webapp/localService/metadata.xml`, `mockdata/*.json` | снимок без `Categories`; `Products.json` 5 записей с `category` | перегенерация снимка; `Categories.json`, `Categories_texts.json`; `Products.json` с `category_code` и синхронизация с 15 записями CSV (долг из STATE) |
| `app/products/webapp/manifest.json` | List Report + Object Page на `/Products` | не меняется: новых страниц нет, value help выражается аннотациями |
| `test/catalog-service.test.js`, `test/metadata.test.js` | 7 + 2 теста, фильтр `category eq 'Kitchen'`, POST с `category: 'Furniture'` | тесты переводятся на `category_code`; добавляются тесты справочника, локализации, `@assert.target`, `@readonly`; снапшот EDMX обновляется через `npx vitest -u` |

Потребители контракта OData: только `app/products` в этом репозитории. Внешних клиентов нет.

## Что уже существует и переиспользуется

Из `docs/registry/HANDLERS.md`, `REUSE-CATALOG.md`, `UI-ARTIFACTS.md` и `search_model`:

- `sap.common.CodeList` из `@sap/cds/common`: аспект с `name : localized String(255)`, `descr : localized String(1000)`, аннотациями `@cds.autoexpose`, `@cds.odata.valuelist`, `@UI.Identification: [name]`. Переиспользуется как основа `Categories`; собственный аспект писать нельзя.
- Механизм `localized` и `sap.common.TextsAspect`: компилятор сам создаёт `Categories.texts` и ассоциацию `localized`, runtime подставляет `$user.locale` из `Accept-Language`. Никаких хендлеров для переводов.
- Существующий образец `Products.currency` → `sap.common.Currencies`: показывает, что `Common.ValueList` на внешнем ключе генерируется компилятором из `@cds.odata.valuelist` (см. `localService/metadata.xml`, строки 133–154). Для `category_code` будет то же самое.
- Существующие аннотации `srv/annotations/Products.cds` и `app/products/annotations/Products.cds`: расширяются, новых файлов для `Products` нет.
- i18n-бандлы `_i18n/i18n.properties` и `_i18n/i18n_ru.properties`: ключ `Products.category` остаётся, добавляются ключи `Categories.*`.
- Тесты `test/catalog-service.test.js` и `test/metadata.test.js`: расширяются, новые файлы не нужны.
- Хендлеров в проекте нет (`HANDLERS.md`: «вся логика декларативная»); фича их не добавляет: обязательность даёт `@mandatory`, существование цели `@assert.target`, только чтение `@readonly`.

Что было бы ошибкой писать заново: свой аспект справочника вместо `CodeList`; хендлер `before CREATE/UPDATE` для проверки кода категории вместо `@assert.target`; хендлер `after READ` для перевода названий вместо `localized`; вторую проекцию `Categories` (например, отдельную для value help); ручной `@Common.ValueList` с `CollectionPath: 'Products'` (текущий, подлежит удалению); отдельную страницу справочника в manifest.

## Применимые паттерны

Строки из `docs/architecture/PATTERNS.md`:

| Шаг | Паттерн | Статус |
|---|---|---|
| Сущность `Categories` | «Справочник с выбором из списка»: `: sap.common.CodeList` с ключом `code`, ассоциация из основной сущности (ADR-0003) | есть |
| `Products.category` | «Ссылка на другую сущность»: `Association to Target` в единственном числе | есть |
| Названия на `ru` | «Переводимые тексты данных»: `localized String(N)`, CSV `<Entity>.texts` | есть (пример в коде появится этой фичей) |
| Обязательность | «Обязательное поле»: `@mandatory` в `srv/annotations/<Entity>.cds` (ADR-0004) | есть |
| Несуществующий код | «Проверка существования цели ассоциации»: `@assert.target` | есть (пример в коде появится этой фичей) |
| `Categories` только чтение | «Только чтение»: `@readonly` на проекции в сервисе | есть |
| Value help и текст вместо кода | «Выбор значения из справочника»: `@Common.ValueList` с `CollectionPath` на CodeList, `@Common.Text` + `@Common.TextArrangement: #TextOnly` | есть, но формулировка расходится с примером: у `Products.currency_code` ValueList не написан руками, а сгенерирован из `@cds.odata.valuelist`. Уточнение вынесено в ADR-0011 |
| Представление: dropdown вместо диалога для короткого списка | нет строки | нужен ADR (ADR-0011, часть 2) |
| Формат кодов справочника | нет строки (CONVENTIONS задаёт только `UPPER_SNAKE` для `enum`) | нужен ADR (ADR-0010) |
| Колонки, фильтры, секции | «Колонки таблицы, фильтры, шапка, секции»: `@UI.*` в `app/<app>/annotations/<Entity>.cds` (ADR-0004) | есть |
| Данные | «Новая сущность»: `cds add data --filter X --records N`, затем правка значений | есть |
| Тесты | «Тест сервиса», «Контракт OData» (ADR-0002) | есть |
| Снимок для мока | «Обновление снимка metadata.xml», «UI без бэкенда» (ADR-0008) | есть |

### Проверено компиляцией (эксперимент в scratchpad, cds-dk 10.0.7, проект не менялся)

Собрана копия модели (схема и сервис в разных файлах, как в проекте) в двух вариантах UI-аннотаций.

- Вариант A, явный `@Common.ValueList` на ассоциации по `templates/annotations-ui.cds`: компилятор второй ValueList не добавляет, явный побеждает; в нём нет `Label`.
- Вариант B, только `Common.Text: category.name` и `Common.TextArrangement: #TextOnly` (плюс `Common.ValueListWithFixedValues: true`): компилятор генерирует `Common.ValueList` на `category_code` с `Label` из `@title`, `CollectionPath: 'Categories'`, параметрами `InOut category_code ↔ code` и `DisplayOnly name`, то есть байт в байт как у `currency_code` сегодня.
- В обоих вариантах `@Common.Text` с ассоциации копируется на `category_code` как `Path="category/name"` с вложенным `UI.TextArrangement TextOnly`. `@readonly` на проекции даёт `Capabilities.Insert/Update/DeleteRestrictions` на `EntityContainer/Categories`. Внешний ключ `category_code` получает `Edm.String MaxLength="20"`. Появляются наборы `Categories` и `Categories_texts`. Предупреждений компилятора нет.
- `cds add data --filter Categories --records 6` создаёт оба файла `my.catalog-Categories.csv` и `my.catalog-Categories.texts.csv`, но с разделителем `,` и случайными локалями (`ru`, `hu`, ...). Проект требует `;` и только `ru`, поэтому после генерации нужна ручная правка.

## Релевантные уроки

Из `docs/LESSONS.md`:

- «Титулы элементов живут на проекции, а не на db-сущности» (2026-09-07): `@title` для `Categories.code/name/descr` ставится на `CatalogService.Categories` в `srv/annotations/Categories.cds`; отсюда и необходимость явной проекции.
- «`sap.ui.core.util.MockServer` не поддерживает OData V4» (2026-09-07): мок ждёт `<EntitySet>.json` с массивом; `generateMockData: true` сгенерирует мусор для `Categories` и `Categories_texts`, если файлов не будет. Файлы нужно положить.
- «CAP MCP компилирует все `.cds` проекта, включая `templates/`» (2026-09-07): `search_model` по имени `Categories` находит шаблонные `my.catalog.tpl.*.Categories`; при сверке имён брать `my.catalog.Categories` и `CatalogService.Categories`.
- «`run_manifest_validation` UI5 MCP 0.2.18 падает» (2026-09-07): не актуально, manifest в этой фиче не меняется.
- Раздел «Открытый долг» STATE: «Мок-данные `Products.json` содержат 5 записей ... синхронизировать с `db/data` CSV при следующем изменении модели». Это изменение модели, долг закрывается здесь.

## Экраны (если есть UI)

Автор: `ux-designer`, 2026-09-07. Входные данные architect (существующие страницы, 6 фиксированных значений, `TextOnly`, локали `en`/`ru`, без новых ключей в `webapp/i18n`) учтены; отклонения от PLAN перечислены в конце раздела.

Floorplan: существующие List Report `ProductsList` и Object Page `ProductsObjectPage` на `/Products` (`docs/registry/UI-ARTIFACTS.md`). Новых страниц, фрагментов, controller extension и правок `manifest.json` нет. Одна задача пользователя: найти товар по категории и задать категорию товару. Свободный UI5 не нужен: всё выражается аннотациями.

### Гайдлайны, на которые опирается дизайн

Из `mcp__fiori-mcp__search_docs` (снапшот документации SAPUI5 / SAP Fiori elements; полный URL топика `https://ui5.sap.com/#/topic/<id>`, в снапшоте MCP id усечён до 7 символов):

| Источник | Что говорит | Где применено |
|---|---|---|
| «Value Help as a Dropdown or Radio Button List» (топик `2a0a630`) | `Common.ValueListWithFixedValues: true` рендерит поле выпадающим списком (ComboBox, в фильтре MultiComboBox для нескольких значений); порог по количеству значений задан только для радиокнопок (≤ 8); фиксированный список не показывает «недавно введённые значения»; для фильтра `AllowedExpressions: 'MultiValue'` при необходимости ограничить выражения | решение «выпадающий список» ниже |
| «Field Help (SAP Fiori elements for OData V4)» | «если сущность value help даёт только фиксированные значения, поле рендерится выпадающим списком»; type-ahead и колонки диалога управляются `UI.Importance` | поведение фильтра и поля |
| «Value Help Dialog» (топик `fccb255`), шаг 1 и 5 | заголовок диалога: label DataField → `Common.Label` свойства → `Label` из ValueList; в таблице диалога параметр не показывается отдельной колонкой, если его значение уже показано через `Common.Text` другой колонки; текст ключа берётся из `Common.Text` на сущности value help | запасной вариант «диалог»; требование `Common.Text` на `Categories.code` |
| «Text and Text Arrangement» и «Field Annotation Patterns (OData V4)» | `Common.Text` + `TextArrangement: #TextOnly` показывают только текст в таблице, шапке и форме | колонка, шапка, поле |
| «Input with Value Help» (FPM Explorer, Field → Input with Value Help) | dropdown с `ValueListWithFixedValues` показывает ключ и описание по `TextArrangement` поля; `ValueListForValidation` не нужен, если проверка есть на сервере | элементы списка без кодов |
| SAP Fiori Design Guidelines (не из MCP, по памяти, проверить при ревью): https://experience.sap.com/fiori-design-web/value-help-dialog/, https://experience.sap.com/fiori-design-web/multi-combo-box/, https://experience.sap.com/fiori-design-web/select/ | диалог value help предназначен для больших наборов, где нужен поиск и условия; короткий стабильный список выбирают из выпадающего списка (для Select ориентир «меньше 12 значений») | обоснование ADR-0011, часть 2 |
| `get_guidelines` UI5 MCP | только стандартные контролы, биндинги и i18n, без inline-скриптов и кастомного CSS | тема и стиль |
| Скилл `ui5-best-practices-accessibility` (labeling, keyboard, reading-order) | подписи, порядок чтения, фокус и клавиатура | чеклист доступности |

### Решение по представлению: выпадающий список, не диалог

Рекомендация: `Common.ValueListWithFixedValues: true` на ассоциации `category` (ADR-0011, часть 2, принять). Причины:

1. Набор из 6 значений фиксирован, ведётся разработчиками через CSV, `Categories` объявлена `@readonly`, экрана ведения нет. Это ровно критерий «fixed, stable set of values» из гайдлайна «Value Help as a Dropdown»; порог по числу значений гайдлайн не задаёт, 6 укладывается в любой разумный.
2. Диалог value help стоит пользователю двух лишних шагов (открыть, подтвердить) и приносит поиск, фильтры и вкладку условий, которые для 6 значений бессмысленны. Выпадающий список открывается одним нажатием, фильтруется по вводу и закрывается выбором.
3. В фильтре List Report выпадающий список даёт множественный выбор из коробки (MultiComboBox по гайдлайну): «Kitchen» и «Furniture» одновременно, без вкладки «Define Conditions».
4. Диалог показал бы колонку кода (`ELECTRONICS`) как параметр `InOut`, что противоречит требованию «код никогда»; скрыть его можно только дополнительной аннотацией (см. ниже), тогда как в выпадающем списке с `TextOnly` кода нет по построению.
5. Радиокнопки (`ValueListShowValuesImmediately`) отклонены: не поддерживают `TextArrangement`, в фильтре неудобны, не дают множественного выбора; ADR-0011 это уже фиксирует.

Что теряется и почему это приемлемо: история недавно введённых значений (для 6 значений не нужна); вкладка условий и «Exclude» в фильтре (для категорий не требуется); кэширование содержимого диалога (список из 6 строк загружается одним запросом `GET /Categories`).

Запасной вариант, если пользователь отклонит часть 2 ADR-0011: диалог value help, как у валюты. Тогда обязательна аннотация `Common.Text: name` и `Common.TextArrangement: #TextOnly` на `CatalogService.Categories.code` (см. «Обязательное дополнение» ниже), чтобы таблица диалога содержала одну колонку с названиями: по шагу 5 гайдлайна «Value Help Dialog» колонка `name` (`DisplayOnly`) при этом сворачивается в колонку ключа. Заголовок диалога берётся из label поля «Category» / «Категория», отдельный ключ i18n не нужен.

### Обязательное дополнение к плану: `Common.Text` на `Categories.code`

Проверено `mcp__cds-mcp__search_model` по `CatalogService.Currencies`: у образца `@Common.Text: name` стоит прямо на элементе `code`, и приходит он из определения `sap.common.Currencies` в `@sap/cds/common`, а не из аспекта `CodeList`. У новой `Categories : CodeList { key code }` такой аннотации на `code` не будет. Между тем именно `Common.Text` ключа сущности value help определяет текст элементов выпадающего списка и колонок диалога (гайдлайн «Value Help Dialog», шаг 5; «Text handling and sorting for dropdowns follow the Value Help Dialog logic» из «Value Help as a Dropdown»). Без неё список покажет `ELECTRONICS`, а не «Electronics», при любом `TextArrangement` на `Products.category`.

Требование к реализации (слой представления, ADR-0004): новый файл `app/products/annotations/Categories.cds` с аннотацией элемента `code` проекции `CatalogService.Categories`: `Common.Text: name`, `Common.TextArrangement: #TextOnly`; строка `using from './annotations/Categories';` в `app/products/annotations.cds`. Это добавляет файл к шагу 9 PLAN (или отдельный шаг 9а); architect обновляет план. `fiori-app-dev` проверяет в EDMX: на `Categories/code` есть `Common.Text Path="name"` с вложенным `UI.TextArrangement TextOnly`, на `Products/category_code` есть `Common.ValueListWithFixedValues Bool="true"` (компилятор копирует аннотации ассоциации на внешний ключ, как `@title` и `@mandatory` у `currency_code`; если `ValueListWithFixedValues` не скопировалась, это вопрос architect, а не повод аннотировать `category_code` вторым способом).

### Экран 1. List Report «Products» (`ProductsList`)

Заголовок и подзаголовок без изменений: `UI.HeaderInfo.TypeNamePlural` «Products» / «Товары» в заголовке таблицы, заголовок страницы из `appTitle`.

Фильтры (`UI.SelectionFields`, порядок как сейчас, 3 из допустимых 5): `name`, `category_code`, `price`.

| Свойство фильтра «Category» | Поведение |
|---|---|
| Подпись | «Category» / «Категория» из `Products.category` (`@title` ассоциации копируется на `category_code`) |
| Контрол | выпадающий список с множественным выбором (в документации: MultiComboBox; в FE V4 это `FilterField` с фиксированным списком). Никаких `FilterRestrictions` не добавлять: по умолчанию допустимы несколько значений, а вкладка условий для фиксированного списка не показывается |
| Элементы списка | 6 названий на языке пользователя, без кодов; ввод текста сужает список; порядок элементов см. «Порядок значений» |
| Выбранное значение | токен с названием («Kitchen» / «Кухня»), не код. Несколько токенов объединяются через OR: «Kitchen» + «Sports» дают 4 товара |
| Пустое значение | фильтр не задан, таблица не ограничивается; плейсхолдера и специального текста нет |
| Значение по умолчанию | нет (`Common.FilterDefaultValue` не задаём: каталог должен открываться полным) |
| «Adapt Filters» | поле «Category» присутствует в списке под тем же label; скрытие пользователем допустимо |

Колонки таблицы (`UI.LineItem`, порядок важности как сейчас, 4 из допустимых 7): `name`, `category_code` → показывается `category.name` (`TextOnly`), `price` с валютой, `stock`. Заголовок колонки «Category» / «Категория». Ширина и перенос стандартные. Критичности и цветовой кодировки у категории нет и не планируется: это классификация, а не статус.

Действия: не меняются (тулбар и строка таблицы как сейчас; новых `DataFieldForAction` нет). Навигация по строке на Object Page как сейчас.

Пустые состояния и ошибки:

- Фильтр выбрал категорию без товаров (сейчас таких нет, но возможно после удаления): стандартное сообщение таблицы FE «No data found. Try adjusting the filter settings» / русский эквивалент из бандла UI5; свой текст не вводим.
- Ячейка «Category» у товара без категории (возможно только для данных, созданных в обход `@mandatory`, например моком): пустая ячейка, без прочерка и без текста.
- `GET /Categories` не удался (бэкенд недоступен): список пуст, FE показывает стандартную ошибку запроса в message popover; консоль без необработанных ошибок. Свой обработчик не пишем.
- Сортировка и группировка по колонке «Category» через настройки таблицы идут по `category_code`, то есть по коду, а не по переведённому названию. Для `en` порядок кодов совпадает с алфавитом названий, для `ru` нет. Принимается как известное ограничение (6 значений); `ui-verifier` фиксирует факт, не чинит.

### Экран 2. Object Page «Product» (`ProductsObjectPage`)

Шапка (`UI.HeaderInfo`): Title = `name`, Description = `category_code` → название категории (`TextOnly`), ImageUrl = `imageUrl`. `editableHeaderContent: false` остаётся: категория в шапке только для чтения, редактируется в секции.

Секции (`UI.Facets`, без изменений): «General Information» (`name`, `description`, `category_code`, `imageUrl`), «Pricing & Stock» (`price`, `currency_code`, `stock`), «Administrative Data» (managed-поля). Порядок полей в «General Information» сохраняется: категория третьей, после описания.

| Поле «Category» в секции «General Information» | Поведение |
|---|---|
| Режим просмотра | текст «Electronics» / «Электроника»; ни кода, ни скобок |
| Режим редактирования | выпадающий список с одиночным выбором (ComboBox), подпись «Category» с маркером обязательности (`@mandatory` → `FieldControl: Mandatory`); значок открытия списка справа; ввод текста сужает список |
| Элементы списка | 6 названий на языке пользователя, без кодов |
| Ввод текста, которого нет в списке | стандартная клиентская проверка поля FE: состояние ошибки с текстом фреймворка; сохранение блокируется до исправления. Серверная проверка `@assert.target` остаётся страховкой для API и в UI с выпадающим списком недостижима |
| Пустое значение при сохранении | стандартная ошибка обязательного поля FE на клиенте; если запрос всё же ушёл, сервер отвечает 400 по `@mandatory`, FE показывает сообщение в message popover и подсвечивает поле |
| После сохранения | поле и Description в шапке показывают новое название |

Риск, унаследованный из PLAN: `Products` не draft-enabled, `sap.fe.templates.ObjectPage` для non-draft сущностей в V4 поддерживается, но `mcp__fiori-mcp__search_docs` по «non-draft» вернул только материалы для OData V2, так что доступность кнопки «Edit» на этой странице не подтверждена MCP. `ui-verifier` проверяет первым; если кнопки нет, сценарий редактирования фиксируется как долг в `VERIFICATION.md` и `STATE.md`, а value help остаётся проверяемым в фильтре List Report. Включать draft в этой фиче нельзя (отдельная фича и ADR).

### Что видит пользователь вместо кода (`TextArrangement`)

| Место | Что показано | Чем обеспечено |
|---|---|---|
| Колонка таблицы List Report | название | `Common.Text: category.name` + `#TextOnly` на `Products.category`, скопировано на `category_code` |
| Токен фильтра | название | то же плюс `Common.Text` на `Categories.code` |
| Элементы выпадающего списка (фильтр и форма) | название | `Common.Text: name` + `#TextOnly` на `Categories.code` |
| Description в шапке Object Page | название | `Common.Text` на `Products.category` |
| Поле в форме, просмотр и редактирование | название | то же |
| Колонки диалога value help (запасной вариант) | одна колонка «Category» с названиями | `Common.Text` + `#TextOnly` на `Categories.code`, колонка `name` сворачивается по шагу 5 гайдлайна |
| Настройки таблицы: сортировка, группировка, выбор колонок | label «Category», сортировка по коду | ограничение, см. выше |
| URL и app state List Report после фильтрации, запросы OData | код (`category_code eq 'KITCHEN'`) | ожидаемо, пользователю не показывается |
| Текст ошибки сервера (`@assert.target`, `@mandatory`) | код или имя поля в тексте CAP | в UI с выпадающим списком недостижимо |

### Порядок значений в списке

Явной сортировки у сгенерированного ValueList нет (`PresentationVariantQualifier` потребовал бы ручного `Common.ValueList`, что противоречит части 1 ADR-0011). Список приходит в порядке сервера, который для SQLite обычно совпадает с порядком строк CSV, но не гарантирован. Рекомендация `cap-backend-dev` (шаг 4): записать `my.catalog-Categories.csv` в алфавитном порядке английских названий: Accessories, Electronics, Furniture, Kitchen, Sports, Stationery. Для `ru` порядок получится неалфавитным (Аксессуары, Электроника, Мебель, Кухня, Спорт, Канцелярия); для 6 значений это приемлемо. Сортировка по переведённому названию, если понадобится, это отдельное решение с ручным ValueList и `UI.PresentationVariant` на `Categories`.

### Локали и отсутствие перевода

- Подписи: «Category» / «Категория» из `_i18n` через `@title`; тексты списка, диалога, сообщений об ошибках и пустой таблицы из бандлов UI5 и FE, локализуются фреймворком по `sap-ui-language`.
- Названия категорий: `Categories.name` через `localized`; UI5 передаёт `Accept-Language` из `sap-ui-language`, сервер отдаёт `ru` из `Categories.texts`.
- Нет перевода для локали пользователя (например, `de`, или в `texts.csv` пропущена строка): CAP подставляет текст языка по умолчанию, то есть английское `name` из базового CSV (`https://cap.cloud.sap/docs/guides/localized-data`, раздел о разрешении локализованных текстов; `mcp__cds-mcp__search_docs` дизайнеру недоступен, проверить тестом). Пользователь видит «Kitchen», никогда код. Предложение `test-backend`: добавить к тесту «returns localized category names» запрос с `Accept-Language: de` и ожиданием английского названия; в критерии PLAN этого нет, решает architect.
- Смешение языков в одном списке (часть названий переведена, часть нет) допустимо только как временное состояние данных; в этой фиче все 6 переводов обязательны, паритет проверяет `cap-backend-dev` в шаге 4.

### Нужна ли страница ведения справочника

Нет, подтверждаю решение плана. Справочник фиксирован, `@readonly`, ведётся через CSV, 6 значений; страница ведения противоречила бы `@readonly` и добавила бы маршрут в `manifest.json` без пользовательской задачи. Если категории когда-нибудь станут ведомыми пользователем, это отдельная фича: снять `@readonly`, включить draft на `Categories`, добавить List Report через Fiori MCP, и по критерию ADR-0011 (часть 2) вернуть категориям диалог value help вместо выпадающего списка, поскольку набор перестанет быть фиксированным.

### Заключение по открытым вопросам PLAN, касающимся UI

1. Формат кодов (ADR-0010). На экран не влияет: код не показывается ни в одном из мест таблицы выше, а при отсутствии перевода подставляется английское название, не код. Код виден только в URL/app state, запросах OData, тестах и текстах серверных ошибок, которые в UI с выпадающим списком недостижимы. Выбор между `ELECTRONICS` и `Electronics` остаётся за бэкендом; с точки зрения UX возражений против UPPER_SNAKE нет.
2. Источник ValueList (ADR-0011, часть 1). Для пользователя оба варианта неразличимы: заголовок диалога и подпись поля берутся из `Common.Label`, колонки и текст элементов из `Common.Text` на `Categories.code`, а не из самого ValueList. Рекомендация: автогенерация из `CodeList` (как у валюты) плюс обязательное дополнение `Categories.cds` выше. Единственный сценарий, где нужен ручной ValueList, это сортировка списка по названию через `PresentationVariantQualifier`; в этой фиче он не требуется.
3. Представление (ADR-0011, часть 2). Выпадающий список, обоснование в разделе «Решение по представлению». Паттерн утверждает пользователь.

### Тема и стиль

Тема `sap_horizon` (`webapp/index.html`, `test/flpSandbox.html`), только стандартные контролы FE, без кастомного CSS, цветов и иконок для категорий. Критичность (`UI.Criticality`) к категории не применяется.

### Доступность: чеклист `ui5-best-practices-accessibility`

Собственных XML-вью и контроллеров фича не добавляет, поэтому все восемь тем закрываются стандартными контролами; `ui-verifier` проверяет результат, а не код.

| Тема | Даёт FE и стандартные контролы | Проверяет `ui-verifier` (Chrome DevTools MCP, дерево доступности, клавиатура) |
|---|---|---|
| Landmarks | DynamicPage List Report и ObjectPageLayout выставляют роли и подписи регионов | ничего дополнительно |
| Labeling | подпись «Category» связана с полем фильтра и полем формы (`labelFor` / `aria-labelledby`), маркер и `aria-required` из `FieldControl: Mandatory`, у списка роль `combobox` с `aria-expanded` и `listbox`, у диалога (запасной вариант) заголовок «Category» | в дереве доступности поле фильтра и поле формы объявляются как «Category» (в `ru` «Категория»), обязательное поле формы объявлено как required; элементы списка читаются названиями, не кодами; токен в фильтре читается названием |
| Heading levels | уровни заголовков страницы, таблицы и секций задаёт FE | ничего дополнительно |
| Focus & keyboard | открытие списка `F4` или `Alt+Down`, перемещение стрелками, выбор `Enter` (в фильтре `Space` переключает пункт, `Backspace` удаляет токен), закрытие `Esc`; порядок табуляции равен DOM; `F6` переключает группы «фильтры / таблица», на Object Page секции | сценарий только с клавиатуры: `Tab` до фильтра «Category», `Alt+Down`, `Down`, `Enter`, `Enter` на «Go», таблица обновилась; на Object Page `Edit`, `Tab` до «Category», выбор стрелками и `Enter`, сохранение; фокус после закрытия списка остаётся в поле |
| Keyboard shortcuts | новых кнопок нет | ничего дополнительно |
| Invisible messaging | обновление таблицы после фильтра и ошибки валидации объявляют MDC-контролы FE | после применения фильтра и при ошибке обязательного поля скринридер получает объявление; если фреймворк молчит, фиксировать как ограничение FE, не дописывать `InvisibleMessage` |
| Reading order | DOM-порядок совпадает с визуальным: подпись перед полем, фильтры перед таблицей, шапка перед секциями | ничего дополнительно |
| Target size | стандартные размеры полей, токенов и элементов списка | ничего дополнительно |

Дополнительно: прогон в `sap_horizon_hcb` не требуется этой фичей, но если `ui-verifier` делает скриншоты в двух темах, категорийные тексты должны оставаться читаемыми без кастомных цветов (их нет).

### Тексты i18n

Новых ключей в `app/products/webapp/i18n/*` нет: подписи приходят из `_i18n` через `@title`, тексты списка, диалога, пустой таблицы и ошибок валидации из бандлов UI5/FE. Заголовок диалога value help (запасной вариант) равен label поля, ключ не нужен. Для пустого значения ключ не нужен: пустая ячейка и незаполненный фильтр без текста, это стандарт FE.

`_i18n/i18n.properties` и `_i18n/i18n_ru.properties` (labels модели, ключи `<Entity>.<element>` по `CONVENTIONS.md`):

| Ключ | en | ru | Где виден |
|---|---|---|---|
| `Products.category` (есть) | Category | Категория | фильтр, колонка, поле формы, заголовок диалога |
| `Categories.code` | Category | Категория | заголовок единственной колонки диалога value help и type-ahead; в `$metadata`. Отклонение от PLAN («Category Code»): с `TextOnly` на `code` в этой колонке стоят названия, заголовок «Category Code» над «Electronics» ввёл бы в заблуждение |
| `Categories.name` | Category Name | Название категории | только `$metadata` (колонка сворачивается в колонку кода) |
| `Categories.descr` | Category Description | Описание категории | только `$metadata`, поле не заполняется |

Названия категорий это данные, не i18n-ключи (`db/data/my.catalog-Categories.csv` и `my.catalog-Categories.texts.csv`, шаг 4 PLAN):

| Код | `name` en | `name` ru |
|---|---|---|
| `ACCESSORIES` | Accessories | Аксессуары |
| `ELECTRONICS` | Electronics | Электроника |
| `FURNITURE` | Furniture | Мебель |
| `KITCHEN` | Kitchen | Кухня |
| `SPORTS` | Sports | Спорт |
| `STATIONERY` | Stationery | Канцелярия |

Порядок строк алфавитный по `en` (см. «Порядок значений»); коды по ADR-0010, при ином решении по ADR-0010 меняется только колонка «Код».

### Сценарии для `ui-verifier` сверх критериев PLAN

1. Элементы выпадающего списка в фильтре и в форме показывают названия, не коды, в `en` и `ru`. Если видны коды, причина в отсутствии `Common.Text` на `Categories.code` (см. «Обязательное дополнение»).
2. В фильтре выбраны «Kitchen» и «Sports»: 4 товара, два токена с названиями, запрос содержит `category_code eq 'KITCHEN' or category_code eq 'SPORTS'`.
3. У фильтра нет вкладки условий и кнопки открытия диалога; на Object Page нет диалога, только список.
4. Клавиатурный сценарий из чеклиста доступности в обеих страницах.
5. Дерево доступности: подпись, required, роль combobox, тексты элементов.

### Отклонения от PLAN и что должен обновить architect

- Новый файл `app/products/annotations/Categories.cds` и строка `using` в `app/products/annotations.cds` (шаг 9 или 9а), проверка EDMX на `Categories/code` и `Products/category_code`.
- Значение ключа `Categories.code`: «Category» / «Категория» вместо «Category Code» / «Код категории».
- Порядок строк в `my.catalog-Categories.csv`: алфавитный по английскому названию.
- Необязательное: тест на fallback локали (`Accept-Language: de`).
- Критерий UI PLAN «фильтр открывает value help со списком из 6 названий» уточняется: выпадающий список с множественным выбором, без диалога.

## Открытые вопросы

Закрыты 2026-09-07 решениями пользователя (переданы оркестратором): ADR-0010 и ADR-0011 приняты, тесты UI входят в фичу, мок-данные синхронизируются с CSV, `Categories.code` = «Category» / «Категория». Дополнения `ux-designer` из раздела «Экраны» внесены в план. См. `PLAN.md`, раздел «Решения пользователя (2026-09-07)».
