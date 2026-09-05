import { useEffect, useState } from 'react'
import { listRanks, loadStatistics, type StatisticsData } from '../services/statistics'
import { defaults, metrics, topRows, type MetricId, type Preferences } from '../statistics'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'success', data: StatisticsData }

function StatisticsResults({ preferences, retry, sort }: { preferences: Preferences, retry: () => void, sort: (metric: MetricId) => void }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const { days, minRank, maxRank, matchMode } = preferences
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => loadStatistics({ days, minRank, maxRank, matchMode }, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setState({ status: 'success', data }) },
      () => { if (!controller.signal.aborted) setState({ status: 'error' }) },
    ), 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [days, minRank, maxRank, matchMode])

  if (state.status === 'loading') return <p role="status">Loading hero statistics…</p>
  if (state.status === 'error') return <div role="status"><p>Couldn’t load hero statistics.</p><button type="button" className="theme-toggle" onClick={retry}>Retry</button></div>
  const rows = topRows(state.data, preferences)
  const columns = metrics.filter((metric) => preferences.columns.includes(metric.id))
  const incomplete = state.data.bans === null || state.data.totalGames === null
  return (
    <>
      {incomplete && <p role="status">Some statistics are unavailable. <button type="button" className="theme-toggle" onClick={retry}>Retry</button></p>}
      {rows.length === 0 ? <p role="status">No active heroes meet this rank range and the 100-appearance minimum.</p> : (
        <div className="statistics-table-scroll" tabIndex={0} aria-label="Hero statistics table, scroll for more columns">
          <table className="statistics-table">
            <caption className="visually-hidden">Top five active heroes, sorted by {metrics.find((m) => m.id === preferences.sort)?.label}, {preferences.direction === 'desc' ? 'descending' : 'ascending'}</caption>
            <colgroup><col className="hero-column" /><col className="rate-column" /><col className="rate-column" /><col className="ban-column" /><col className="kda-column" /><col className="appearances-column" /></colgroup>
            <thead><tr><th scope="col">Hero</th>{columns.map((metric) => <th scope="col" key={metric.id}
              aria-sort={preferences.sort === metric.id ? preferences.direction === 'desc' ? 'descending' : 'ascending' : 'none'}>
              <button type="button" className="metric-sort" onClick={() => sort(metric.id)} title={'hint' in metric ? metric.hint : 'Sort by ' + metric.label}>
                {metric.id === 'banRate' ? 'Ban %' : metric.label}
                <span aria-hidden="true">{preferences.sort === metric.id ? preferences.direction === 'desc' ? ' ↓' : ' ↑' : ' ↕'}</span>
              </button>
            </th>)}</tr></thead>
            <tbody>{rows.map((row, index) => <tr key={row.hero.id}>
              <th scope="row"><span className="statistics-hero"><span className="statistics-position">{index + 1}</span>
                <img src={row.hero.images.icon_image_small_webp ?? row.hero.images.icon_image_small ?? undefined} alt="" width="40" height="40" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />
                {row.hero.name}</span></th>
              {columns.map((metric) => {
                const value = row.values[metric.id]
                const formatted = metric.format === 'kda'
                  ? row.averageKda.map((part) => part === null ? '—' : part.toFixed(1)).join(' / ')
                  : value === null ? '—' : metric.format === 'percent' ? `${(value * 100).toFixed(1)}%`
                    : value.toLocaleString(undefined, { maximumFractionDigits: metric.format === 'integer' ? 0 : 2 })
                return <td key={metric.id}>{(metric.id === 'winRate' || metric.id === 'pickRate') && value !== null ? (
                  <span className="percentage-bar" role="meter" aria-label={row.hero.name + ' ' + metric.label}
                    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, value * 100))}
                    aria-valuetext={formatted} title={formatted}>
                    <span className="percentage-fill" style={{ width: Math.min(100, Math.max(0, value * 100)) + '%' }} />
                    <span className="percentage-label percentage-label-filled" aria-hidden="true">{formatted}</span>
                    <span className="percentage-label percentage-label-remainder" aria-hidden="true">{(100 - Math.min(100, Math.max(0, value * 100))).toFixed(1)}%</span>
                  </span>
                ) : formatted}</td>
              })}
            </tr>)}</tbody>
          </table>
        </div>
      )}
      <p className="statistics-note">{state.data.totalGames?.toLocaleString() ?? '—'} filtered games · Updated {new Date(state.data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Range ends at the latest full hour</p>
    </>
  )
}

