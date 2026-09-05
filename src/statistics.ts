import type { StatisticsData, StatisticsFilters } from './services/statistics.ts'

export const metrics = [
  { id: 'winRate', label: 'Win %', format: 'percent', hint: 'Wins / hero appearances.' },
  { id: 'pickRate', label: 'Pick %', format: 'percent', hint: 'Hero appearances / all games with these filters.' },
  { id: 'banRate', label: 'Recorded ban %', format: 'percent', hint: 'Recorded bans / all games with these filters. Missing demo ban data makes this an underestimate of the true ban rate.' },
  { id: 'kda', label: 'Average K / D / A', format: 'kda', hint: 'Average kills, deaths, and assists per hero appearance. Sorting uses the aggregate KDA ratio.' },
  { id: 'matches', label: 'Appearances', format: 'integer', hint: 'Number of player appearances on this hero.' },
  { id: 'ratio', label: 'Aggregate KDA', format: 'decimal', hint: '(Total kills + total assists) / total deaths; not the mean of individual ratios.' },
  { id: 'wins', label: 'Wins', format: 'integer' },
  { id: 'losses', label: 'Losses', format: 'integer' },
  { id: 'bans', label: 'Recorded bans', format: 'integer', hint: 'Only bans successfully extracted from demos.' },
  { id: 'netWorth', label: 'Avg. net worth', format: 'integer' },
  { id: 'lastHits', label: 'Avg. last hits', format: 'decimal' },
  { id: 'denies', label: 'Avg. denies', format: 'decimal' },
  { id: 'damage', label: 'Avg. hero damage', format: 'integer' },
  { id: 'taken', label: 'Avg. damage taken', format: 'integer' },
  { id: 'boss', label: 'Avg. boss damage', format: 'integer' },
  { id: 'creep', label: 'Avg. creep damage', format: 'integer' },
  { id: 'neutral', label: 'Avg. neutral damage', format: 'integer' },
  { id: 'health', label: 'Avg. max health', format: 'integer' },
  { id: 'accuracy', label: 'Shot accuracy', format: 'percent', hint: 'Total shots hit / total shots hit and missed.' },
] as const

export type MetricId = typeof metrics[number]['id']
export type Preferences = StatisticsFilters & {
  minimum: number
  sort: MetricId
  direction: 'desc' | 'asc'
  columns: MetricId[]
}

export const defaults: Preferences = {
  date: { kind: 'rolling', days: 7 }, minRank: 9, maxRank: 11, matchMode: 'ranked', minimum: 100,
  sort: 'winRate', direction: 'desc', columns: ['winRate', 'pickRate', 'banRate', 'kda', 'matches'],
}

function divide(numerator: number, denominator: number | null) {
  return denominator !== null && denominator > 0 && Number.isFinite(numerator)
    ? numerator / denominator : null
}

export function calculateRows(data: StatisticsData) {
  const heroes = new Map(data.heroes.map((hero) => [hero.id, hero]))
  const bans = new Map(data.bans?.map((ban) => [ban.hero_id, ban.bans]))
  return data.stats.flatMap((s) => {
    const hero = heroes.get(s.hero_id)
    if (!hero) return []
    const recordedBans = data.bans === null ? null : bans.get(s.hero_id) ?? 0
    const ratio = divide(s.total_kills + s.total_assists, s.total_deaths)
    const values: Record<MetricId, number | null> = {
      winRate: divide(s.wins, s.matches), pickRate: divide(s.matches, data.totalGames),
      banRate: recordedBans === null ? null : divide(recordedBans, data.totalGames),
      kda: ratio, ratio, matches: s.matches, wins: s.wins, losses: s.losses, bans: recordedBans,
      netWorth: divide(s.total_net_worth, s.matches), lastHits: divide(s.total_last_hits, s.matches),
      denies: divide(s.total_denies, s.matches), damage: divide(s.total_player_damage, s.matches),
      taken: divide(s.total_player_damage_taken, s.matches), boss: divide(s.total_boss_damage, s.matches),
      creep: divide(s.total_creep_damage, s.matches), neutral: divide(s.total_neutral_damage, s.matches),
      health: divide(s.total_max_health, s.matches), accuracy: divide(s.total_shots_hit, s.total_shots_hit + s.total_shots_missed),
    }
    return [{ hero, values, averageKda: [divide(s.total_kills, s.matches), divide(s.total_deaths, s.matches), divide(s.total_assists, s.matches)] }]
  })
}

export function topRows(data: StatisticsData, preferences: Preferences) {
  return calculateRows(data).filter((row) => (row.values.matches ?? 0) >= preferences.minimum)
    .sort((a, b) => {
      const left = a.values[preferences.sort]
      const right = b.values[preferences.sort]
      if (left === null && right !== null) return 1
      if (right === null && left !== null) return -1
      const difference = left !== null && right !== null ? left - right : 0
      return difference * (preferences.direction === 'asc' ? 1 : -1)
        || (b.values.matches ?? 0) - (a.values.matches ?? 0) || a.hero.id - b.hero.id
    })
}
