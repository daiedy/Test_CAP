---
paths:
  - "app/**/webapp/**/*.js"
  - "app/**/webapp/**/*.xml"
  - "app/**/webapp/manifest.json"
  - "app/**/webapp/**/*.html"
---
# Код приложения UI5 (app/<app>/webapp/)

## Перед правкой
1. `manifest.json`: сначала `mcp__fiori-mcp__list_functionality` для приложения. Если функция есть, менять только через `get_functionality_details` → `execute_functionality`. Ручная правка допустима лишь при отсутствии функции.
2. Контролы, события, API: `mcp__plugin_ui5_ui5-mcp-server__get_api_reference`. Гайдлайны: скилл `ui5-best-practices` из плагина `ui5`.
3. Fiori Elements расширения: `mcp__fiori-mcp__search_docs` по «controller extension», «custom section», «custom column».
4. `docs/registry/UI-ARTIFACTS.md`: существующие extensions, фрагменты, форматтеры.

## Правила
- Только XML-вью. `sap.ui.define` со списком зависимостей, без глобальных `sap.*`, `jQuery.sap.*`, `sap.ui.getCore()`.
- Controller extension FE: файл `ext/controller/<Page>Ext.js`, без `.controller.` в имени. Модульный путь в manifest должен совпадать с файлом.
- Фрагменты: `ext/fragment/<Name>.fragment.xml`. Форматтеры: `model/formatter.js`, в XML через `core:require`.
- Тексты только через `i18n`. Ключи `<page>.<element>.<property>`.
- Bootstrap-параметры в html в дефисной записи (`data-sap-ui-compat-version`), `data-sap-ui-async="true"`.
- `Component.js`: наследует `sap/fe/core/AppComponent`; там есть осознанный обработчик клавиатуры для кнопки шелла, не удалять без запроса пользователя.
- Известный долг: CSP inline scripts в `index.html` и `test/flpSandbox.html`. Устраняется скиллом `modernize-flp-sandbox`, отдельной задачей.

## После правки
- `mcp__plugin_ui5_ui5-mcp-server__run_ui5_linter` или `npx ui5lint <file>` в `app/<app>`: ноль ошибок в изменённых файлах.
- После правки `manifest.json`: `mcp__plugin_ui5_ui5-mcp-server__run_manifest_validation`. Если инструмент отвечает ошибкой схемы (дефект UI5 MCP 0.2.18, см. LESSONS), достаточно `npx ui5lint` в каталоге приложения: он проверяет manifest своими правилами.
- Тест: QUnit для форматтера или extension (`tests-ui.md`).
- `npm run docs:registry`.

## Запрещено
- Создавать приложение или страницы руками. Только Fiori MCP `generate_fiori_app_cap` и `execute_functionality`.
- Использовать screen personalization вместо правки кода.
- TypeScript до пересмотра ADR-0005.
