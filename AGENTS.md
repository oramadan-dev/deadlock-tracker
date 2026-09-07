# Repository Guidelines

## Project overview

Deadlock Tracker is a React and TypeScript application for exploring Deadlock
players, hero statistics, recorded match history, teammates, and match overviews.
It uses the installed open-source TypeScript package `deadlock_api_client`.
Do not invent API shapes or commit placeholder production data as if it came
from the service. Confirm installed client types before changing an integration;
runtime-validate endpoints whose generated response types are incomplete.

## Technology

- React 19
- TypeScript in strict, no-emit mode
- Vite
- ESLint with the React Hooks and React Refresh rules
- npm scripts defined in `package.json`

Do not add a framework, state library, router, styling system, test framework,
or API client unless the task requires it. Prefer the platform and existing
dependencies when they are sufficient.

## Visual direction

Use this colorway consistently through shared CSS custom properties:

- Ink: `#000000` / `rgb(0, 0, 0)`
- Navy: `#233D4D` / `rgb(35, 61, 77)`
- Orange: `#FE7F2D` / `rgb(254, 127, 45)`
- Mist: `#EAECF0` / `rgb(234, 236, 240)`

In light mode, use mist as the page background, navy for structure and text, and
orange for primary actions. In dark mode, swap the orange and navy roles: use
orange for the main surface and strong visual structure, and navy for actions
and compact accents. Ink remains the dark foundation and mist remains the main
text color. Keep contrast accessible and do not introduce additional brand
colors without a product need.

Favor a sparse, product-first interface. Avoid marketing headlines, slogans,
feature-summary panels, and placeholder explanatory copy. The initial page
should expose the app identity, theme control, and player search without filler.

The interface supports dark and light themes. Dark mode is the default; an
explicit visitor selection is persisted locally and takes precedence on later
visits. Define both themes through semantic CSS custom properties and verify new
UI in both modes. Keep the theme control keyboard-accessible and accurately
labelled for assistive technology.

The display typeface is the locally hosted VALVe Pulp Bold file at
`src/assets/fonts/valve-pulp-bold.ttf`, sourced from the Deadlock Graphical
Library. Declare it once with `@font-face` and use the `Valve Pulp` family for
headings, labels, navigation, and compact controls. Use the system sans-serif
stack for longer body copy and dense data so it remains easy to read. Do not
load the font from a third-party URL at runtime.

## Commands

- `npm run dev`: start the local Vite development server
- `npm run build`: type-check and create a production build
- `npm run lint`: lint the repository
- `npm test`: run synthetic statistics and service tests using Node 22.18+ native TypeScript support
- `npm run preview`: serve the production build locally

After code changes, run `npm run lint`, `npm test`, and `npm run build`. Fix
introduced failures without weakening rules or tests. Report any command that
cannot run and distinguish pre-existing failures from regressions. Documentation-
only edits do not require rebuilding the application.

## Code conventions

- Use TypeScript for application code and preserve strict typing.
- Prefer named types for domain concepts and derive types from the API client
  where possible instead of duplicating its models.
- Keep components focused. Move reusable UI into components and non-visual
  behavior into hooks or plain modules only when reuse or complexity warrants it.
- Keep API access behind a small service boundary so components do not depend on
  transport details.
- Player lookup and endpoints live in `src/services/players.ts`; identity parsing,
  summary calculations, and match-history filtering live in `src/player.ts`.
  Use `useResource` for independently cancellable dashboard sections. Teammate
  totals support date filters but not the dashboard's ranked/all selection.
- Match tags and runtime lane-metadata validation live in `src/matchTags.ts`.
- Match overview metadata is validated in `src/matchOverview.ts` and loaded via
  `src/services/matches.ts`. Only end-of-match snapshots supply final damage and
  healing. Display recorded MVP rank without inferring a Key player award.
  KDA baselines use global hero/mode totals before the match date. Lane
  metadata is loaded automatically for visible matches through the player service with Steam fallback
  disabled; never infer lane results from final match totals.
