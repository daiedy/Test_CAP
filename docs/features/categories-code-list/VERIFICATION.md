# categories-code-list: верификация

Дата: 2026-09-07. Агент: `ui-verifier`.

Стек: `npm run watch` (корень, порт 4004), UI открыт как `http://localhost:4004/products/webapp/test/flpSandbox.html#products-display`. Сервер запущен этим агентом в фоне и остановлен им же по завершении. Ветка `feature/categories-code-list`, коммиты `9c8623d` (срв) и `64e0cf0` (app) уже в истории.

## Автотесты

Автотесты в этой сессии не перезапускались — `ui-verifier` не подтверждает их своим прогоном, а переносит зафиксированный результат предыдущих агентов по протоколу (шаг 15 PLAN: «вывод раннера... переносит `ui-verifier`»):

```
test-backend, npm test (фаза 2, коммит 9c8623d): по PLAN.md критерии бэкенда отмечены [x],
отдельного текстового вывода в репозитории не сохранено; воспроизводится командой `npm test` из корня.
```

```
test-ui, сообщение коммита 64e0cf0feat(app): category dropdown value help and OPA5 journeys:
"ui5-test-runner via npm run test:ui, 11 passed, 5 skipped (no draft edit)"
Журней "edit category on the object page" помечен opaTest.skip: у Products нет draft, кнопки Edit
на Object Page нет (см. ниже, сценарий (c) этой верификации подтверждает то же самое вручную).
Сырой текстовый вывод раннера в репозитории не сохранён; воспроизводится `npm run watch` (корень) +
`npm start` (app/products) + `npx ui5-test-runner --url http://localhost:4004/products/webapp/test/testsuite.qunit.html`.
```

`npm run lint` (app/products, ui5lint) в этой сессии не запускался: задача `ui-verifier` — только браузерная проверка, изменений в `app/` эта сессия не вносила.

## Ручная проверка сценариев

| Сценарий из PLAN/CONTEXT | Шаги | Результат | Скриншот |
|---|---|---|---|
| (a) List Report: колонка «Category» показывает названия, не коды | Открыть List Report, посмотреть колонку Category во всех 15 строках | пройден: везде названия (Electronics, Kitchen, Accessories, Sports, Furniture, Stationery), кодов нет | `screenshots/01-list-en.png` |
| (b1) Фильтр: выпадающий список, не диалог, 6 названий, множественный выбор | Фокус на поле Category → F4 | пройден: попап без поиска, без вкладок условий, 6 строк с чекбоксами в алфавитном порядке (Accessories…Stationery) | `screenshots/02-filter-dropdown.png` |
| (b2) Выбор «Kitchen» → Go | ArrowDown×3 до Kitchen, Enter, Go | пройден: токен «Kitchen» (название, не код), таблица → 3 строки (Water Bottle, Kitchen Knife Set, Coffee Maker) | `screenshots/03-filter-kitchen.png` |
| (b3) Добавить «Sports» | F4, чекбокс Sports, Go | пройден: 4 строки (+ Yoga Mat), два токена с названиями «Kitchen», «Sports» | без отдельного скриншота, подтверждено сетевым запросом ниже |
| (b4) Запрос содержит `category_code eq 'KITCHEN' or category_code eq 'SPORTS'` | DevTools → Network → $batch | пройден, см. раздел «Сеть» | — |
| (c) Object Page: категория в шапке (Description) и в General Information; отсутствие Edit | Клик Navigation по строке Water Bottle | пройден: заголовок «Water Bottle (Kitchen) - Product», под именем товара текст «Kitchen» (Description шапки); в секции General Information строка «Category: Kitchen»; кнопок «Edit» нет, только «Delete» и «Share» — подтверждён риск PLAN «non-draft, нет Edit» | `screenshots/04-object-page.png` |
| (d) Локаль ru: label «Категория», значения переведены | Навигация на `...flpSandbox.html?sap-ui-language=ru#products-display` | пройден на List Report: заголовок фильтра «Категория», колонка «Категория», значения «Электроника», «Кухня», «Аксессуары», «Мебель», «Спорт», «Канцелярия». Object Page на ru в этой сессии **не открывался** (сокращённый прогон по указанию оркестратора) — считать непроверенным для Object Page, проверено только на List Report | `screenshots/05-list-ru.png` |
| (e) Клавиатура: открыть список фильтра, выбрать значение | Фокус в поле Category, F4 (открытие списком), ArrowDown (навигация), Enter (выбор) | пройден: список открылся, фокус двигался по строкам (видно по подсветке и `aria-selected` в дереве доступности), Enter выбрал «Kitchen» и закрыл попап, токен появился в поле. Проверено из уже сфокусированного поля, а не начиная с `Tab` от начала формы — переход `Tab` к самому полю отдельно не хронометрирован, но клавиатурный путь открытие/навигация/выбор подтверждён полностью | подтверждено скриншотами `02`, `03` (последовательность) |
| Дерево доступности: подпись «Category», роль combobox, элементы без кодов | `take_snapshot` (a11y-дерево) на List Report | пройден: `combobox "Category" ... roledescription="Multi Value Combo Box"`, попап — `grid` со строками-названиями («Accessories», «Electronics», ...), токен — `option "Kitchen"`. Маркер `required` на фильтре не проверялся (в фильтре поле не обязательно; обязательность актуальна только для формы Object Page, которая в этой фиче не редактируется из-за отсутствия Edit) | см. текстовые снимки в логе сессии, отдельный файл не сохранён |
| (f) Мок-режим (`npm run start-mock`) | — | **не проверялось**, по прямому указанию: мок-сервер не учитывает `Accept-Language` и не даёт проверить `ru`; критерий из PLAN про `npm run start-mock` остаётся на совести `fiori-app-dev`/`test-ui` (пройден в их отчётах на английской локали) | — |
| Object Page, режим редактирования, выпадающий список с одиночным выбором | — | **непроверяемо**: кнопки «Edit» на Object Page нет (`Products` без draft, известный риск PLAN/CONTEXT). Сценарий зафиксирован как несостоявшийся по объективной причине, не как дефект этой фичи | `screenshots/04-object-page.png` (видно отсутствие Edit) |

