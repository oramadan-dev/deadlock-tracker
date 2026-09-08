import { PercentageBar } from '../DataDisplay/PercentageBar'
import { useCallback, useMemo } from 'react'
import { useResource } from '../../hooks/useResource'
import { visiblePage, type PlayerView } from '../../navigation'
import { MatchTags } from '../DataDisplay/MatchTags'
import { formatPlayerNumber, formatPlayerKda, formatPlayerDate, buildHeroPerformanceRows, filteredHistory, matchOutcome, ratio, type HeroSort } from '../../player'
import { loadMates, loadMatchPerformance, loadPlayerHeroes, loadProfiles, type AnalyticsHeroStats } from '../../services/players'
import { Status, Pager, HeroName, type HeroDirectory } from './PlayerPresentation'

type HeroPerformanceProps = {
  stats: AnalyticsHeroStats[]
  details: Awaited<ReturnType<typeof loadPlayerHeroes>> | null
  heroes: HeroDirectory
  pageIndex: number
  sorting: PlayerView['sorting']
  changePage: (page: number) => void
  changeSort: (sorting: PlayerView['sorting']) => void
}

export function HeroPerformance({ stats, details, heroes, pageIndex, sorting, changePage, changeSort }: HeroPerformanceProps) {
  const rows = buildHeroPerformanceRows(stats, details, heroes, sorting)
  const page = visiblePage(pageIndex, rows.length, 10)
  const columns: { key: HeroSort, label: string }[] = [{ key: 'hero', label: 'Hero' }, { key: 'games', label: 'Games' }, { key: 'winRate', label: 'Win %' }, { key: 'kda', label: 'Average K / D / A' }, { key: 'time', label: 'Playtime' }, { key: 'last', label: 'Last played' }]
  if (!rows.length) return <p>No recorded matches for these filters.</p>

  return <>
    <div
      className="statistics-table-scroll"
      tabIndex={0}
      aria-label="Hero performance, scroll for more columns">
      <table className="player-table">
        <caption className="visually-hidden">Recorded hero performance</caption>
        <thead>
          <tr>
            {columns.map((column) => <th
              key={column.key}
              scope="col"
              aria-sort={sorting.key === column.key ? sorting.direction === 'desc' ? 'descending' : 'ascending' : 'none'}>
              <button
                className="metric-sort"
                title={column.key === 'kda' ? 'Sort by aggregate (kills + assists) / deaths' : undefined}
                onClick={() => {
                  changeSort({ key: column.key, direction: sorting.key === column.key && sorting.direction === 'desc' ? 'asc' : 'desc' })
                }}>
                <span className="metric-sort-label">{column.label}</span>
                {sorting.key === column.key && <span className="metric-sort-indicator" aria-hidden="true">
                  {sorting.direction === 'desc' ? '↓' : '↑'}
                </span>}
              </button>
            </th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(page * 10, page * 10 + 10).map((row) => <tr key={row.stat.hero_id}>
            <th scope="row">
              <HeroName id={row.stat.hero_id} heroes={heroes} />
            </th>
            <td>
              {row.games.toLocaleString()}
            </td>
            <td className="player-rate-cell">
              <PercentageBar value={row.winRate} label={row.hero + ' win rate'} />
            </td>
            <td>
              {formatPlayerKda([ratio(row.stat.total_kills, row.games), ratio(row.stat.total_deaths, row.games), ratio(row.stat.total_assists, row.games)])} <span title="KDA: (kills + assists) / deaths">({formatPlayerNumber(row.kda)})</span>
            </td>
            <td>
              {row.time === null ? '—' : formatPlayerNumber(row.time / 3600) + ' h'}
            </td>
            <td>
              {formatPlayerDate(row.last)}
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <Pager page={page} size={10} count={rows.length} change={changePage} label="Hero pages" />
  </>
}

type MatchesProps = {
  history: ReturnType<typeof filteredHistory>
  allHistory: ReturnType<typeof filteredHistory>
  heroes: HeroDirectory
  pageIndex: number
  changePage: (page: number) => void
  openMatch: (matchId: number) => void
}

export function Matches({ history, allHistory, heroes, pageIndex, changePage, openMatch }: MatchesProps) {
  const page = visiblePage(pageIndex, history.length, 20)
  const visible = useMemo(() => history.slice(page * 20, page * 20 + 20), [history, page])
  const performance = useResource(useCallback((signal: AbortSignal) => loadMatchPerformance(visible, signal), [visible]))
  if (!history.length) return <p>No recorded matches for these filters.</p>

  return <>
    <div
      className="statistics-table-scroll"
      tabIndex={0}
      aria-label="Recent matches, scroll for more columns">
      <table className="player-table">
        <caption className="visually-hidden">Recent recorded matches, newest first</caption>
        <thead>
          <tr>
            {['Hero', 'Result', 'K / D / A', 'Duration', 'Performance'].map((label) => <th scope="col" key={label}>
              {label}
            </th>)}
          </tr>
        </thead>
        <tbody>
          {visible.map((match) => <tr
            key={match.match_id}
            className="match-history-row"
            onClick={(event) => {
              if (!(event.target instanceof Element) || !event.target.closest('button, .match-tag')) openMatch(match.match_id)
            }}>
            <th scope="row">
              <button
                className="teammate-link"
                aria-label={'Open match ' + match.match_id}
                onClick={() => openMatch(match.match_id)}>
                <HeroName id={match.hero_id} heroes={heroes} />
              </button>
            </th>
            <td>
              <span
                className={"match-result " + (match.player_match_outcome === 1 ? "match-result-win" : match.player_match_outcome === 2 ? "match-result-loss" : "match-result-neutral")}>
                {matchOutcome(match.player_match_outcome)}
              </span>
              {match.team_abandoned ? ' · Team abandoned' : ''}
            </td>
            <td>
              {match.player_kills} / {match.player_deaths} / {match.player_assists} <span title="KDA: (kills + assists) / deaths">({formatPlayerNumber(ratio(match.player_kills + match.player_assists, match.player_deaths))})</span>
            </td>
            <td>
              {Math.floor(match.match_duration_s / 60)}
              :
              {String(match.match_duration_s % 60).padStart(2, '0')}
            </td>
            <td className="match-performance-cell">
              <MatchTags
                match={match}
                history={allHistory}
                performance={performance.state.status === 'success' ? performance.state.data[match.match_id] ?? [] : []}
                loading={performance.state.status === 'loading'} />
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <Pager page={page} size={20} count={history.length} change={changePage} label="Match pages" />
  </>
}

export function Teammates({ mates, select }: { mates: Awaited<ReturnType<typeof loadMates>>, select: (id: number) => void }) {
  const loader = useCallback((signal: AbortSignal) => loadProfiles(mates.map((mate) => mate.mate_id), signal), [mates])
  const profiles = useResource(loader)
  if (!mates.length) return <p>No recorded teammates for this date range.</p>

  return <>
    <Status resource={profiles} label="teammate profiles" />
    <ul className="teammate-list">
      {mates.map((mate) => {
        const profile = profiles.state.status === 'success' ? profiles.state.data.find((entry) => entry.account_id === mate.mate_id) : undefined
        const name = profile?.personaname || 'Account ' + mate.mate_id
        return <li key={mate.mate_id}>
          <button className="teammate-link statistics-hero" onClick={() => select(mate.mate_id)}>
            {profile && <img
              src={profile.avatarmedium}
              alt=""
              width="36"
              height="36"
              onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />}
            <span>
              {name}
            </span>
          </button>
          <p>
            {mate.matches_played.toLocaleString()} shared games · {mate.wins.toLocaleString()} wins</p>
          <PercentageBar value={ratio(mate.wins, mate.matches_played)} label={name + ' shared win rate'} />
        </li>
      })}
    </ul>
  </>
}
