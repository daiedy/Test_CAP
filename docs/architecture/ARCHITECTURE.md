# Архитектура

## Назначение

Product Catalog: каталог товаров с OData V4 сервисом и Fiori Elements интерфейсом (List Report + Object Page). Одновременно проект служит площадкой для агентного конвейера разработки CAP-приложений, описанного в `docs/ai-pipeline-plan.md`.

## Слои

```
app/products            Fiori Elements V4 приложение, аннотации представления
        │  OData V4 /odata/v4/catalog
srv/catalog-service     CatalogService: проекции, действия, хендлеры, семантические аннотации
        │  cds.ql
db/schema               my.catalog.Products (+ Currency из @sap/cds/common)
        │
SQLite in-memory (dev, test)   HANA Cloud (prod, не настроен)
```

Правила между слоями:

- `app` знает только сервис, никогда `db`. UI-аннотации адресуют `CatalogService.<Entity>`.
- `srv` выставляет сущности только проекциями; клиенты никогда не видят `my.catalog.*` напрямую.
- Бизнес-правила сначала декларативно в аннотациях, затем в хендлерах `srv/<name>-service.js`, общая логика в `srv/lib/`.
- Семантика данных живёт в `srv/annotations/`, представление в `app/<app>/annotations/`. Подробнее в `CONVENTIONS.md`.

## Текущая модель

Одна сущность `Products : cuid, managed` с полями name, description, price, currency, stock, category, imageUrl. Актуальная схема, проекции и аннотации всегда в сгенерированном `docs/registry/DOMAIN-MODEL.md`, там же диаграмма. Этот файл описывает только принципы.

## Топология разработки

| Режим | Команда | Адрес | Что происходит |
|---|---|---|---|
| Полный стек | `npm run watch` в корне | http://localhost:4004/products/webapp/test/flpSandbox.html | CAP отдаёт сервис и статику приложения (`sapux` в package.json) |
| UI с прокси | `npm start` в `app/products` при запущенном CAP | http://localhost:8080/test/flpSandbox.html | UI5 tooling, live reload, `/odata` проксируется на :4004 |
| UI без бэкенда | `npm run start-mock` в `app/products` | http://localhost:8080/test/flpSandbox.html | `sap-fe-mockserver` отдаёт `localService/metadata.xml` и `mockdata/*.json` |
| Тесты бэкенда | `npm test` в корне | | `cds.test` поднимает сервер in-process на случайном порту |

Аутентификация в разработке: `mocked` (пользователи из `package.json`, по умолчанию `alice`, `bob`). Продуктивная аутентификация не настроена.

## Точки расширения

| Что добавить | Куда | Как |
|---|---|---|
| Новая сущность | `db/schema.cds`, `srv/catalog-service.cds`, `srv/annotations/`, `app/products/annotations/` | Паттерн «Новая сущность» в `PATTERNS.md` |
| Новый сервис | `srv/<name>-service.cds` + `.js` | Только если у сервиса другой круг пользователей или другой домен |
| Новое приложение | `app/<name>` | Fiori MCP `generate_fiori_app_cap` |
| Внешний сервис | `srv/external/` через `cds import` | Скилл `cap-add-remote-service`, начать с ADR |

## Деплой

`mta.yaml` и `xs-security.json` являются черновиками под Cloud Foundry с HANA и XSUAA. Зависимости для продуктива (`@cap-js/hana`, `@sap/xssec`, профиль `[production]`) не установлены. Работа по деплою начинается с ADR и не смешивается с фичами.

## Документация

| Файл | Кто ведёт | Содержание |
|---|---|---|
| `docs/architecture/*.md` | человек и агент `architect` | принципы, конвенции, паттерны, стек, тесты |
| `docs/registry/*.md` | скрипт `scripts/gen-registry.mjs` | что реально есть в коде; руками не правится |
| `docs/decisions/ADR-*.md` | `architect` | почему выбран способ |
| `docs/features/<name>/` | `architect`, `docs-keeper` | контекст, план, итог, верификация фичи |
| `docs/STATE.md` | `docs-keeper` | где мы сейчас, накопленные решения, открытый долг |
| `docs/LESSONS.md` | все агенты через `retro` | выученные уроки |
| `docs/CHANGELOG.md` | `docs-keeper` | что изменилось |
| `docs/framework/UPDATES.md` | `release-watcher` | дайджест обновлений фреймворков |
