# Jurist Calculator

Проект состоит из npm workspaces: `shared` (расчёты), `server` (Express API)
и `client` (React/Vite). Зависимости устанавливаются из корня; общий
`package-lock.json` фиксирует версии для всех трёх пакетов.

Общие схемы запросов, обязательные поля по сценариям, метаданные ответов
и команды проверки описаны в [shared/CONTRACTS.md](shared/CONTRACTS.md).

## Установка и сборка

```sh
npm ci
npm run build
```

Сборка выполняется последовательно: `shared` → `server` → `client`.
Команда `npm run build:server` также сначала собирает библиотеку `shared`.
Сервер импортирует локальный workspace `jurist-calculator-shared` через
`shared/dist/index.js`; копировать или устанавливать библиотеку отдельно не нужно.

Запуск собранного API:

```sh
npm start -w server
```

## Разработка

В двух терминалах из корня:

```sh
npm run dev:server
```

```sh
npm run dev:client
```

Перед каждым запуском dev-сервера библиотека `shared` компилируется заново.
Изменения в `server/src` и `shared/src` автоматически перезапускают сервер;
при ошибке компиляции новый процесс API не запускается со старой библиотекой.

## Проверка сборки

```sh
npm run build
```

При изменении зависимостей выполняйте `npm install` из корня, например
`npm install <package> -w server`, и сохраняйте общий lock-файл.
