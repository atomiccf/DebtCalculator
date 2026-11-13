# Jurist Calculator

Calculators for Belarusian court duties, late-payment penalties, and interest under Article 366 of the Civil Code of Belarus.

## Features

- Court duty calculations for ordinary and economic courts, including supported appeals and exemptions.
- Daily late-payment penalties across multiple documents. The penalty percentage must be explicitly entered and greater than zero.
- Article 366 interest across multiple documents. The interface selects one refinancing rate on each document's final period date and applies it to the entire period. Calendar year lengths of 365 or 366 days are handled automatically and shown in the results.
- Calculation details with rule versions, reference data sources, and warnings.

For Article 366 calculations, the final period date represents the payment date, court decision date, or date of a notarial enforcement inscription. A calculation ending on an interim date before that event is an estimate.

## Project structure

The repository uses npm workspaces with a single root `package-lock.json`.

| Workspace | Purpose |
| --- | --- |
| `shared` | Calculation logic, request validation, reference data, and application services |
| `server` | Express API |
| `client` | React application built with Vite |

Application services live in `shared/src/services`. Calendar calculations, rounding, and monetary arithmetic belong to the shared calculation core. HTTP handlers validate requests, call services, and return responses using the same contracts as the client.

`server/src/app.ts` exports `createApp()` and an application instance without opening a port. `server/src/index.ts` starts the API server.

## Installation and build

Run all commands from the repository root.

```sh
npm ci
npm run build
```

The build runs in this order: `shared` → `server` → `client`. Running `npm run build:server` also builds `shared` first.

The server loads the local `jurist-calculator-shared` workspace through `shared/dist/index.js`. No separate installation or copying of the shared package is required.

Start the compiled API:

```sh
npm start -w server
```

The API listens on port `3000` by default. Set `PORT` to use a different port.

## Development

Start the API and client in two separate terminals.

API:

```sh
npm run dev:server
```

Client:

```sh
npm run dev:client
```

The client is available at [http://localhost:5173](http://localhost:5173). The API provides a health endpoint at [http://localhost:3000/health](http://localhost:3000/health).

The API development process recompiles `shared` before starting. Changes in `server/src` or `shared/src` automatically restart the server. If shared compilation fails, the new API process does not start with an outdated library.

## Client configuration

By default, the client sends requests to `/api` on the current origin. During development, Vite proxies these requests to the API server.

Copy `client/.env.example` to `client/.env.local` to customize the connection:

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_URL` | Base URL of a separate API host, without the `/api` suffix | Empty; uses the current origin |
| `API_PROXY_TARGET` | API address used by the Vite development proxy | `http://127.0.0.1:3000` |

Restart Vite after changing these variables. For a deployed client, set `VITE_API_URL` when building the application.

## Tests and type checking

Run the test suites without building the project:

```sh
npm test -w client
npm test -w shared
```

Client tests fill React forms, validate outgoing requests with the shared schemas, and calculate results through application services. They do not require a running API server. Shared tests cover calculation logic, validation, reference data, and HTTP contracts; HTTP tests start a local test server.

Run type checks:

```sh
npm run typecheck -w shared
npx tsc --noEmit -p client/tsconfig.json
```

## Dependency management

Install or update dependencies from the repository root, targeting the appropriate workspace:

```sh
npm install <package> -w server
```

Commit the updated root `package-lock.json` along with changes to package manifests.

## Calculation documentation

The detailed calculation documents are currently in Russian:

- [Shared library](shared/README.md): calculation functions and architecture.
- [API contracts](shared/CONTRACTS.md): request schemas, required fields, response metadata, and validation commands.
- [Reference data and rule snapshots](shared/REFERENCE_DATA.md): supported editions, date coverage, and update procedures.
- [Legal review](shared/LEGAL_REVIEW.md): reviewed provisions, sources, and calculation limitations.
- [Test coverage](shared/test/README.md): test responsibilities and known coverage boundaries.
