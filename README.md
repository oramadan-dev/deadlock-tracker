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

The dashboard defaults independently to 30 days, ranked + unranked normal games,
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
