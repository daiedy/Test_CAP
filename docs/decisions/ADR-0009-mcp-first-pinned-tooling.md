# ADR-0009: MCP-first протокол и закреплённые версии инструментов агентов

Дата: 2026-09-07. Статус: принято.

## Контекст
LLM без опоры на актуальную документацию придумывает синтаксис CDS, смешивает OData V2 и V4, не видит существующую модель. SAP поставляет MCP-серверы для CAP, Fiori и UI5 и в README требует обращаться к ним перед любой правкой. Одновременно 2026-04-29 атака Shai Hulud внедряла вредоносные хуки в `settings.json` Claude Code в репозиториях CAP и собирала конфигурацию MCP из `~/.claude.json`.

## Решение
- Протокол: перед созданием или изменением любого SAP-артефакта агент запрашивает соответствующий MCP (CDS и хендлеры → `cds-mcp`; аннотации, Fiori Elements, manifest → `fiori-mcp`; контролы и API UI5 → UI5 MCP из плагина `ui5`). Если MCP противоречит знаниям модели, следовать MCP. При вопросах о версиях доверять `cds version`, `npm view` и живым страницам, а не снапшоту в MCP.
- Версии в `.mcp.json` закреплены точно (`@cap-js/mcp-server@0.0.5`, `@sap-ux/fiori-mcp-server@1.12.2`, `chrome-devtools-mcp@1.8.0`; UI5 MCP через плагин `ui5@claude-plugins-official` 0.1.8). Поднимаются только скиллом `release-check` после чтения changelog.
- `.claude/**`, `.mcp.json`, `scripts/hooks/**` считаются security-sensitive: агенты их не редактируют (правило `pipeline-config.md`, PreToolUse-хук), правки проходят ревью человека, установка зависимостей с `--ignore-scripts` в CI.
- Телеметрия Fiori MCP отключена переменной `SAP_UX_FIORI_TOOLS_DISABLE_TELEMETRY`.

## Альтернативы
| Вариант | Почему отклонён |
|---|---|
| Только Markdown-инструкции без MCP | Знания о фреймворках устаревают; SAP-документация слишком велика для контекста |
| `@latest` в командах запуска MCP | Неконтролируемые изменения инструментов между сессиями; вектор атаки цепочки поставок |

## Последствия
- Общий скилл `project-protocol` предзагружается во всех субагентов.
- Правила по путям называют точные имена инструментов MCP.

## Источники
- https://github.com/cap-js/mcp-server (раздел Rules)
- https://github.com/SAP/open-ux-tools/tree/main/packages/fiori-mcp-server (раздел Rules)
- https://github.com/SAP-samples/cap-agentic-engineered (AGENTS.md)
- https://www.mend.io/blog/shai-hulud-sap-cap-supply-chain-attack-claude-code/