export function HeroStatistics() {
  const [preferences, setPreferences] = useState<Preferences>(defaults)
  const [draftRanks, setDraftRanks] = useState({ minRank: defaults.minRank, maxRank: defaults.maxRank })
  const [ranks, setRanks] = useState<Awaited<ReturnType<typeof listRanks>>>([])
  const [rankError, setRankError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    listRanks(controller.signal).then(
      (data) => { if (!controller.signal.aborted) { setRanks(data); setRankError(false) } },
      () => { if (!controller.signal.aborted) setRankError(true) },
    )
    return () => controller.abort()
  }, [attempt])
  function update(patch: Partial<Preferences>) { setPreferences((previous) => ({ ...previous, ...patch })) }
  function commitRanks() { update(draftRanks) }
  function reset() {
    setPreferences(defaults)
    setDraftRanks({ minRank: defaults.minRank, maxRank: defaults.maxRank })
  }
  const rankInputEvents = {
    onPointerDown: (event: React.PointerEvent<HTMLInputElement>) => event.currentTarget.setPointerCapture(event.pointerId),
    onPointerUp: commitRanks,
    onPointerCancel: () => setDraftRanks({ minRank: preferences.minRank, maxRank: preferences.maxRank }),
    onKeyUp: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) commitRanks()
    },
    onBlur: commitRanks,
  }
  const retry = () => setAttempt((value) => value + 1)
  const requestKey = `${preferences.days}:${preferences.minRank}:${preferences.maxRank}:${preferences.matchMode}:${attempt}`
  const rankName = (tier: number) => ranks.find((rank) => rank.tier === tier)?.name ?? 'Tier ' + tier
  const rankSummary = preferences.minRank === preferences.maxRank ? rankName(preferences.minRank)
    : preferences.maxRank === 11 ? rankName(preferences.minRank) + '+'
      : rankName(preferences.minRank) + '–' + rankName(preferences.maxRank)
  function sort(metric: MetricId) {
    update({ sort: metric, direction: preferences.sort === metric && preferences.direction === 'desc' ? 'asc' : 'desc' })
  }
  return (
    <section className="hero-statistics" aria-labelledby="statistics-title">
      <div className="statistics-heading"><h1 id="statistics-title">Top heroes</h1><button type="button" className="theme-toggle" onClick={reset}>Reset</button></div>
      <div className="statistics-controls">
        <button type="button" className="theme-toggle" popoverTarget="rank-popup" aria-label={"Edit average match rank: " + rankSummary}>{rankSummary} <span aria-hidden="true">▾</span></button>
        <div id="rank-popup" className="rank-popup" popover="auto">
        <div className="rank-popup-heading"><strong>Average match rank</strong><button type="button" className="theme-toggle" popoverTarget="rank-popup" popoverTargetAction="hide" aria-label="Close rank selector">✕</button></div>
        <fieldset className="rank-filter">
          <legend className="visually-hidden">Average match rank</legend>
          <div className="rank-labels"><span>{ranks.find((rank) => rank.tier === draftRanks.minRank)?.name ?? 'Tier ' + draftRanks.minRank}</span><span>{ranks.find((rank) => rank.tier === draftRanks.maxRank)?.name ?? 'Tier ' + draftRanks.maxRank}</span></div>
          <div className="rank-slider">
            <div className="rank-slider-track"><div className="rank-notches" aria-hidden="true">{ranks.map((rank) => <i key={rank.tier} style={{ left: (rank.tier - 1) * 10 + '%' }} />)}</div><span style={{ left: (draftRanks.minRank - 1) * 10 + '%', right: (11 - draftRanks.maxRank) * 10 + '%' }} /></div>
            <input {...rankInputEvents} type="range" min="1" max="11" step="1" value={draftRanks.minRank}
              aria-label="From rank" aria-valuetext={ranks.find((rank) => rank.tier === draftRanks.minRank)?.name}
              disabled={!ranks.length} style={{ zIndex: draftRanks.minRank === 11 ? 3 : 1 }}
              onChange={(event) => setDraftRanks({ ...draftRanks, minRank: Math.min(Number(event.target.value), draftRanks.maxRank) })} />
            <input {...rankInputEvents} type="range" min="1" max="11" step="1" value={draftRanks.maxRank}
              aria-label="To rank" aria-valuetext={ranks.find((rank) => rank.tier === draftRanks.maxRank)?.name}
              disabled={!ranks.length}
              onChange={(event) => setDraftRanks({ ...draftRanks, maxRank: Math.max(Number(event.target.value), draftRanks.minRank) })} />
          </div>
          <div className="rank-icons">{ranks.map((rank) => <span key={rank.tier} title={rank.name} style={{ left: (rank.tier - 1) * 10 + '%' }}>
            <img src={rank.images.large ?? rank.images.chalk_webp ?? rank.images.chalk ?? undefined} alt={rank.name} width="36" height="36" />
          </span>)}</div>
        </fieldset>
        </div>
      </div>
      {rankError && <p role="status">Rank names unavailable. <button type="button" className="theme-toggle" onClick={retry}>Retry</button></p>}
      <p className="statistics-note">Last 7 days · Ranked · At least 100 appearances · {preferences.direction === 'desc' ? 'Highest first' : 'Lowest first'}</p>
      <StatisticsResults key={requestKey} preferences={preferences} retry={retry} sort={sort} />
    </section>
  )
}
