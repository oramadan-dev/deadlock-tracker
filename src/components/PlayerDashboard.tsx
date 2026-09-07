import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { useResource, type Resource } from '../hooks/useResource'
import { compareMetric, filteredHistory, matchOutcome, ratio, steamProfileUrl, summarizePlayer } from '../player'
import { dateBounds, listRanks, loadSeasonStart } from '../services/statistics'
import { loadHeroDirectory, loadHistory, loadMates, loadPlayerHeroes, loadPlayerStats, loadProfiles, loadRank, playerDefaults,
  type AnalyticsHeroStats, type PlayerFilters, type PlayerWindow } from '../services/players'

const decimal = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 1 })
const kdaText = (parts: (number | null)[]) => parts.map(decimal).join(' / ')
const timestamp = (value: number | null) => value ? new Date(value * 1000).toLocaleDateString() : '—'

function Status<T>({ resource, label }: { resource: { state: Resource<T>, retry: () => void }, label: string }) {
  if (resource.state.status === 'success') return null
  return <p role="status">{resource.state.status === 'loading' ? `Loading ${label}…` : <>{label} unavailable. <button className="theme-toggle" onClick={resource.retry}>Retry {label}</button></>}</p>
}
function Rate({ value, label }: { value: number | null, label: string }) {
  if (value === null) return <>—</>
  const percent = Math.max(0, Math.min(100, value * 100))
  return <span className="percentage-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={percent.toFixed(1) + '%'}>
    <span className="percentage-fill" style={{ width: percent + '%' }} />
    <span className="percentage-label percentage-label-filled" aria-hidden="true">{percent.toFixed(1)}%</span>
    <span className="percentage-label percentage-label-remainder" aria-hidden="true">{(100 - percent).toFixed(1)}%</span>
  </span>
}
function Pager({ page, size, count, change, label }: { page: number, size: number, count: number, change: (page: number) => void, label: string }) {
  if (count <= size) return null
  return <nav className="player-pagination" aria-label={label}>
    <button className="theme-toggle" disabled={page === 0} onClick={() => change(page - 1)}>Previous</button>
    <span>Page {page + 1} of {Math.ceil(count / size)}</span>
    <button className="theme-toggle" disabled={(page + 1) * size >= count} onClick={() => change(page + 1)}>Next</button>
  </nav>
}
type HeroDirectory = Awaited<ReturnType<typeof loadHeroDirectory>>
function HeroName({ id, heroes }: { id: number, heroes: HeroDirectory }) {
  const hero = heroes.find((entry) => entry.id === id)
  return <span className="statistics-hero">{hero && <img src={hero.images.icon_image_small_webp ?? hero.images.icon_image_small ?? undefined} alt="" width="36" height="36" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />}{hero?.name ?? 'Hero ' + id}</span>
}
type HeroSort = 'hero' | 'games' | 'winRate' | 'kda' | 'time' | 'last'
function HeroPerformance({ stats, details, heroes }: { stats: AnalyticsHeroStats[], details: Awaited<ReturnType<typeof loadPlayerHeroes>> | null, heroes: HeroDirectory }) {
  const [sorting, setSorting] = useState<{ key: HeroSort, direction: 'asc' | 'desc' }>({ key: 'games', direction: 'desc' })
  const [page, setPage] = useState(0)
  const rows = stats.map((stat) => {
    const extra = details?.find((entry) => entry.hero_id === stat.hero_id)
    return { stat, hero: heroes.find((hero) => hero.id === stat.hero_id)?.name ?? 'Hero ' + stat.hero_id,
      games: stat.matches, winRate: ratio(stat.wins, stat.matches), kda: ratio(stat.total_kills + stat.total_assists, stat.total_deaths),
      time: extra?.time_played ?? null, last: extra?.last_played ?? null }
  }).sort((a, b) => compareMetric(a[sorting.key], b[sorting.key], sorting.direction) || b.games - a.games || a.stat.hero_id - b.stat.hero_id)
  const columns: { key: HeroSort, label: string }[] = [{ key: 'hero', label: 'Hero' }, { key: 'games', label: 'Games' }, { key: 'winRate', label: 'Win %' }, { key: 'kda', label: 'Average K / D / A' }, { key: 'time', label: 'Playtime' }, { key: 'last', label: 'Last played' }]
  if (!rows.length) return <p>No recorded matches for these filters.</p>
  return <><div className="statistics-table-scroll" tabIndex={0} aria-label="Hero performance, scroll for more columns"><table className="player-table">
    <caption className="visually-hidden">Recorded hero performance</caption>
    <thead><tr>{columns.map((column) => <th key={column.key} scope="col" aria-sort={sorting.key === column.key ? sorting.direction === 'desc' ? 'descending' : 'ascending' : 'none'}>
      <button className="metric-sort" title={column.key === 'kda' ? 'Sort by aggregate (kills + assists) / deaths' : undefined} onClick={() => { setSorting({ key: column.key, direction: sorting.key === column.key && sorting.direction === 'desc' ? 'asc' : 'desc' }); setPage(0) }}>{column.label} {sorting.key === column.key ? sorting.direction === 'desc' ? '↓' : '↑' : '↕'}</button>
    </th>)}</tr></thead><tbody>{rows.slice(page * 10, page * 10 + 10).map((row) => <tr key={row.stat.hero_id}>
      <th scope="row"><HeroName id={row.stat.hero_id} heroes={heroes} /></th><td>{row.games.toLocaleString()}</td>
      <td className="player-rate-cell"><Rate value={row.winRate} label={row.hero + ' win rate'} /></td>
      <td>{kdaText([ratio(row.stat.total_kills, row.games), ratio(row.stat.total_deaths, row.games), ratio(row.stat.total_assists, row.games)])} <span title="KDA: (kills + assists) / deaths">({decimal(row.kda)})</span></td>
      <td>{row.time === null ? '—' : decimal(row.time / 3600) + ' h'}</td><td>{timestamp(row.last)}</td>
    </tr>)}</tbody></table></div><Pager page={page} size={10} count={rows.length} change={setPage} label="Hero pages" /></>
}
function Matches({ history, heroes }: { history: ReturnType<typeof filteredHistory>, heroes: HeroDirectory }) {
  const [page, setPage] = useState(0)
  if (!history.length) return <p>No recorded matches for these filters.</p>
  return <><div className="statistics-table-scroll" tabIndex={0} aria-label="Recent matches, scroll for more columns"><table className="player-table">
    <caption className="visually-hidden">Recent recorded matches, newest first</caption>
    <thead><tr>{['Hero', 'Date', 'Result', 'K / D / A', 'Duration', 'Type'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
    <tbody>{history.slice(page * 20, page * 20 + 20).map((match) => <tr key={match.match_id}>
      <th scope="row"><HeroName id={match.hero_id} heroes={heroes} /></th><td>{timestamp(match.start_time)}</td>
      <td><span className={"match-result " + (match.player_match_outcome === 1 ? "match-result-win" : match.player_match_outcome === 2 ? "match-result-loss" : "match-result-neutral")}>{matchOutcome(match.player_match_outcome)}</span>{match.team_abandoned ? ' · Team abandoned' : ''}</td>
      <td>{match.player_kills} / {match.player_deaths} / {match.player_assists} <span title="KDA: (kills + assists) / deaths">({decimal(ratio(match.player_kills + match.player_assists, match.player_deaths))})</span></td>
      <td>{Math.floor(match.match_duration_s / 60)}:{String(match.match_duration_s % 60).padStart(2, '0')}</td>
      <td>{match.match_mode === 4 ? 'Ranked' : 'Unranked'}</td>
    </tr>)}</tbody></table></div><Pager page={page} size={20} count={history.length} change={setPage} label="Match pages" /></>
}
function Teammates({ mates, select }: { mates: Awaited<ReturnType<typeof loadMates>>, select: (id: number) => void }) {
  const loader = useCallback((signal: AbortSignal) => loadProfiles(mates.map((mate) => mate.mate_id), signal), [mates])
  const profiles = useResource(loader)
  if (!mates.length) return <p>No recorded teammates for this date range.</p>
  return <><Status resource={profiles} label="teammate profiles" /><ul className="teammate-list">{mates.map((mate) => {
      const profile = profiles.state.status === 'success' ? profiles.state.data.find((entry) => entry.account_id === mate.mate_id) : undefined
      const name = profile?.personaname || 'Account ' + mate.mate_id
      return <li key={mate.mate_id}><button className="teammate-link statistics-hero" onClick={() => select(mate.mate_id)}>
        {profile && <img src={profile.avatarmedium} alt="" width="36" height="36" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />}<span>{name}</span></button>
        <p>{mate.matches_played.toLocaleString()} shared games · {mate.wins.toLocaleString()} wins</p><Rate value={ratio(mate.wins, mate.matches_played)} label={name + ' shared win rate'} /></li>
    })}</ul></>
}

export function PlayerDashboard({ accountId, initialStats, initialWindow, select, overview }: {
  accountId: number, initialStats: AnalyticsHeroStats[], initialWindow: PlayerWindow, select: (id: number) => void, overview: () => void,
}) {
  const [filters, setFilters] = useState<PlayerFilters>(playerDefaults)
  const [resetVersion, setResetVersion] = useState(0)
  const [activeTab, setActiveTab] = useState<'matches' | 'heroes'>('matches')
  const matchTab = useRef<HTMLButtonElement>(null)
  const heroTab = useRef<HTMLButtonElement>(null)
  const [copyMessage, setCopyMessage] = useState('')
  const window = useMemo(() => filters.date === playerDefaults.date ? initialWindow : dateBounds(filters.date), [filters.date, initialWindow])
  const profile = useResource(useCallback((signal: AbortSignal) => loadProfiles([accountId], signal), [accountId]))
  const rank = useResource(useCallback((signal: AbortSignal) => loadRank(accountId, signal), [accountId]))
  const ranks = useResource(listRanks)
  const directory = useResource(loadHeroDirectory)
  const season = useResource(loadSeasonStart)
  const stats = useResource(useCallback((signal: AbortSignal) => loadPlayerStats(accountId, filters, window, signal), [accountId, filters, window]), initialStats)
  const details = useResource(useCallback((signal: AbortSignal) => loadPlayerHeroes(accountId, filters, window, signal), [accountId, filters, window]))
  const history = useResource(useCallback((signal: AbortSignal) => loadHistory(accountId, signal), [accountId]))
  const mates = useResource(useCallback((signal: AbortSignal) => loadMates(accountId, window, signal), [accountId, window]))
  const person = profile.state.status === 'success' ? profile.state.data.find((entry) => entry.account_id === accountId) : undefined
  const heroes = directory.state.status === 'success' ? directory.state.data : []
  const rankData = rank.state.status === 'success' ? rank.state.data : null
  const rankInfo = ranks.state.status === 'success' ? ranks.state.data.find((entry) => entry.tier === rankData?.rank) : undefined
  const seasonStart = season.state.status === 'success' ? season.state.data : null
  const filterKey = JSON.stringify(filters) + ':' + resetVersion
  const summary = stats.state.status === 'success' ? summarizePlayer(stats.state.data) : null
  const summaryItems: { label: string, value: ReactNode }[] = summary ? [
    { label: 'Recorded games', value: summary.games.toLocaleString() }, { label: 'Wins / losses', value: `${summary.wins} / ${summary.losses}` },
    { label: 'Win rate', value: <Rate value={summary.winRate} label="Player win rate" /> },
    { label: 'Average K / D / A', value: kdaText(summary.kda) }, { label: 'Aggregate KDA', value: decimal(summary.aggregate) },
  ] : []
  return <section className="player-dashboard" aria-labelledby="player-title">
    <div className="statistics-heading"><button className="theme-toggle" onClick={overview}>Back to overview</button><button className="theme-toggle" onClick={() => { setFilters(playerDefaults); setActiveTab('matches'); setResetVersion((value) => value + 1) }}>Reset</button></div>
    <header className="player-profile">
      {person && <img src={person.avatarfull} alt="" width="72" height="72" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />}
      <div><h1 id="player-title">{person?.personaname || 'Account ' + accountId}</h1>
        <div className="player-identity"><span>Account {accountId}</span><button className="theme-toggle" onClick={() => { navigator.clipboard.writeText(String(accountId)).then(() => setCopyMessage('Copied'), () => setCopyMessage('Couldn’t copy; select the account ID instead.')) }}>Copy ID</button><a href={steamProfileUrl(accountId)} target="_blank" rel="noreferrer">Steam profile</a><span role="status">{copyMessage}</span></div>
      </div>
      <div className="player-rank">{rankInfo && <img src={rankInfo.images.large ?? rankInfo.images.chalk ?? undefined} alt="" width="52" height="52" />}<span>Latest recorded rank<strong>{rankData?.badge ? (rankInfo?.name ?? 'Tier ' + rankData.rank) + ' ' + rankData.subrank : 'Unranked / unavailable'}</strong></span></div>
    </header>
    <Status resource={profile} label="profile" /><Status resource={rank} label="rank" /><Status resource={ranks} label="rank names" />
    <div className="statistics-controls player-controls">
      <fieldset className="radio-filter"><legend>Date</legend>{([7, 30] as const).map((days) => <label key={days}><input type="radio" name="player-date" checked={filters.date.kind === 'rolling' && filters.date.days === days} onChange={() => setFilters({ ...filters, date: { kind: 'rolling', days } })} />{days} days</label>)}
        <label><input type="radio" name="player-date" checked={filters.date.kind === 'all'} onChange={() => setFilters({ ...filters, date: { kind: 'all' } })} />All</label>
        {seasonStart !== null && <label><input type="radio" name="player-date" checked={filters.date.kind === 'season'} onChange={() => setFilters({ ...filters, date: { kind: 'season', start: seasonStart } })} />Season to date</label>}
      </fieldset><fieldset className="radio-filter"><legend>Matches</legend><label><input type="radio" name="player-mode" checked={filters.matchMode === 'ranked'} onChange={() => setFilters({ ...filters, matchMode: 'ranked' })} />Ranked only</label><label><input type="radio" name="player-mode" checked={filters.matchMode === 'ranked,unranked'} onChange={() => setFilters({ ...filters, matchMode: 'ranked,unranked' })} />All</label></fieldset>
    </div>
    {season.state.status === 'error' && <Status resource={season} label="season dates" />}
    <p className="statistics-note">{filters.date.kind === 'rolling' ? 'Last ' + filters.date.days + ' days' : filters.date.kind === 'all' ? 'All time' : 'Season to date'} · {filters.matchMode === 'ranked' ? 'Ranked only' : 'Ranked + unranked'} · Normal games · Recorded API data; history may be incomplete. Range ends at {new Date(window.maxUnixTimestamp * 1000).toLocaleString()}.</p>
    <section aria-label="Performance summary"><Status resource={stats} label="performance" />
      {summary && <><dl className="player-summary">{summaryItems.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl><p className="statistics-note">Aggregate KDA = (total kills + total assists) / total deaths. Wins and losses reflect API scoring; other outcomes may not count toward either.</p></>}
    </section>
    <Status resource={directory} label="hero names and portraits" />
    <div className="player-detail-layout">
      <div className="player-tab-content">
        <div role="tablist" aria-label="Player statistics" className="player-tabs" onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const next = event.key === 'Home' ? 'matches' : event.key === 'End' ? 'heroes' : activeTab === 'matches' ? 'heroes' : 'matches'
          setActiveTab(next)
          const target = next === 'matches' ? matchTab : heroTab
          target.current?.focus()
        }}>
          <button ref={matchTab} id="matches-tab" role="tab" aria-selected={activeTab === 'matches'} aria-controls="matches-panel" tabIndex={activeTab === 'matches' ? 0 : -1} onClick={() => setActiveTab('matches')}>Recent matches</button>
          <button ref={heroTab} id="heroes-tab" role="tab" aria-selected={activeTab === 'heroes'} aria-controls="heroes-panel" tabIndex={activeTab === 'heroes' ? 0 : -1} onClick={() => setActiveTab('heroes')}>Hero performance</button>
        </div>
        <section id="matches-panel" role="tabpanel" aria-labelledby="matches-tab" hidden={activeTab !== 'matches'} tabIndex={0}>
          <Status resource={history} label="match history" />{history.state.status === 'success' && <Matches key={filterKey} history={filteredHistory(history.state.data, filters, window)} heroes={heroes} />}
        </section>
        <section id="heroes-panel" role="tabpanel" aria-labelledby="heroes-tab" hidden={activeTab !== 'heroes'} tabIndex={0}>
          <Status resource={stats} label="hero performance" /><Status resource={details} label="playtime and last played" />
          {stats.state.status === 'success' && <HeroPerformance key={filterKey} stats={stats.state.data} details={details.state.status === 'success' ? details.state.data : null} heroes={heroes} />}
        </section>
      </div>
      <aside className="teammate-sidebar" aria-labelledby="teammates-title">
        <h2 id="teammates-title">Frequent teammates</h2>
        <p className="statistics-note">All match types · selected date range</p>
        <Status resource={mates} label="teammates" />
        {mates.state.status === 'success' && <Teammates mates={mates.state.data} select={select} />}
      </aside>
    </div>
  </section>
}
