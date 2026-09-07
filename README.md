# Deadlock Tracker

A React and TypeScript application for exploring Deadlock player profiles, match
history, teammates, hero performance, and item usage.

## Development

```sh
npm install
npm run dev
```

Use `npm run build` for a production build and `npm run lint` to run ESLint.

Run `npm test` with Node 22.18+ (native TypeScript stripping) for focused
statistics calculation and request tests. No additional test framework is used.

## Home-page statistics

`src/services/statistics.ts` uses the installed client's hero, ban, game, and
rank and ranked-season endpoints. The default view ranks five active heroes by win rate over all recorded
ranked normal games, with average team badges from Phantom I (91)
through Eternus VI (116) and at least 100 hero appearances. Date bounds end at
the latest full hour to reuse cached API results. Rank, time, and match filters
are shared across requests. A compact rank summary opens the two-handle slider,
with integer rank notches and API rank icons. Rank range and header sorting reset on refresh or with the Reset button; clicking a header again reverses sorting. Average K/D/A sorts
by aggregate (kills + assists) / deaths. Date radio controls offer 7 days, 30 days,
and season to date when the API supplies an active season interval. Overlapping
intervals use the latest start; missing season metadata does not block statistics.
Matches offers ranked only or ranked + unranked, retaining average-rank filters.
The rank popup is anchored below its button and flips above if needed; dragging
only commits on release. Reset and refresh restore all filters to defaults. The
100-appearance minimum and default columns are fixed. No table settings are persisted.

Win rate is wins / hero appearances. Pick rate is hero appearances / filtered
games. Recorded ban percentage is recorded bans / filtered games; incomplete
demo extraction means this understates true bans. Average K/D/A uses totals per
appearance; aggregate KDA is (total kills + assists) / total deaths, not an
average of individual ratios. Other averages use appearances, and shot accuracy
uses hits / (hits + misses). Undefined ratios show a dash and sort last.

Sorting operates locally. Win and pick rates use wide green/red bars with both
percentages labelled at their ends. Ban rate remains numeric; its header tooltip
explains the recorded-data limitation. Missing ban
or game totals leave the main table available with unavailable metrics marked.
Global statistics remain visible during search input and submission, until a
player successfully loads. Back to overview restores the home statistics.


## Player lookup and dashboard

Search submits through the installed client's SteamApi.steamSearch, requesting
up to 20 indexed profiles with no recent-activity minimum. Names are not unique:
select a candidate by avatar and account ID, even for a single result. This is
an index of known profiles, not a complete Steam directory. Numeric account IDs,
SteamID64, [U:1:accountId], and numeric Steam profile URLs load directly. SteamID64
conversion uses BigInt to preserve precision. Custom vanity URLs are unsupported;
use a display name or account ID. No Steam API key, backend, or forced refresh is used.

src/services/players.ts owns player API access. src/player.ts owns identity
normalization, summary calculations, and deterministic history filtering.
src/hooks/useResource.ts manages independent loading/error/success states,
retries, and cancellation; superseded results cannot replace current state.
Selection and filters remain in memory and refresh returns to the overview.

The dashboard defaults independently to All time, ranked + unranked normal games,
with 7-day and API-backed current-season alternatives. No home-page rank or
minimum-appearance filters apply. AnalyticsApi.heroStats, filtered by account,
provides raw totals for summary and hero performance. PlayersApi.playerHeroStats
provides time_played (seconds) and last_played (Unix seconds). All heroes remain
eligible, including inactive historical heroes; unknown assets fall back to IDs.
Win rate is wins/games; average K/D/A uses totals/games; aggregate KDA is
(kills + assists)/deaths. Zero denominators display a dash and sort last.

