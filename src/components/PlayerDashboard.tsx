import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useResource } from '../hooks/useResource'
import { HeroPerformance, Matches, Teammates } from './PlayerDetails'
import { Rate, Status } from './PlayerPresentation'
import { formatPlayerNumber, formatPlayerKda, filteredHistory, steamProfileUrl, summarizePlayer } from '../player'
import { dateBounds, listRanks, loadSeasonStart } from '../services/statistics'
import {
  loadHeroDirectory, loadHistory, loadMates, loadPlayerHeroes, loadPlayerStats, loadProfiles, loadRank, playerDefaults,
  type AnalyticsHeroStats, type PlayerFilters, type PlayerWindow
} from '../services/players'

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
  const filteredMatches = useMemo(() => history.state.status === 'success' ? filteredHistory(history.state.data, filters, window) : [], [history.state, filters, window])
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
    { label: 'Average K / D / A', value: formatPlayerKda(summary.kda) }, { label: 'Aggregate KDA', value: formatPlayerNumber(summary.aggregate) },
  ] : []

  function resetDashboard() {
    setFilters(playerDefaults)
    setActiveTab('matches')
    setResetVersion((previous) => previous + 1)
  }

  function copyAccountId() {
    navigator.clipboard.writeText(String(accountId)).then(
      () => setCopyMessage('Copied'),
      () => setCopyMessage('Couldn’t copy; select the account ID instead.'),
    )
  }

  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()

    let nextTab = activeTab === 'matches' ? 'heroes' as const : 'matches' as const
    if (event.key === 'Home') nextTab = 'matches'
    if (event.key === 'End') nextTab = 'heroes'
    setActiveTab(nextTab)
    const target = nextTab === 'matches' ? matchTab : heroTab
    target.current?.focus()
  }

  return <section className="player-dashboard" aria-labelledby="player-title">
    <div className="statistics-heading">
      <button className="theme-toggle" onClick={overview}>Back to overview</button>
      <button
        className="theme-toggle"
        onClick={resetDashboard}>Reset</button>
    </div>
    <header className="player-profile">
      {person && <img
        src={person.avatarfull}
        alt=""
        width="72"
        height="72"
        onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />}
      <div>
        <h1 id="player-title">
          {person?.personaname || 'Account ' + accountId}
        </h1>
        <div className="player-identity">
          <span>Account {accountId}
          </span>
          <button
            className="theme-toggle"
            onClick={copyAccountId}>Copy ID</button>
          <a href={steamProfileUrl(accountId)} target="_blank" rel="noreferrer">Steam profile</a>
          <span role="status">
            {copyMessage}
          </span>
        </div>
      </div>
      <div className="player-rank">
        {rankInfo && <img src={rankInfo.images.large ?? rankInfo.images.chalk ?? undefined} alt="" width="52" height="52" />}
        <span>Latest recorded rank
          <strong>
            {rankData?.badge ? (rankInfo?.name ?? 'Tier ' + rankData.rank) + ' ' + rankData.subrank : 'Unranked / unavailable'}
          </strong>
        </span>
      </div>
    </header>
    <Status resource={profile} label="profile" />
    <Status resource={rank} label="rank" />
    <Status resource={ranks} label="rank names" />
    <div className="statistics-controls player-controls">
      <fieldset className="radio-filter">
        <legend>Date</legend>
        {([7, 30] as const).map((days) => <label key={days}>
          <input
            type="radio"
            name="player-date"
            checked={filters.date.kind === 'rolling' && filters.date.days === days}
            onChange={() => setFilters({ ...filters, date: { kind: 'rolling', days } })} />
          {days} days</label>)}
        <label>
          <input
            type="radio"
            name="player-date"
            checked={filters.date.kind === 'all'}
            onChange={() => setFilters({ ...filters, date: { kind: 'all' } })} />
          All</label>

        {seasonStart !== null && <label>
          <input
            type="radio"
            name="player-date"
            checked={filters.date.kind === 'season'}
            onChange={() => setFilters({ ...filters, date: { kind: 'season', start: seasonStart } })} />
          Season to date</label>}
      </fieldset>
      <fieldset className="radio-filter">
        <legend>Matches</legend>
        <label>
          <input
            type="radio"
            name="player-mode"
            checked={filters.matchMode === 'ranked'}
            onChange={() => setFilters({ ...filters, matchMode: 'ranked' })} />
          Ranked only</label>
        <label>
          <input
            type="radio"
            name="player-mode"
            checked={filters.matchMode === 'ranked,unranked'}
            onChange={() => setFilters({ ...filters, matchMode: 'ranked,unranked' })} />
          All</label>
      </fieldset>
    </div>
    {season.state.status === 'error' && <Status resource={season} label="season dates" />}
    <p className="statistics-note">
      {filters.date.kind === 'rolling' ? 'Last ' + filters.date.days + ' days' : filters.date.kind === 'all' ? 'All time' : 'Season to date'} · {filters.matchMode === 'ranked' ? 'Ranked only' : 'Ranked + unranked'} · Normal games · Recorded API data; history may be incomplete. Range ends at {new Date(window.maxUnixTimestamp * 1000).toLocaleString()}
      .</p>
    <section aria-label="Performance summary">
      <Status resource={stats} label="performance" />
      {summary && <>
        <dl className="player-summary">
          {summaryItems.map((item) => <div key={item.label}>
            <dt>
              {item.label}
            </dt>
            <dd>
              {item.value}
            </dd>
          </div>)}
        </dl>
        <p className="statistics-note">Aggregate KDA = (total kills + total assists) / total deaths. Wins and losses reflect API scoring; other outcomes may not count toward either.</p>
      </>}
    </section>
    <Status resource={directory} label="hero names and portraits" />
    <div className="player-detail-layout">
      <div className="player-tab-content">
        <div
          role="tablist"
          aria-label="Player statistics"
          className="player-tabs"
          onKeyDown={navigateTabs}>
          <button
            ref={matchTab}
            id="matches-tab"
            role="tab"
            aria-selected={activeTab === 'matches'}
            aria-controls="matches-panel"
            tabIndex={activeTab === 'matches' ? 0 : -1}
            onClick={() => setActiveTab('matches')}>Recent matches</button>
          <button
            ref={heroTab}
            id="heroes-tab"
            role="tab"
            aria-selected={activeTab === 'heroes'}
            aria-controls="heroes-panel"
            tabIndex={activeTab === 'heroes' ? 0 : -1}
            onClick={() => setActiveTab('heroes')}>Hero performance</button>
        </div>
        <section
          id="matches-panel"
          role="tabpanel"
          aria-labelledby="matches-tab"
          hidden={activeTab !== 'matches'}
          tabIndex={0}>
          <Status resource={history} label="match history" />
          {history.state.status === 'success' && <Matches key={filterKey} allHistory={history.state.data} history={filteredMatches} heroes={heroes} />}
        </section>
        <section
          id="heroes-panel"
          role="tabpanel"
          aria-labelledby="heroes-tab"
          hidden={activeTab !== 'heroes'}
          tabIndex={0}>
          <Status resource={stats} label="hero performance" />
          <Status resource={details} label="playtime and last played" />
          {stats.state.status === 'success' && <HeroPerformance
            key={filterKey}
            stats={stats.state.data}
            details={details.state.status === 'success' ? details.state.data : null}
            heroes={heroes} />}
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
