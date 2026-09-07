import type { AnalyticsHeroStats, PlayerMatchHistoryEntry, PlayerFilters, PlayerWindow, loadPlayerHeroes, loadHeroDirectory } from './services/players.ts'
const steamBase = 76561197960265728n
const maxAccount = 4294967295n

export type PlayerQuery = { kind: 'account', accountId: number } | { kind: 'name', name: string }

export function parsePlayerQuery(input: string): PlayerQuery {
  let value = input.trim()
  if (!value) throw new Error('Enter a Steam name or account ID.')
  let force64 = false
  if (/^(https?:\/\/|(?:www\.)?steamcommunity\.com\/)/i.test(value)) {
    const url = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value)
    if (!['steamcommunity.com', 'www.steamcommunity.com'].includes(url.hostname) || url.username || url.password) throw new Error('Enter a numeric Steam profile URL or an account ID.')
    if (/^\/id\//i.test(url.pathname)) throw new Error('Custom Steam URLs are not supported yet. Use your display name or account ID.')
    const match = url.pathname.match(/^\/profiles\/(\d+)\/?$/)
    if (!match) throw new Error('Enter a numeric Steam profile URL or an account ID.')
    value = match[1]
    force64 = true
  }
  const steam3 = value.match(/^\[U:1:(\d+)\]$/i)
  if (steam3) value = steam3[1]
  else if (value.startsWith('[') || /^STEAM_/i.test(value)) throw new Error('Use an account ID, SteamID64, or [U:1:accountId].')
  if (/^\d+$/.test(value)) {
    let id = BigInt(value)
    if (force64 || (!steam3 && id > maxAccount)) id -= steamBase
    if (id < 1n || id > maxAccount) throw new Error('The account ID is outside the valid range.')
    return { kind: 'account', accountId: Number(id) }
  }
  if (/^[+-]?\d+(?:\.\d+)?$/.test(value)) throw new Error('Account IDs must be positive whole numbers.')

  return { kind: 'name', name: value }
}

export function steamProfileUrl(accountId: number) {

  return 'https://steamcommunity.com/profiles/' + (steamBase + BigInt(accountId))
}

export function ratio(numerator: number, denominator: number) { return denominator > 0 ? numerator / denominator : null }

export function summarizePlayer(stats: AnalyticsHeroStats[]) {
  const totals = { games: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 }
  for (const hero of stats) {
    totals.games += hero.matches
    totals.wins += hero.wins
    totals.losses += hero.losses
    totals.kills += hero.total_kills
    totals.deaths += hero.total_deaths
    totals.assists += hero.total_assists
  }


  return {
    ...totals,
    winRate: ratio(totals.wins, totals.games),
    kda: [
      ratio(totals.kills, totals.games),
      ratio(totals.deaths, totals.games),
      ratio(totals.assists, totals.games),
    ],
    aggregate: ratio(totals.kills + totals.assists, totals.deaths),
  }
}
// SteamDatabase/Protobufs, deadlock/citadel_gcmessages_common.proto:
// ECitadelGameMode Normal=1; ECitadelMatchMode Unranked=1, Ranked=4.

export function filteredHistory(history: PlayerMatchHistoryEntry[], filters: PlayerFilters, window: PlayerWindow) {
  // Preserve the last API entry when a match appears more than once.
  const uniqueMatches = new Map(history.map((match) => [match.match_id, match]))
  const matchesInRange = [...uniqueMatches.values()].filter((match) => {
    const normalGame = match.game_mode === 1
    const selectedMode = match.match_mode === 4
      || (filters.matchMode === 'ranked,unranked' && match.match_mode === 1)
    const selectedDate = match.start_time >= window.minUnixTimestamp
      && match.start_time <= window.maxUnixTimestamp
    return normalGame && selectedMode && selectedDate
  })

  return matchesInRange.sort((a, b) => b.start_time - a.start_time || b.match_id - a.match_id)
}

export function matchOutcome(outcome: number) {

  return ['Invalid', 'Win', 'Loss', 'Penalized', 'Penalized party', 'Not scored'][outcome] ?? 'Unknown'
}

export function compareMetric(left: number | string | null, right: number | string | null, direction: 'asc' | 'desc') {
  if (left === null) return right === null ? 0 : 1
  if (right === null) return -1
  const difference = typeof left === 'string' && typeof right === 'string' ? left.localeCompare(right) : Number(left) - Number(right)
  if (difference === 0) return 0

  return direction === 'asc' ? difference : -difference
}

export type HeroSort = 'hero' | 'games' | 'winRate' | 'kda' | 'time' | 'last'

export function buildHeroPerformanceRows(
  stats: AnalyticsHeroStats[],
  details: Awaited<ReturnType<typeof loadPlayerHeroes>> | null,
  heroes: Awaited<ReturnType<typeof loadHeroDirectory>>,
  sorting: { key: HeroSort, direction: 'asc' | 'desc' },
) {

  const rows = stats.map((stat) => {
    const extra = details?.find((entry) => entry.hero_id === stat.hero_id)
    const hero = heroes.find((entry) => entry.id === stat.hero_id)
    return {
      stat,
      hero: hero?.name ?? 'Hero ' + stat.hero_id,
      games: stat.matches,
      winRate: ratio(stat.wins, stat.matches),
      kda: ratio(stat.total_kills + stat.total_assists, stat.total_deaths),
      time: extra?.time_played ?? null,
      last: extra?.last_played ?? null,
    }
  })
  return rows.sort((left, right) => {
    const metricOrder = compareMetric(left[sorting.key], right[sorting.key], sorting.direction)
    return metricOrder || right.games - left.games || left.stat.hero_id - right.stat.hero_id
  })
}

export const formatPlayerNumber = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 1 })

export const formatPlayerKda = (parts: (number | null)[]) => parts.map(formatPlayerNumber).join(' / ')

export const formatPlayerDate = (value: number | null) => value ? new Date(value * 1000).toLocaleDateString() : '—'