- Home-page analytics use `src/services/statistics.ts`; metric calculations live in `src/statistics.ts`. Keep rank/date/match filters
  aligned across endpoints and distinguish recorded ban percentage from full
  ban coverage.
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

## Frontend component organization

Group TSX, CSS, and private subcomponents by owner under `src/components`:

| Folder | Ownership |
| --- | --- |
| `HeroCarousel/` | Active-hero carousel and its stylesheet |
| `HeroStatistics/` | Home coordination, `RankSelector`, `StatisticsResults`, and home styles |
| `PlayerSearch/` | Search, candidate selection, and search styles |
| `PlayerDashboard/` | Dashboard coordination, `PlayerDetails`, `PlayerProfile`, `PlayerPresentation`, and player styles |
| `MatchOverview/` | Dialog, scoreboard hydration, team tables, and overview styles |
| `DataDisplay/` | Shared `StatisticsFilters`, `PercentageBar`, `MatchTags`, and data-display styles |

Use direct file imports rather than barrel exports. Keep substantial domain
calculations in `src/player.ts` and `src/statistics.ts`, including deterministic
hero sorting and metric formatting. Do not move shared service or domain modules
into a component folder merely because one component currently uses them.

Prefer simple, explicit code and named prop types. Extract recognizable UI
concepts rather than tiny wrappers. Keep page components focused on composition,
high-level state, and coordination; avoid generic helper dumping grounds.

### State and interaction invariants

- `useResource` identifies requests by loader identity and retry attempt. Keep
  callbacks stable until request inputs change; changing identity starts a load.
  Account selection seeds initial analytics to avoid fetching them twice.
- Superseded searches and section requests must be cancelled, and stale responses
  must not replace newer selections. Supplemental failures preserve usable data.
- Hidden player tab panels deliberately stay mounted to preserve pagination and
  sorting. Tab switches do not refetch. Filter/reset keys deliberately reset
  table state; account selection and Reset default to Recent matches.
- Rank slider drafts belong to `RankSelector`. Commit on pointer release,
  supported keyboard key release, or blur; preserve pointer-cancel recovery.
  The native popover remains anchored and supports outside-click and Escape.
- Home and player dates default to All time. Home defaults to Phantom+ ranked;
  player filters independently default to ranked + unranked normal games.
  Filters and identity stay in memory; theme selection alone is persisted.
- Preserve API-backed season selection, metric denominators, missing-value
  handling, historical player heroes, and the teammates match-type exception.
  A structural refactor must not silently change these product semantics.

### Stylesheet ownership

`src/App.css` contains font declarations, theme tokens, resets, shell/header
layout, shared button styling, and accessibility utilities. Feature styles live
beside their components; shared tables, meters, tags, and result styles live in
`src/components/DataDisplay/DataDisplay.css`.

`src/App.tsx` explicitly imports CSS in this order: global, DataDisplay,
HeroCarousel, PlayerSearch, HeroStatistics, PlayerDashboard, MatchOverview.
Preserve the cascade when moving rules. These are plain global stylesheets,
not CSS Modules; keep selectors predictable and avoid unnecessary specificity.

- Consolidate duplicate rules only after checking responsive overrides.
- Keep responsive rules with their owning feature and preserve reduced motion.
- Use existing semantic tokens and verify both themes for UI/style changes.
- Use inline styles only for runtime values, such as slider positions and rates.
- Do not introduce a styling system or dependency solely to reorganize files.

## Known validation discrepancy

At the latest verification on 2026-09-07, lint and production build passed;
22 tests passed and one existing test failed. `recordedMvpTag` currently maps
`mvp_rank` 1 to MVP and 2/3 to Key Player, while
`tests/matchOverview.test.mjs` expects literal MVP rank labels. This also
conflicts with the recorded-rank guidance above. Treat this as an unresolved
data-semantics decision, not permission to weaken the test or silently change
labels during unrelated refactoring. Recheck and update this note when resolved.
