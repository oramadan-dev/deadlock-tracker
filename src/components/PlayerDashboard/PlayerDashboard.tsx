import { PlayerProfile, PlayerSummary } from './PlayerProfile'
import { StatisticsFilters } from '../DataDisplay/StatisticsFilters'
import { useCallback, useMemo, useRef, type KeyboardEvent } from 'react'
import { useResource } from '../../hooks/useResource'
import { HeroPerformance, Matches, Teammates } from './PlayerDetails'
import { Status } from './PlayerPresentation'
import { changePlayerFilters, defaultPlayerView, type PlayerView } from '../../navigation'
import { filteredHistory, summarizePlayer } from '../../player'
import { dateBounds, listRanks, loadSeasonStart } from '../../services/statistics'
import {
  loadHeroDirectory, loadHistory, loadMates, loadPlayerHeroes, loadPlayerStats, loadProfiles, loadRank,
} from '../../services/players'

type PlayerDashboardProps = {
  view: PlayerView
  change: (view: PlayerView) => void
  openMatch: (matchId: number) => void
  select: (id: number) => void
  overview: () => void
}

export function PlayerDashboard({ view, change, openMatch, select, overview }: PlayerDashboardProps) {
  const { accountId, filters, tab: activeTab } = view
  function setActiveTab(tab: PlayerView['tab']) { change({ ...view, tab }) }
  const matchTab = useRef<HTMLButtonElement>(null)
  const heroTab = useRef<HTMLButtonElement>(null)
  const window = useMemo(() => dateBounds(filters.date), [filters.date])
  const profile = useResource(useCallback((signal: AbortSignal) => loadProfiles([accountId], signal), [accountId]))
  const rank = useResource(useCallback((signal: AbortSignal) => loadRank(accountId, signal), [accountId]))
  const ranks = useResource(listRanks)
  const directory = useResource(loadHeroDirectory)
  const season = useResource(loadSeasonStart)
  const stats = useResource(useCallback((signal: AbortSignal) => loadPlayerStats(accountId, filters, window, signal), [accountId, filters, window]))
  const details = useResource(useCallback((signal: AbortSignal) => loadPlayerHeroes(accountId, filters, window, signal), [accountId, filters, window]))
  const history = useResource(useCallback((signal: AbortSignal) => loadHistory(accountId, signal), [accountId]))
  const filteredMatches = useMemo(() => history.state.status === 'success' ? filteredHistory(history.state.data, filters, window) : [], [history.state, filters, window])
  const mates = useResource(useCallback((signal: AbortSignal) => loadMates(accountId, window, signal), [accountId, window]))
  const person = profile.state.status === 'success' ? profile.state.data.find((entry) => entry.account_id === accountId) : undefined
  const heroes = directory.state.status === 'success' ? directory.state.data : []
  const rankData = rank.state.status === 'success' ? rank.state.data : null
  const rankInfo = ranks.state.status === 'success' ? ranks.state.data.find((entry) => entry.tier === rankData?.rank) : undefined
  const seasonStart = season.state.status === 'success' ? season.state.data : null
  const summary = stats.state.status === 'success' ? summarizePlayer(stats.state.data) : null

  function resetDashboard() {
    change(defaultPlayerView(accountId))
  }

  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()

    let nextTab: 'matches' | 'heroes' = activeTab === 'matches' ? 'heroes' : 'matches'
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
    <PlayerProfile accountId={accountId} person={person} rankData={rankData} rankInfo={rankInfo} />
    <Status resource={profile} label="profile" />
    <Status resource={rank} label="rank" />
    <Status resource={ranks} label="rank names" />
    <div className="statistics-controls player-controls">
      <StatisticsFilters
        date={filters.date}
        matchMode={filters.matchMode}
        seasonStart={seasonStart}
        dateGroupName="player-date"
        matchGroupName="player-mode"
        onChange={(patch) => change(changePlayerFilters(view, patch))}
      />
    </div>
    {season.state.status === 'error' && <Status resource={season} label="season dates" />}
    <p className="statistics-note">
      {filters.date.kind === 'rolling' ? 'Last ' + filters.date.days + ' days' : filters.date.kind === 'all' ? 'All time' : 'Season to date'} · {filters.matchMode === 'ranked' ? 'Ranked only' : 'Ranked + unranked'} · Normal games · Recorded API data; history may be incomplete. Range ends at {new Date(window.maxUnixTimestamp * 1000).toLocaleString()}
      .</p>
    <section aria-label="Performance summary">
      <Status resource={stats} label="performance" />
      <PlayerSummary summary={summary} />
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
          {history.state.status === 'success' && <Matches pageIndex={view.matchPage} changePage={(matchPage) => change({ ...view, matchPage })} openMatch={openMatch} allHistory={history.state.data} history={filteredMatches} heroes={heroes} />}
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
            pageIndex={view.heroPage}
            sorting={view.sorting}
            changePage={(heroPage) => change({ ...view, heroPage })}
            changeSort={(sorting) => change({ ...view, sorting, heroPage: 0 })}
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
