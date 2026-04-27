# easyEd Frontend

React + TypeScript frontend for building EDJOIN export requests and downloading generated Excel workbooks.

## What It Does

The app lets a user:

- choose a state, search regions, and districts
- add optional include and exclude keyword filters
- submit an export request to the backend
- download the generated workbook and view record and warning counts

## Stack

- React 19
- TypeScript
- Vite
- React Hook Form + Valibot
- TanStack Query
- Tailwind CSS 4

## Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

The Vite dev server proxies EDJOIN metadata requests from `/__edjoin_proxy/*` to `https://www.edjoin.org`.

## Environment

The export request is sent to:

```text
${VITE_API_BASE_URL}/api/edjoin/export
```

Required local setup:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

The frontend no longer falls back to a hardcoded backend URL. Set `VITE_API_BASE_URL` explicitly in `.env` for local development and use HTTPS in deployed environments.

## Scripts

- `npm run dev`: start the Vite dev server
- `npm run build`: type-check and build for production
- `npm run preview`: preview the production build locally
- `npm run typecheck`: run TypeScript checks
- `npm run lint`: run ESLint
- `npm run test`: run Vitest
- `npm run coverage`: run Vitest with coverage
- `npm run format`: apply ESLint fixes and Prettier formatting
- `npm run prettier`: check formatting with Prettier

## Request Flow

1. The frontend loads states, search regions, and districts through `/__edjoin_proxy/...`.
2. The user builds a location selection and optional keyword filters.
3. The frontend posts the request body to the backend export endpoint.
4. The backend responds with a long-poll URL for the export job.
5. The frontend polls that URL until the backend reports `DONE` or `ERROR`.
6. The frontend triggers a browser download using the returned filename and blob.

## Security Notes

Security review notes and a lightweight threat model live in [docs/security.md](easyEd/frontend/docs/security.md).

Important deployment expectations:

- set `VITE_API_BASE_URL` explicitly for each environment
- terminate traffic over HTTPS in deployed environments
- sanitize download filenames on the client or backend
- avoid exposing raw backend error details to end users
- add browser hardening headers such as CSP and frame restrictions at the hosting layer

## Repository Notes

- `src/App.tsx` owns export submission, polling, and download handling
- `src/components/ExportForm/ExportForm.tsx` owns form state and submission gating
- `src/components/LocationSelector/LocationSelector.tsx` owns state, region, and district selection
- `src/lib/edjoin.ts` contains EDJOIN metadata fetch helpers and filename parsing
- `src/lib/export-job.ts` contains backend export job start/poll helpers
