---
name: run-app
description: Запускает приложение для проверки: CAP-сервер и, при необходимости, UI5 dev server или мок-режим, проверяет эндпоинты и открывает FLP. Используй при словах «запусти приложение», «подними сервер», «покажи как работает».
argument-hint: [full|proxy|mock]
allowed-tools: Bash, Read
---

Режим: `$ARGUMENTS` (по умолчанию `full`).

- **full**: из корня `npm run watch` в фоне; жди `curl -sf 'http://localhost:4004/odata/v4/catalog/$metadata'`; адрес UI `http://localhost:4004/products/webapp/test/flpSandbox.html#products-display`.
- **proxy**: то же плюс `npm start` в `app/products` в фоне; адрес `http://localhost:8080/test/flpSandbox.html#products-display`.
- **mock**: только `npm run start-mock` в `app/products`; адрес тот же, данные из `webapp/localService`.

После старта проверь: `$metadata` отвечает 200, `Products/$count` возвращает число, страница FLP отдаёт 200. Сообщи адреса и как остановить (`pkill -f 'cds serve'`, `pkill -f 'fiori run'`). Для визуальной проверки делегируй `ui-verifier`.
