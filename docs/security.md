# Security Notes

This document captures a lightweight security threat model for the `easyEd` frontend as of April 26, 2026.

## Scope

This frontend is a browser client that:

- lets a user choose EDJOIN locations and keyword filters
- loads EDJOIN metadata through proxy endpoints
- posts an export request to a backend API
- downloads a generated Excel workbook

Primary code paths:

- [src/App.tsx](/src/App.tsx)
- [src/components/ExportForm/ExportForm.tsx](/src/components/ExportForm/ExportForm.tsx)
- [src/components/LocationSelector/LocationSelector.tsx](/src/components/LocationSelector/LocationSelector.tsx)
- [src/lib/edjoin.ts](/src/lib/edjoin.ts)
- [vite.config.ts](/vite.config.ts)

## Assets

The main assets worth protecting are:

- export request contents, including selected districts and keyword filters
- generated workbook contents
- application availability
- user trust in downloaded files and status messages

## Trust Boundaries

The most important trust boundaries in this app are:

1. Browser to backend API
   The export request is sent from the browser to `${VITE_API_BASE_URL}/api/edjoin/export`.

2. Browser to EDJOIN proxy endpoints
   The frontend fetches state, region, and district metadata through `/__edjoin_proxy/...`.

3. Backend and upstream responses back into the UI
   Server-controlled data includes error text, record counts, warning counts, and download metadata.

## Entry Points

User-controlled or externally controlled inputs enter through:

- keyword chips inputs in `ExportForm`
- selected locations in `LocationSelector`
- backend responses returned from `/api/edjoin/export`
- upstream EDJOIN responses returned from proxy endpoints
- `Content-Disposition` headers used to derive the downloaded filename

## Current Observations

What currently looks reasonable:

- React is used for rendering, and there are no obvious raw HTML sinks such as `dangerouslySetInnerHTML`.
- Query-string values for EDJOIN lookups are encoded with `encodeURIComponent`.
- Server-originated strings shown in the UI are rendered through normal React text escaping.
- The export form uses a client-side schema to keep request shape consistent.

What currently increases risk:

- Download filenames are derived from untrusted `Content-Disposition` header values.
- Raw backend error text is displayed to users.
- No browser hardening policy is visible in `index.html` or Vite config, such as CSP or frame restrictions.

## Threats

### 1. Misconfigured transport security

Risk:

- If `VITE_API_BASE_URL` is pointed at a plaintext or incorrect backend origin, export requests and downloads lose transport integrity.
- Missing environment configuration can also break export flow entirely if deployments do not supply the backend origin explicitly.

Relevant code:

- [src/App.tsx](easyEd/frontend/src/App.tsx:8)

Recommended mitigation:

- Fail fast when `VITE_API_BASE_URL` is missing.
- Prefer same-origin deployment patterns where the frontend talks to the backend through the hosting origin or a reverse proxy.

### 2. Untrusted download metadata

Risk:

- The backend controls the `Content-Disposition` filename.
- Passing that value directly to `anchor.download` can allow misleading or malformed filenames.
- This is not a DOM XSS issue by itself, but it is still untrusted metadata reaching the browser download surface.

Relevant code:

- [src/lib/edjoin.ts](easyEd/frontend/src/lib/edjoin.ts:99)
- [src/App.tsx](easyEd/frontend/src/App.tsx:51)

Recommended mitigation:

- Sanitize to a safe basename.
- Strip control characters and path separators.
- Enforce an expected extension such as `.xlsx`.

### 3. Backend error leakage

Risk:

- `response.text()` from failed export requests is surfaced directly in the UI.
- React escaping prevents HTML injection here, but backend text can still expose internal implementation details, stack traces, or upstream error content.

Relevant code:

- [src/App.tsx](easyEd/frontend/src/App.tsx:42)
- [src/components/ExportStatusPanel/ExportStatusPanel.tsx](easyEd/frontend/src/components/ExportStatusPanel/ExportStatusPanel.tsx:121)

Recommended mitigation:

- Replace raw backend text with a generic user-facing error message.
- Keep detailed diagnostics in server logs or structured monitoring instead.

### 4. Client-side validation bypass

Risk:

- The frontend validates shape and some UI constraints, but an attacker can always bypass the UI and call the backend directly.
- Oversized keyword arrays, malformed location trees, or repeated export requests can still hit the backend unless server-side controls exist.

Relevant code:

- [src/components/ExportForm/ExportForm.tsx](easyEd/frontend/src/components/ExportForm/ExportForm.tsx:35)
- [src/App.tsx](easyEd/frontend/src/App.tsx:32)

Recommended mitigation:

- Enforce request validation on the backend.
- Add request size limits, rate limits, and server-side normalization.

### 5. Upstream availability and abuse

Risk:

- The app depends on EDJOIN metadata endpoints and the export backend.
- A failing or slow upstream can degrade the experience or amplify backend load if retries and queueing are not controlled.

Relevant code:

- [src/lib/edjoin.ts](easyEd/frontend/src/lib/edjoin.ts:41)
- [vite.config.ts](easyEd/frontend/vite.config.ts:10)

Recommended mitigation:

- Rate-limit or cache upstream metadata on the backend where appropriate.
- Ensure the export backend has timeouts, retry discipline, and concurrency controls.

### 6. Missing browser hardening

Risk:

- No visible Content Security Policy, `frame-ancestors`, `X-Frame-Options`, or `Referrer-Policy` is configured in this frontend.
- The app does not currently show an obvious XSS sink, but these controls reduce impact if a future sink is introduced.

Relevant files:

- [index.html](easyEd/frontend/index.html)
- [vite.config.ts](easyEd/frontend/vite.config.ts)

Recommended mitigation:

- Add CSP and frame restrictions at the hosting or reverse-proxy layer.
- Add an explicit referrer policy.

## Threat Priorities

Highest-value fixes for this repo:

1. Keep backend origin configuration explicit and environment-specific.
2. Sanitize download filenames before assigning `anchor.download`.
3. Stop rendering raw backend error text directly to users.
4. Add deployment documentation describing required transport and header protections.

## Recommended Backend Assumptions

This frontend should assume the backend will:

- fully validate request bodies
- rate-limit export requests
- enforce authentication and authorization if the export feature is not public
- sanitize filenames and response headers
- avoid returning sensitive implementation details in error bodies

## Follow-Up Checklist

- Add frontend-side filename sanitization.
- Tighten API base URL handling by environment.
- Replace raw error display with a generic error state.
- Add deployment documentation for HTTPS, CSP, frame restrictions, and referrer policy.
- Add regression tests for export request payload construction and download behavior.