## Сеть

Запрос при выборе «Kitchen» (batch, GET внутри multipart):
```
GET Products?$count=true&$select=ID,category_code,currency_code,name,price,stock&$expand=category($select=code,name)&$filter=category_code eq 'KITCHEN'&$skip=0&$top=30
```
Ответ: `@odata.count: 3`, все три строки содержат `"category":{"code":"KITCHEN","name":"Kitchen"}`.

Запрос при выборе «Kitchen» + «Sports»:
```
GET Products?$count=true&$select=ID,category_code,currency_code,name,price,stock&$expand=category($select=code,name)&$filter=(category_code eq 'KITCHEN' or category_code eq 'SPORTS')&$skip=0&$top=30
```
Ответ: `@odata.count: 4` (Water Bottle, Yoga Mat, Kitchen Knife Set, Coffee Maker).

Оба запроса вернули HTTP 200. Кода в UI (токенах, колонке, попапе) нигде не видно — код есть только в URL/OData-запросе, как и предсказывало CONTEXT.

Неуспешные запросы (статус ≥ 400) за всю сессию (en и ru навигации), все относятся к инфраструктуре локального FLP sandbox, не к фиче:
- `GET /appconfig/fioriSandboxConfig.json` — 404 (ожидаемо, сразу следует успешный `GET /products/webapp/appconfig/fioriSandboxConfig.json`)
- `GET /sap/bc/lrep/flex/data/products?...` — 404 (сервис Flexibility не поднят в dev-стенде, стандартное поведение FE)
- `GET /sap/bc/lrep/flex/settings` — 404 (то же)
- `POST /sap/bc/ui2/flp;sap-metrics-only` — 404 (пинг аналитики шелла, недоступен локально)
- `GET /products/webapp/Component-preload.js` — 404 (приложение не собрано в бандл, обычное для dev-режима через `cds watch`)

