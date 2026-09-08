import { PercentageBar } from '../DataDisplay/PercentageBar'
import { useEffect, useState } from 'react'
import { loadStatistics, type StatisticsData } from '../../services/statistics'
import { metrics, topRows, formatStatisticMetric, type MetricId, type Preferences } from '../../statistics'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'success', data: StatisticsData }

type StatisticsResultsProps = {
  preferences: Preferences
  retry: () => void
  sort: (metric: MetricId) => void
}

export function StatisticsResults({ preferences, retry, sort }: StatisticsResultsProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const { date, minRank, maxRank, matchMode } = preferences
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => loadStatistics({ date, minRank, maxRank, matchMode }, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setState({ status: 'success', data }) },
      () => { if (!controller.signal.aborted) setState({ status: 'error' }) },
    ), 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [date, minRank, maxRank, matchMode])

  if (state.status === 'loading') return <p role="status">Loading hero statistics…</p>
  if (state.status === 'error') return <div role="status">
    <p>Couldn’t load hero statistics.</p>
    <button type="button" className="theme-toggle" onClick={retry}>Retry</button>
  </div>
  const incomplete = state.data.bans === null || state.data.totalGames === null

  return (
    <>
      {incomplete && <p role="status">Some statistics are unavailable. <button type="button" className="theme-toggle" onClick={retry}>Retry</button>
      </p>}
      <StatisticsTable data={state.data} preferences={preferences} sort={sort} />
      <p className="statistics-note">
        {state.data.totalGames?.toLocaleString() ?? '—'} filtered games · Updated {new Date(state.data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Range ends at the latest full hour</p>
    </>
  )
}


type StatisticsTableProps = {
  data: StatisticsData
  preferences: Preferences
  sort: (metric: MetricId) => void
}

function StatisticsTable({ data, preferences, sort }: StatisticsTableProps) {
  const rows = topRows(data, preferences)
  const columns = metrics.filter((metric) => preferences.columns.includes(metric.id))

  if (rows.length === 0) return <p role="status">No active heroes meet this rank range and the 100-appearance minimum.</p>

  return (
    <div
      className="statistics-table-scroll"
      tabIndex={0}
      aria-label="Hero statistics table, scroll for more columns">
      <table className="statistics-table">
        <caption className="visually-hidden">Top five active heroes, sorted by {metrics.find((m) => m.id === preferences.sort)?.label}
          , {preferences.direction === 'desc' ? 'descending' : 'ascending'}
        </caption>
        <colgroup>
          <col className="hero-column" />
          <col className="rate-column" />
          <col className="rate-column" />
          <col className="ban-column" />
          <col className="kda-column" />
          <col className="appearances-column" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Hero</th>
            {columns.map((metric) => {
              const selected = preferences.sort === metric.id
              const direction = preferences.direction === 'desc' ? 'descending' : 'ascending'
              const arrow = preferences.direction === 'desc' ? ' ↓' : ' ↑'
              return <th
                scope="col"
                key={metric.id}
                aria-sort={selected ? direction : 'none'}>
                <button
                  type="button"
                  className="metric-sort"
                  onClick={() => sort(metric.id)}
                  title={'hint' in metric ? metric.hint : 'Sort by ' + metric.label}>
                  <span className="metric-sort-label">{metric.id === 'banRate' ? 'Ban %' : metric.label}</span>
                  {selected && <span className="metric-sort-indicator" aria-hidden="true">
                    {arrow}
                  </span>}
                </button>
              </th>
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => <tr key={row.hero.id}>
            <th scope="row">
              <span className="statistics-hero">
                <span className="statistics-position">
                  {index + 1}
                </span>
                <img
                  src={row.hero.images.icon_image_small_webp ?? row.hero.images.icon_image_small ?? undefined}
                  alt=""
                  width="40"
                  height="40"
                  onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />
                {row.hero.name}
              </span>
            </th>
            {columns.map((metric) => {
              const value = row.values[metric.id]
              const formatted = formatStatisticMetric(row, metric)
              return <td key={metric.id}>
                {(metric.id === 'winRate' || metric.id === 'pickRate') && value !== null ? (
                  <PercentageBar value={value} label={row.hero.name + ' ' + metric.label} formattedValue={formatted} title={formatted} />
                ) : formatted}
              </td>
            })}
          </tr>)}
        </tbody>
      </table>
    </div>
  )
}
