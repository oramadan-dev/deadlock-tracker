import { StatisticsFilters } from '../DataDisplay/StatisticsFilters'
import { StatisticsResults } from './StatisticsResults'
import { RankSelector } from './RankSelector'
import { useEffect, useState } from 'react'
import { listRanks, loadSeasonStart } from '../../services/statistics'
import { defaults, type MetricId, type Preferences } from '../../statistics'

export function HeroStatistics() {
  const [preferences, setPreferences] = useState<Preferences>(defaults)
  const [ranks, setRanks] = useState<Awaited<ReturnType<typeof listRanks>>>([])
  const [seasonStart, setSeasonStart] = useState<number | null>(null)
  const [seasonError, setSeasonError] = useState(false)
  const [seasonAttempt, setSeasonAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    loadSeasonStart(controller.signal).then(
      (start) => { if (!controller.signal.aborted) { setSeasonStart(start); setSeasonError(false) } },
      () => { if (!controller.signal.aborted) setSeasonError(true) },
    )
    return () => controller.abort()
  }, [seasonAttempt])
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
  const retry = () => setAttempt((value) => value + 1)
  const requestKey = `${JSON.stringify(preferences.date)}:${preferences.minRank}:${preferences.maxRank}:${preferences.matchMode}:${attempt}`
  function sort(metric: MetricId) {
    update({ sort: metric, direction: preferences.sort === metric && preferences.direction === 'desc' ? 'asc' : 'desc' })
  }

  return (
    <section className="hero-statistics" aria-label="Top heroes">
      <div className="statistics-controls">
        <RankSelector minRank={preferences.minRank} maxRank={preferences.maxRank} ranks={ranks} onChange={update} />
        <StatisticsFilters
          date={preferences.date}
          matchMode={preferences.matchMode}
          seasonStart={seasonStart}
          dateGroupName="statistics-date"
          matchGroupName="statistics-matches"
          allMatchesTitle="Ranked and unranked"
          onChange={update}
        />
      </div>
      {seasonError && <p role="status">Season dates unavailable. <button type="button" className="theme-toggle" onClick={() => setSeasonAttempt((value) => value + 1)}>Retry season dates</button>
      </p>}
      {rankError && <p role="status">Rank names unavailable. <button type="button" className="theme-toggle" onClick={retry}>Retry</button>
      </p>}
      <p className="statistics-note">
        {preferences.date.kind === 'rolling' ? 'Last ' + preferences.date.days + ' days' : preferences.date.kind === 'all' ? 'All time' : 'Season to date'} · {preferences.matchMode === 'ranked' ? 'Ranked' : 'Ranked + unranked'} · At least 100 appearances · {preferences.direction === 'desc' ? 'Highest first' : 'Lowest first'}
      </p>
      <StatisticsResults key={requestKey} preferences={preferences} retry={retry} sort={sort} />
    </section>
  )
}
