import type { DateSelection, StatisticsFilters as AnalyticsFilters } from '../../services/statistics'

type StatisticsFiltersProps = {
  date: DateSelection
  matchMode: AnalyticsFilters['matchMode']
  seasonStart: number | null
  dateGroupName: string
  matchGroupName: string
  allMatchesTitle?: string
  onChange: (patch: Partial<Pick<AnalyticsFilters, 'date' | 'matchMode'>>) => void
}

export function StatisticsFilters({
  date, matchMode, seasonStart, dateGroupName, matchGroupName, allMatchesTitle, onChange,
}: StatisticsFiltersProps) {
  return (
    <>
      <fieldset className="radio-filter">
        <legend>Date</legend>
        {([7, 30] as const).map((days) => (
          <label key={days}>
            <input
              type="radio"
              name={dateGroupName}
              checked={date.kind === 'rolling' && date.days === days}
              onChange={() => onChange({ date: { kind: 'rolling', days } })}
            />
            {days} days
          </label>
        ))}
        <label>
          <input
            type="radio"
            name={dateGroupName}
            checked={date.kind === 'all'}
            onChange={() => onChange({ date: { kind: 'all' } })}
          />
          All
        </label>
        {seasonStart !== null && (
          <label>
            <input
              type="radio"
              name={dateGroupName}
              checked={date.kind === 'season'}
              onChange={() => onChange({ date: { kind: 'season', start: seasonStart } })}
            />
            Season to date
          </label>
        )}
      </fieldset>
      <fieldset className="radio-filter">
        <legend>Matches</legend>
        <label>
          <input
            type="radio"
            name={matchGroupName}
            checked={matchMode === 'ranked'}
            onChange={() => onChange({ matchMode: 'ranked' })}
          />
          Ranked only
        </label>
        <label title={allMatchesTitle}>
          <input
            type="radio"
            name={matchGroupName}
            checked={matchMode === 'ranked,unranked'}
            onChange={() => onChange({ matchMode: 'ranked,unranked' })}
          />
          All
        </label>
      </fieldset>
    </>
  )
}
