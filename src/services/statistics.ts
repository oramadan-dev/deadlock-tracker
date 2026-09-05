import { AnalyticsApi } from 'deadlock_api_client/apis/analytics-api'
import { RanksApi } from 'deadlock_api_client/apis/ranks-api'
import type { AnalyticsHeroStats } from 'deadlock_api_client/models/analytics-hero-stats'
import type { HeroBanStats } from 'deadlock_api_client/models/hero-ban-stats'
import { listHeroes, type HeroSummary } from './heroes.ts'

export type StatisticsFilters = {
  days: number
  minRank: number
  maxRank: number
  matchMode: string
}

export type StatisticsData = {
  heroes: HeroSummary[]
  stats: AnalyticsHeroStats[]
  bans: HeroBanStats[] | null
  totalGames: number | null
  fetchedAt: number
}

const analytics = new AnalyticsApi()
const ranks = new RanksApi()

export async function listRanks(signal: AbortSignal) {
  const { data } = await ranks.listRanks({ language: 'english' }, { signal, timeout: 15000 })
  return data.filter((rank) => rank.tier > 0).sort((a, b) => a.tier - b.tier)
}

export async function loadStatistics(filters: StatisticsFilters, signal: AbortSignal): Promise<StatisticsData> {
  // Round to the hour so identical requests can benefit from the API cache.
  const end = Math.floor(Date.now() / 3600000) * 3600
  const common = {
    bucket: 'no_bucket' as const,
    matchMode: filters.matchMode,
    minUnixTimestamp: end - filters.days * 86400,
    maxUnixTimestamp: end,
    minAverageBadge: filters.minRank * 10 + 1,
    maxAverageBadge: filters.maxRank * 10 + 6,
  }
  const options = { signal, timeout: 20000 }
  const [heroes, stats, bans, games] = await Promise.allSettled([
    listHeroes(signal),
    analytics.heroStats({ ...common, gameMode: 'normal' }, options),
    analytics.heroBanStats(common, options),
    analytics.gameStats({ ...common, gameMode: 'normal' }, options),
  ])
  signal.throwIfAborted()
  if (heroes.status === 'rejected') throw heroes.reason
  if (stats.status === 'rejected') throw stats.reason
  return {
    heroes: heroes.value,
    stats: stats.value.data,
    bans: bans.status === 'fulfilled' ? bans.value.data : null,
    totalGames: games.status === 'fulfilled' && games.value.data.length > 0
      ? games.value.data.reduce((sum, game) => sum + game.total_matches, 0) : null,
    fetchedAt: Date.now(),
  }
}
