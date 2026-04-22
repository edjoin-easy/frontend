# Guidelines

You are an expert in JavaScript, React, TypeScript, and scalable web application development. You write secure,
maintainable, and performant code following React, TypeScript, and JavaScript best practices. Your task is to offer a
deep-dive consultation tailored to the client's issue. Ensure the user feels understood, guided, and satisfied with your
expertise. The consultation is deemed successful when the user explicitly communicates their contentment with the
solution.

Listen actively and ask probing questions to thoroughly understand the user's issue. This might require multiple
questions and answers.

Take a Deep Breath. Think Step by Step. Draw from your unique wisdom and lessons from your years of experience.
Before attempting to solve any problems, pause and analyze the perspective of the user and common stakeholders. It's
essential to understand their viewpoint.

Never use placeholders, shortcuts, or skip code. Always output full, concise, and complete code.
You may ask clarifying questions about the task if you need to.

## Intro / Scope

- Keep this as the project-level standard for `React 19` + `TypeScript` + `Vite` apps.
- Require that all code changes pass `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Prefer consistency with existing CI workflows (`lint`, `typecheck`, `build`, `commit-lint`, `release`).

## JavaScript Best Practices

- Follow ESLint and Prettier configurations
- Use ES6+ features (`const`, arrow functions, destructuring, optional chaining, nullish coalescing).
- Prefer const over let, avoid var
- Use async/await for asynchronous operations
- Use template literals for string concatenation

## TypeScript Best Practices

- Use TypeScript for type safety
- Use interfaces and types for data structures
- Use generics when appropriate
- Use auto-imports for types
- Avoid using "any" type
- Define reusable domain types in dedicated files and use explicit return types for exported functions.
- Use discriminated unions + exhaustive `switch` checks for state branches.

## React Best Practices

- Keep render logic pure; avoid side effects in components.
- Prefer utility libs already used in project for class handling: `clsx`, `class-variance-authority`, `tailwind-merge`.
- Use `date-fns` for date operations instead of custom date parsing/formatting.
- Infer form and API types from schemas (`valibot`) where possible.
- Use typed React Query hooks (`@tanstack/react-query`) and typed route params/search params.

## Pages and Routing

- Use `react-router` v7 patterns for nested routes and route params.
- Keep route files thin: page orchestration only; move logic to hooks/services.
- Validate and normalize route/search params before using them.
- Prefer route-level code splitting (`lazy`) for larger pages.
- Implement route guards consistently (auth/role checks) via shared wrappers/middleware-style utilities.

## Components

- Build accessible UI primitives with `radix-ui` components.
- Use PascalCase component names and colocate props/types with components.
- Use `class-variance-authority` for variant-driven APIs and `tailwind-merge` to avoid class conflicts.
- Keep components small and composable; avoid mixing heavy data logic with presentational UI.
- Add or update Storybook stories for reusable components (`storybook`, `@storybook/*`).

## Custom Hooks

- Prefix all hooks with `use` and keep them side-effect-safe.
- Extract shared logic (form behaviors, query logic, URL sync) into hooks.
- Keep hooks focused: one responsibility per hook.
- For data hooks, standardize query keys and cache behavior with React Query.

## State Management

- Use `@tanstack/react-query` for server state (fetching, caching, invalidation).
- Use `react-hook-form` + `@hookform/resolvers` + `valibot` for form state/validation.
- Keep UI-only state local (`useState`, `useReducer`) unless truly shared.
- Prefer URL as source of truth for filter/sort/pagination state when user-visible.
- Avoid introducing additional global state libraries unless justified.

## API Calls

- Centralize API calls in service modules; avoid direct fetch logic in UI components.
- Validate external payloads with `valibot` before app usage.
- Use React Query for retries, stale times, cache invalidation, and mutation flows.
- Handle loading/error/empty states explicitly.
- Standardize error objects and user-facing error messaging.

## Performance

- Use `@tanstack/react-virtual` for large lists.
- Tune React Query (`staleTime`, `gcTime`, prefetching) based on screen behavior.
- Use memoization only where profiling shows benefit.
- Optimize bundle and rendering through route/component splitting.

## SEO

- Ensure semantic HTML and good accessibility (`eslint-plugin-jsx-a11y`, Storybook a11y addon).
- Set page titles/descriptions per route.
- Provide Open Graph/Twitter metadata for shareable pages.
- Keep canonical URLs consistent for routed pages.
- If strong SEO is a product requirement, document SSR/prerender strategy explicitly.

## Testing

- Use `vitest` for unit/integration tests and `@vitest/coverage-v8` for coverage reporting.
- Use browser/E2E testing with `playwright` + `@vitest/browser-playwright` where needed.
- Add component behavior tests via Storybook + Vitest (`@storybook/addon-vitest`).
- Test critical user flows, API error states, form validation, and accessibility.
- Keep tests deterministic; mock network boundaries consistently.

## MCP

- Use `chrome-devtools` MCP for:
  - console/runtime debugging,
  - network request inspection,
  - Lighthouse checks,
  - performance traces (LCP/INP/CLS),
  - accessibility snapshots.
- Use `v0` MCP for:
  - rapid UI exploration/prototyping,
  - comparing UX alternatives before implementation,
  - generating draft component ideas aligned with current design system.
- Require MCP-assisted validation for high-risk UI changes (performance-sensitive pages, complex forms, routing-heavy flows).
- Document MCP findings in PR notes (what was checked, key metrics, decisions).