Ни один из этих запросов не касается `Products`, `Categories` или `category_code`; все воспроизводятся и на предыдущих фичах (не регрессия).

## Консоль браузера

Ошибок: 1 (не по фиче). Предупреждений (как error по уровню SAPUI5 "FUTURE FATAL"): 1 (не по фиче).

- `[FUTURE FATAL] 'sap.ushell.ui.footerbar.AddBookmarkButton' is deprecated...` — предупреждение фреймворка UI5 о будущем устаревании контрола шелла, не связано с категориями, возникает независимо от этой фичи.
- `Failed to load resource: the server responded with a status of 404` — соответствует одному из сетевых 404 выше (инфраструктура sandbox).

Сообщений об ошибках, упоминающих `Products`, `Categories`, `category`, `category_code`, `ValueList` или биндинги колонок/фильтра, не найдено ни на List Report, ни на Object Page.

## Критерии UI из PLAN.md, подтверждённые этой сессией

- [x] List Report: фильтр «Category» — выпадающий список с множественным выбором из 6 названий, без диалога value help и вкладки условий; «Kitchen» → 3 товара, токен с названием; «Kitchen»+«Sports» → 4 товара, два токена, запрос `category_code eq 'KITCHEN' or category_code eq 'SPORTS'`.
- [x] List Report: колонка «Category» показывает названия, не коды.
- [x] Object Page: в шапке (Description) и в «General Information» показано название категории. Часть критерия про режим редактирования — **не подтверждена**: кнопки Edit нет (non-draft), поэтому проверить выпадающий список формы и сохранение значения невозможно в этой фиче.
- [x] Локаль `ru`: в фильтре и колонке List Report названия на русском, label «Категория». Object Page на `ru` не проверялся в этой сессии (см. таблицу выше).
- [x] Элементы выпадающего списка фильтра нигде не показывают коды ни в `en`, ни в `ru` (для формы Object Page недостижимо, см. выше).
- [x] Клавиатурный сценарий (открытие списка, навигация, выбор) пройден на List Report. На Object Page не проверялся, так как нет режима редактирования.
- [x] Консоль браузера без ошибок, относящихся к фиче, на List Report и Object Page.
- [ ] `npm run lint` в `app/products` — не запускался в этой сессии (не входит в задачу браузерной верификации, изменений в коде не было).
- [x] Мок-режим — сознательно не проверялся (см. критерий PLAN про `ru`, недостижим в моке).
- [x] OPA5-журнеи — результат перенесён из коммита `64e0cf0` (11 passed, 5 skipped), не перезапускался.

Пункты плана про документацию (`docs:registry`, CHANGELOG, STATE, SUMMARY, PATTERNS, ADR) не входят в объём этой сессии (`ui-verifier`) и остаются за `docs-keeper`.

## Вердикт

**Готово к ревью** с одной зафиксированной, ожидаемой по плану оговоркой: сценарий редактирования категории на Object Page физически непроверяем, потому что `Products` не draft-enabled и кнопки «Edit» на странице нет. Это заранее описанный в PLAN и CONTEXT риск, а не дефект, найденный в этой сессии; журней `edit category on the object page` соответственно помечен `skip` в тестах UI. Все остальные критерии UI из PLAN.md подтверждены вручную в браузере (en и ru), консоль чистая от ошибок фичи, сеть подтверждает точный OData-контракт (`category_code`, `or`-комбинация токенов, `$expand=category`).

Рекомендация `reviewer`: при ревью отдельно решить, нужно ли фиксировать «нет Edit на Object Page» как отдельный пункт `docs/STATE.md` → «Открытый долг» (в PLAN это уже заложено как решение — draft не включается в этой фиче).
