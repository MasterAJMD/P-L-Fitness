<!-- Short, actionable instructions for AI coding agents working in this repo -->
# Copilot instructions — P&L Fitness

This file contains concise, repo-specific guidance to help AI coding agents be immediately productive.

- Architecture summary: Backend is an Express.js app (entry: `bin/www` -> `app.js`) that exposes REST APIs under `/api/*` and also serves EJS pages for legacy routes. Frontend is a Vite + React + TypeScript app in `src/` that talks to the backend via the API service at `src/services/api.ts`.

- Important startup / dev commands (project root):
  - `npm run dev` — backend (nodemon + `bin/www`) on port `process.env.PORT || 5000`
  - `npm run dev:frontend` — frontend dev server (Vite) on port 5173
  - `npm run dev:full` — runs both concurrently
  - `npm run build` — builds frontend (Vite)
  - `npm start` — starts production server (`node ./bin/www`)

- Env & configuration notes:
  - Frontend uses `VITE_API_URL` (see `src/services/api.ts`). Default API base is `/api`.
  - Backend reads `.env` values; DB env var names used in `services/dbconnect.js` are `_HOST_ADMIN`, `_USER_ADMIN`, `_PASSWORD_ADMIN`, `_DATABASE_ADMIN`.
  - `FRONTEND_URL` is used in CORS config inside `app.js`.

- Authentication & API conventions:
  - Auth token is stored in a cookie called `token` (see `src/services/api.ts:getAuthToken`). The frontend attaches `Authorization: Bearer <token>` and sends `credentials: 'include'` on fetches.
  - Public APIs live under `/api/auth` and `/api/` (landing). Protected APIs use middleware `middleware/auth.js` and are mounted under `/api/*` (see `app.js`).
  - Many mutation endpoints use `POST` for inserts and `PUT` for updates/delete (e.g., `/sessions/insert` POST, `/sessions/delete` PUT). Mirror this pattern when adding endpoints.

- Backend patterns and utilities:
  - Database helper: `services/dbconnect.js` exports `Query(sql, params)` returning a Promise; controllers directly call this helper.
  - Cron jobs are scheduled in `app.js` (node-cron) for periodic tasks (daily/weekly points resets). Be careful when modifying global app lifecycle.
  - Routes are organized under `routes/*.js` and use controllers in `controllers/*.controller.js`.

- Frontend patterns and conventions:
  - Centralized API service: `src/services/api.ts` exports `api` with named methods (e.g., `api.loadSessions()`, `api.createSession(data)`). Use these helpers instead of ad-hoc fetches.
  - Data fetching hook: `src/hooks/useApi.ts` wraps an API call and returns `{ data, loading, error, refetch }`.
  - TS path alias: `@/*` -> `./src/*` (see `tsconfig.json`).

- Quick examples to reference code:
  - Backend entry: `bin/www` -> `app.js`
  - DB helper: `services/dbconnect.js`
  - Frontend API: `src/services/api.ts`
  - Data hook: `src/hooks/useApi.ts`
  - Main UI routing: `src/App.tsx` (view switcher)

- Testing & CI: No test framework detected. There are no existing test scripts in `package.json`.

- When making changes:
  - Follow existing HTTP verb conventions and route naming (insert/update/delete) to keep parity between frontend service methods and backend routes.
  - Avoid replacing the single shared MySQL connection unless you manage connection lifecycle and pooling — many controllers rely on `services/dbconnect.js`'s exported `Query` helper.
  - If modifying cron jobs, update `app.js` and consider side effects on `master_attendance` resets.

- Missing / ask-for-clarification items (ask the repo owner):
  - Confirm intended production build path for frontend (app uses `build` directory in `app.js` when `NODE_ENV==='production'`).
  - Provide any conventions for database migrations or seeders (there is a `seedAdmin` API but no migrations directory).

If anything here is unclear or you want a different emphasis, tell me which sections to expand or examples to add.
