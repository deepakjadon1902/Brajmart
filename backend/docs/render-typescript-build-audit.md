# Render backend TypeScript build audit

Date: 2 November 2026

The backend is ready for a reviewed Render deployment. The production-only
installation, strict TypeScript checks, production build, and all 252 backend
tests pass. This work did not deploy the application or change Render settings.

## Root cause and reproduction

The backend runs `npm run build` from its `postinstall` hook. TypeScript and
ts-node were production dependencies, but the declaration packages needed to
compile the application were development dependencies. npm defaults to omitting
development dependencies when `NODE_ENV=production`.

A clean temporary copy of the original backend, with no `.env` file and no
ancestor project `node_modules`, reproduced the failure using:

```sh
NODE_ENV=production npm ci --no-audit --no-fund
```

Installation exited with status 2 during `postinstall`. The compiler was
installed, but `@types/express` was absent. The reproduction produced 40 TS7016,
192 TS2339, 252 TS7006, one TS2307, and three TS2503 diagnostics.

The missing Express declarations prevented `AuthRequest` from inheriting known
request members. Its existing `extends Request` implementation was structurally
correct. Missing declarations also removed contextual types from Express route
and middleware callbacks, producing the implicit-any diagnostics. These were
downstream effects of the production installation rather than missing request
properties in the application design.

Reference: [npm's production omit behavior](https://docs.npmjs.com/cli/v11/commands/npm-ci/#omit).

## Dependency correction

The existing declaration dependencies were moved into `dependencies`, where
the install-time compiler can resolve them. npm regenerated the lockfile's
dependency classifications. No locked package versions, version ranges, or
integrity hashes changed. `nodemon` remains a development dependency.

| Declaration package | Existing locked version retained |
| --- | --- |
| @types/express | 4.17.25 |
| @types/compression | 1.8.1 |
| @types/cors | 2.8.19 |
| @types/archiver | 6.0.4 |
| @types/bcryptjs | 2.4.6 |
| @types/jsonwebtoken | 9.0.10 |
| @types/multer | 1.4.13 |
| @types/node | 20.19.39 |
| @types/nodemailer | 6.4.23 |
| @types/pdfkit | 0.17.6 |

Express remains 4.22.1, with Express 4 declarations and
`@types/express-serve-static-core` 4.19.8. The other declaration packages are
also necessary for the production installation's compilation of existing
imports; moving only the three named packages would leave other build errors.

## Request and middleware typing

`AuthRequest` still extends the actual Express `Request`. Its optional `user`
retains `id`, `email`, optional `role`, and optional `pwdReset`. Authentication,
optional authentication, and admin authorization are explicitly typed as
Express `RequestHandler`s. Redundant JWT `any` casts were removed without
changing token verification or claim assignment.

Affected server, users, wishlist, and catalog stream handlers now have explicit
Express types. CORS uses `CorsOptionsDelegate<Request>`. The global error
middleware uses `ErrorRequestHandler`, and the JSON parser's verification hook
uses the appropriate Node HTTP request/response types with its existing
raw-body fields. Image-processing errors use `Error` or a narrowed `unknown`.

The original `tsconfig.json` and its strict settings are unchanged. No ambient
declaration shims were introduced. A separate no-emit type-check configuration
checks all application sources plus compilation-only request contracts for
`body`, `params`, `query`, authenticated claims, and middleware compatibility.

## Verification

| Check | Result |
| --- | --- |
| Original production install | Reproduced status 2 and the reported diagnostic families |
| `npm install --include=dev --offline --no-audit --no-fund` | Passed, including the existing postinstall build |
| Fresh `NODE_ENV=production npm ci --omit=dev --offline --no-audit --no-fund` | Passed; 303 packages installed; nodemon absent |
| `npm run typecheck` | Passed locally and in the production-only installation |
| `npm run build` | Passed; zero TypeScript errors |
| `npm test` | 252 passed, zero failed; includes unit and loopback integration tests |
| Authentication/authorization integration | Missing/invalid/expired tokens rejected, optional auth preserved, admin access enforced |
| Request/HTTP integration | Body, params, query, user claims, wishlist identity binding, raw webhook bytes, CORS errors, health and redirects verified |
| Catalog and commerce | Existing read-only catalog tests and new bundle/recommendation contracts passed |
| Database unit checks | Connection success/failure, reconnect behavior, transactions and DDL guard verified |
| Configured MySQL connection | Passed `SELECT 1` only; connection closed afterward |
| Production-only compiled application | Loopback health HTTP 200; unauthenticated wishlist HTTP 401 |

The new integration suite uses the actual Express application and middleware,
with persistence confined to in-memory doubles. Its webhook receiver tests raw
body parsing without contacting a gateway. Unit tests do not create application
database records or send emails/payments.

The older `phase*Smoke.ts` scripts insert and delete database records. They were
not run against the configured production database. No existing tests were
removed; the main test command now also includes `tests/integration/*.test.cjs`.

## Files changed

- `package.json`, `package-lock.json`: production build dependencies and test/type-check commands.
- `src/middleware/auth.ts`: explicit middleware types and the existing authenticated-user type.
- `src/lib/catalogEvents.ts`: typed SSE request handler.
- `src/lib/commerceIntelligence.ts`: type-only authenticated-request import.
- `src/routes/users.ts`, `src/routes/wishlist.ts`: explicit request/response signatures.
- `src/server.ts`: typed middleware, handlers, errors and raw-body parser hook.
- `tsconfig.type-tests.json`, `tests/types/express-request.ts`: strict compile-only request contracts.
- `tests/integration/express-auth.test.cjs`: loopback HTTP and authentication regression tests.
- `tests/commerce-intelligence.test.cjs`, `tests/database-connection.test.cjs`: isolated commerce and database regression tests.
- `README.md`, this audit: build cause, verification and reviewed-release instructions.
- `dist/server.js`: updated tracked generated output corresponding to the server changes.

## Release status and limits

No remaining TypeScript errors were found. No changes to Render variables,
Vercel configuration, schemas or production records were made. The clean build
was verified locally on Windows with Node 24.11.1 and npm 11.6.2; a deployment on
Render's Linux runtime remains the reviewed release step.

Use the `backend` service root and the existing npm install/build lifecycle.
`npm ci --omit=dev` is sufficient to run the existing postinstall build;
`npm start` runs `dist/index.js`. Keep the production runtime environment
unchanged for this fix. Nothing was committed, pushed or deployed by this work.
