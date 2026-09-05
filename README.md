# Deadlock Tracker

A React and TypeScript application for exploring Deadlock player profiles, match
history, teammates, hero performance, and item usage.

The home page loads hero names and portraits through the installed
`deadlock_api_client` (`HeroesApi.listHeroes`, `/v1/assets/heroes`). API access
lives in `src/services/heroes.ts`. The carousel requests `onlyActive: true` to
exclude unselectable, disabled, or in-development heroes, and displays a fallback
when a portrait is missing.
Rotation pauses on hover or keyboard focus; reduced-motion users can scroll
the row manually.

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
rank and ranked-season endpoints. The default view ranks five active heroes by win rate over seven
days of ranked normal games, with average team badges from Phantom I (91)
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
Global statistics remain visible during search input and submission; player
lookup is not implemented yet. A future successful player view should replace
this section.