Recent history is filtered locally by the same date bounds and verified mode
values: normal=1, unranked=1, ranked=4. Source: [Valve protocol definitions](https://github.com/SteamDatabase/Protobufs/blob/master/deadlock/citadel_gcmessages_common.proto).
Outcome values retain invalid, penalized, penalized-party, and not-scored results;
team abandonment is shown separately. History is paginated at 20 rows, heroes at
10 rows. Data represents recorded API coverage, not guaranteed career history.
Latest recorded rank is independent of the date filter.

Recent matches show hero, result, K/D/A, duration and compact performance tags.
Hover a tag for a short explanation; focusable labels expose the same evidence
for assistive technology. No expansion or lane-check click is needed.
KDA tags compare with global aggregate hero KDA for the same match mode, across
all ranks, over the 30 complete UTC days before the match date. At least 100
recorded games and a 25% difference are required. Zero-death, missing and invalid
baselines produce no KDA tag. Personal-average tags are not used. Farm, souls and
deny comparisons are omitted because the aggregate response lacks a matching
per-minute baseline. Recorded win/loss streaks end at the displayed match;
missing history may hide interruptions. Abandoned, unscored and sub-10-minute
matches receive no tags and interrupt streaks.

Visible-page performance loads automatically with three concurrent workers,
sharing global requests by date and mode. Failed sources produce no corresponding
tag; page/filter changes cancel pending work. Lane metadata uses MatchesApi.metadata with
disableSteam=true and independent cancellation. The client's void response is
validated as unknown against the relevant subset of
[Valve's metadata protocol](https://github.com/SteamTracking/Protobufs/blob/master/deadlock/citadel_gcmessages_common.proto).
Equal-size assigned lanes (one or two players per side) require exact 9-minute
snapshots for every participant. A lead of at least 500 souls and 10% of the
lower side's total gives Won lane / Lost lane; otherwise Even lane. Missing
snapshots or ambiguous sides produce no lane tag. This estimates lane outcomes;
assigned lanes cannot establish actual swaps, rotations or individual credit.
Calculations and validation live in src/matchTags.ts; presentation lives in
src/components/DataDisplay/MatchTags.tsx. No metadata or personal data is persisted.

Frequent teammates use PlayersApi.mateStats with the selected dates, normal game
mode and sameParty=false. They include all match types because the endpoint has
no match-type filter, and the UI labels this exception. The top 10 are ordered
by shared games, then account ID; profile hydration failure preserves numeric IDs.
Selecting a teammate loads that player. Shared teams are not labelled friendships.
Profile/rank/assets/playtime/history/teammate failures do not block the other
sections. Empty successful analytics means no recorded matches, not a nonexistent
Steam account. Reset restores dashboard filters and hero sorting.


Player details use accessible Recent matches / Hero performance tabs, defaulting
to Recent matches on account selection and Reset. Hidden panels stay mounted so
switching tabs preserves pagination and hero sorting without new requests. Arrow
keys and Home/End select and focus tabs. Filter changes still reset pagination.
Match IDs remain internal; results show green Win / red Loss badges and neutral
labels for other outcomes. Frequent teammates occupy a 280px left sidebar with
compact entries and a short date/match-type note, stacking below the panel under 1000px.


Click a Recent matches row or its hero button to open a keyboard-accessible match
overview. It preserves history pagination on close and groups final player stats
by recorded team, including the winner. Metadata is runtime-validated because the
installed client declares this response as void. Damage/healing require a snapshot
exactly at match duration; missing values remain unavailable. Profile and tag
failures do not hide the scoreboard. Player histories are fetched with three
workers, with global baselines shared across participants; existing tag eligibility
rules apply. Optional mvp_rank is displayed verbatim as MVP rank N in history and
the overview. No MVP winner or Key player mapping is inferred from this number.

## Readability and maintainability

Optimize application code for human readability and long-term maintainability.
Prefer straightforward, explicit code over cleverness, compactness, or
abstraction for its own sake.

- Simplify before abstracting. Do not introduce abstractions solely to reduce
  line count or eliminate small amounts of duplication.
- Prefer descriptive, domain-specific names over generic names such as `data`,
  `item`, `value`, `handler`, or `utils` when a more meaningful name exists.
- Prefer readable intermediate variables and named functions over dense
  expressions, deeply chained transformations, or nested callbacks.
- Use guard clauses when they make control flow easier to follow.
- Keep functions conceptually focused, but do not split simple logic into many
  tiny functions solely to satisfy a size rule.
- Extract React components when they represent a meaningful UI concept,
  encapsulate reusable behavior, or substantially simplify their parent. Do not
  componentize trivial markup merely to reduce component length.
- Avoid unnecessary `useEffect`, `useMemo`, and `useCallback`. Derive values
  directly during render when practical rather than synchronizing derived state.
- Keep substantial calculations and domain logic out of JSX. Avoid nested
  ternaries and complex inline expressions.
- Keep state as local as practical. Extract custom hooks when stateful behavior
  has a meaningful boundary or genuine reuse.
- Keep tightly related code together. Do not create one-file-per-function or
  one-file-per-component structures unnecessarily.
- Prefer feature and domain ownership over generic `utils`, `helpers`, or
  `common` modules. Shared abstractions should have a real shared use case.
- Do not introduce service, repository, manager, factory, or similar layers
  unless they solve an actual architectural problem.
- Comments should explain why, constraints, invariants, or non-obvious behavior.
  Do not add comments that merely restate the code.
- Preserve existing behavior and visual appearance during refactors unless the
  task explicitly requests a behavioral or design change.
- Remove dead code, obsolete comments, debugging code, unused imports, and
  redundant indirection when encountered during relevant changes.

### Styling and dependencies

The project currently uses plain CSS with shared CSS custom properties. Preserve
this approach when it remains clear and maintainable, but do not treat the
current implementation as a permanent architectural constraint.

Prefer the existing stack and dependencies when they are sufficient. New
dependencies, including component libraries, styling systems, state libraries,
routers, test frameworks, or API clients, are acceptable when they provide a
clear product or maintainability benefit.

A different styling approach such as CSS Modules, Tailwind, or a component
library may be appropriate when it meaningfully improves consistency,
maintainability, accessibility, or developer experience.

Do not introduce a dependency merely to replace simple code that is already
clear and maintainable. Significant dependency or architectural changes should
have a concrete justification and should be kept separate from unrelated
refactoring when practical.

When working with the existing CSS:

- Organize styles around components and features.
- Keep selectors simple and predictable.
- Reuse existing semantic CSS custom properties and design tokens.
- Avoid unnecessary selector specificity and deeply coupled selectors.
- Prefer class names that describe component or element purpose rather than
  visual appearance.
- Avoid static inline styles. Use inline styles only for values that are
  genuinely dynamic at runtime.
- Remove unused and duplicate CSS when it is safe to do so.
- Keep responsive behavior understandable and close to the styles it affects
  where practical.
### Frontend code map

- `PlayerDashboard.tsx` coordinates filters, independent resources, profile and
  summary presentation, and tab selection. Panels stay mounted when hidden;
  filter/reset keys intentionally reset their local table state.
- `PlayerDetails.tsx` owns hero performance, recent-match pagination and overview
  selection, and the teammate list. `PlayerPresentation.tsx` holds the small
  display components shared by those views and the dashboard.
- `player.ts` builds and sorts hero rows, calculates player totals, parses
  identities, filters recorded history, and formats player metrics.
- `useResource` identifies each request by loader identity and retry attempt.
  Keep request callbacks stable: changing them intentionally starts a new load.
  Initial analytics are seeded from account selection to avoid duplicate loads.
- `services/matches.ts` keeps participant tag loading separate from its bounded
  worker loop and shares baseline requests by match mode. Partial failures and
  abort checks remain independent of scoreboard metadata.

### Component and stylesheet ownership

- Home statistics: `HeroStatistics.tsx` coordinates preferences and metadata;
  `StatisticsResults.tsx` contains request states and the statistics table.
  `RankSelector.tsx` owns the anchored popover and uncommitted slider preview.
- Shared analytics controls: `StatisticsFilters.tsx` renders date/match radios;
  `PercentageBar.tsx` renders the accessible meter used by both dashboards.
  Metric text formatting stays in `statistics.ts`.
- Player dashboard: `PlayerProfile.tsx` contains identity/copy/rank and summary
  presentation; `PlayerDashboard.tsx` retains resource coordination and tab state.
  `MatchOverview.tsx` separates metadata loading, scoreboard hydration, and team
  tables without adding requests or remounting the player panels.
- Global CSS: `App.css` contains fonts, theme tokens, resets, shell/header styles,
  shared button styles, and accessibility utilities.
- Feature CSS lives beside components: `HeroCarousel.css`, `PlayerSearch.css`,
  `HeroStatistics.css`, `PlayerDashboard.css`, and `MatchOverview.css`.
  `DataDisplay.css` owns shared tables, percentage bars, tags, results, and
  statistics control/layout primitives. Responsive rules stay with their owners.
- `App.tsx` imports styles in explicit global/shared/feature order. Preserve that
  order when modifying shared rules; these are plain global selectors, not CSS
  Modules. No new dependencies or styling system are required.

### Component folders

Components and their styles are grouped by owner under `src/components`:

```text
components/
  HeroCarousel/
    HeroCarousel.tsx
    HeroCarousel.css
  HeroStatistics/
    HeroStatistics.tsx
    HeroStatistics.css
    RankSelector.tsx
    StatisticsResults.tsx
  PlayerSearch/
    PlayerSearch.tsx
    PlayerSearch.css
  PlayerDashboard/
    PlayerDashboard.tsx
    PlayerDashboard.css
    PlayerDetails.tsx
    PlayerPresentation.tsx
    PlayerProfile.tsx
  MatchOverview/
    MatchOverview.tsx
    MatchOverview.css
  DataDisplay/
    DataDisplay.css
    PercentageBar.tsx
    StatisticsFilters.tsx
    MatchTags.tsx
```

`DataDisplay` contains visual components used by multiple features. Imports name
files directly; there are no barrel exports. CSS import order remains explicit
in `App.tsx` to preserve the existing cascade.
