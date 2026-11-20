---
name: run-app
description: Starts the application for checking: the CAP server and, if needed, the UI5 dev server or mock mode, checks the endpoints and opens the FLP. Use when the user says "start the application", "bring up the server", "show how it works" (Russian: «запусти приложение», «подними сервер», «покажи как работает»).
argument-hint: [full|proxy|mock]
allowed-tools: Bash, Read
---

Mode: `$ARGUMENTS` (default `full`).

- **full**: from the root `npm run watch` in the background; wait for `curl -sf -u alice: 'http://localhost:4004<service path>/$metadata'` (anonymous callers of a protected service get 401); UI address `http://localhost:4004/<app>/webapp/test/flpSandbox.html#<intent>`.
- **proxy**: the same plus `npm start` in `app/<app>` in the background; address `http://localhost:8080/test/flpSandbox.html#<intent>`.
- **mock**: only `npm run start-mock` in `app/<app>`; the address is the same, data from `webapp/localService`.

After the start check: `$metadata` responds 200, `<EntitySet>/$count` returns a number, the FLP page returns 200. Report the addresses and how to stop (`pkill -f 'cds serve'`, `pkill -f 'fiori run'`). For a visual check delegate to `ui-verifier`.
