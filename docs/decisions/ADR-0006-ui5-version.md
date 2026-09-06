# ADR-0006: SAPUI5 с CDN без фиксации версии, minUI5Version 1.136.0, manifest 2.0.0

Дата: 2026-09-07. Статус: принято.

## Контекст
Приложение грузит SAPUI5 с `https://ui5.sap.com` без версии в пути. `ui5lint` требовал manifest версии 2 и `minUI5Version` ≥ 1.136 (базовая версия для legacy-free UI5). Фиксация версии в URL даёт воспроизводимость, но требует ручного поднятия и следит за снятием версий с CDN (не-LTS версии живут на CDN до года).

## Решение
- `manifest.json` `_version: "2.0.0"`, `minUI5Version: "1.136.0"`, параметр `synchronizationMode` удалён.
- В разработке UI5 берётся с CDN актуальной версии без фиксации. Изменения UI5 отслеживает `release-watcher` через `versionoverview.json` и релиз-ноты `sap/fe/core`.
- Для продуктива версия фиксируется при настройке деплоя отдельным ADR (LTS-линия, сейчас 1.148).

## Альтернативы
| Вариант | Почему отклонён |
|---|---|
| Зафиксировать 1.148 в URL | Ручное обслуживание; тестовый проект выигрывает от раннего обнаружения регрессий UI5 |
| Локальная копия UI5 через `ui5 use` | Нужна для офлайна и деплоя, не для разработки |

## Последствия
- Проблемы после релиза UI5 диагностируются скиллом `debug-after-upgrade` по `changes-<версия>.json`.
- Bootstrap-параметры приведены к дефисной записи автофиксом `ui5lint --fix`.

## Источники
- https://ui5.sap.com/versionoverview.json
- https://community.sap.com/t5/open-source-blogs/introducing-openui5-2-x/ba-p/13580633
- https://github.com/UI5/linter/blob/main/docs/Rules.md
