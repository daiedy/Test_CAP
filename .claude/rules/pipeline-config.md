---
paths:
  - ".claude/**"
  - ".mcp.json"
  - "scripts/hooks/**"
---
# Конфигурация агентного конвейера (защищена)

Файлы `.claude/settings.json`, `.claude/agents/`, `.claude/skills/`, `.claude/rules/`, `.mcp.json`, `scripts/hooks/` исполняются автоматически и равны по риску CI-скриптам (ADR-0009, инцидент Shai Hulud 2026-04-29).

## Правила
- Агенты не редактируют эти файлы в рамках фич. Изменения вносит человек или отдельная задача по явному запросу пользователя с ревью diff.
- Версии в `.mcp.json` и в `npx`-командах закреплены точно; поднимаются только скиллом `release-check` после чтения changelog.
- Хуки не читают и не отправляют наружу `~/.claude.json`, `.env`, service keys. Сетевые обращения только к доменам из `docs/framework/versions.json`.
- Любой новый скрипт хука проходит `node --check` и запускается вручную с тестовым JSON на stdin до включения в `settings.json`.
- `settings.local.json` личный и в `.gitignore`; общие настройки только в `settings.json`.
- Внешние скиллы и плагины ставятся из официальных источников SAP и `claude-plugins-official`.

## Запрещено
- `@latest` в командах запуска MCP и инструментов.
- Хук с `bypassPermissions` или отключением проверок.
