# Repository Guidelines

## Project overview

Deadlock Tracker is a React and TypeScript application for exploring Deadlock
players and their match data. Planned capabilities include account selection,
player profiles, match history, frequently encountered teammates, hero
preferences and win rates, KDA statistics, and item usage overall and by hero.

The application will eventually consume an open-source TypeScript client for a
Deadlock API. Do not invent API shapes or commit placeholder production data as
if it came from the service. Confirm the client and its types before building an
integration.

## Technology

- React 19
- TypeScript in strict, no-emit mode
- Vite
- ESLint with the React Hooks and React Refresh rules
- npm scripts defined in `package.json`

Do not add a framework, state library, router, styling system, test framework,
or API client unless the task requires it. Prefer the platform and existing
dependencies when they are sufficient.

## Commands

- `npm run dev`: start the local Vite development server
- `npm run build`: type-check and create a production build
- `npm run lint`: lint the repository
- `npm run preview`: serve the production build locally

Run both `npm run lint` and `npm run build` after code changes. If either cannot
run, state why in the handoff.

## Code conventions

- Use TypeScript for application code and preserve strict typing.
- Prefer named types for domain concepts and derive types from the API client
  where possible instead of duplicating its models.
- Keep components focused. Move reusable UI into components and non-visual
  behavior into hooks or plain modules only when reuse or complexity warrants it.
- Keep API access behind a small service boundary so components do not depend on
  transport details.
- Represent loading, empty, error, and success states explicitly for data-driven
  views.
- Use semantic HTML and accessible names. Interactive behavior must work with a
  keyboard and expose visible focus states once styling is introduced.
- Avoid `any`, non-null assertions, and type casts unless the invariant is clear
  and cannot be represented more safely.
- Follow the existing formatting style: single quotes, no semicolons, and
  trailing commas where supported.

## Product and data considerations

- Treat a Steam ID or API-provided account ID as identity; display names are not
  guaranteed to be unique or stable.
- Distinguish verified friends from players inferred through shared match
  history. Do not label inferred relationships as Steam friendships.
- Keep aggregate calculations deterministic and independently testable. Define
  edge cases such as remakes, abandoned matches, zero deaths, and missing data.
- Preserve source timestamps and identifiers when transforming API responses.
- Never commit API keys, Steam credentials, session cookies, or real user data.
  Client-visible environment variables are public and must not contain secrets.

## Scope discipline

- Keep changes focused on the requested feature and avoid speculative
  abstractions.
- Remove dead code and unused assets when replacing functionality.
- Update this file and the README when commands, architecture, or contributor
  expectations materially change.
- Do not modify generated output such as `dist/` or dependency contents in
  `node_modules/`.
