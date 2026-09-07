import type { AnalyticsHeroStats, PlayerMatchHistoryEntry, PlayerFilters, PlayerWindow } from './services/players.ts'

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

export function steamProfileUrl(accountId: number) { return 'https://steamcommunity.com/profiles/' + (steamBase + BigInt(accountId)) }
export function ratio(numerator: number, denominator: number) { return denominator > 0 ? numerator / denominator : null }
export function summarizePlayer(stats: AnalyticsHeroStats[]) {
  const totals = stats.reduce((sum, row) => ({ games: sum.games + row.matches, wins: sum.wins + row.wins,
    losses: sum.losses + row.losses, kills: sum.kills + row.total_kills, deaths: sum.deaths + row.total_deaths,
    assists: sum.assists + row.total_assists }), { games: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 })
  return { ...totals, winRate: ratio(totals.wins, totals.games), kda: [ratio(totals.kills, totals.games), ratio(totals.deaths, totals.games), ratio(totals.assists, totals.games)], aggregate: ratio(totals.kills + totals.assists, totals.deaths) }
}

// SteamDatabase/Protobufs, deadlock/citadel_gcmessages_common.proto:
// ECitadelGameMode Normal=1; ECitadelMatchMode Unranked=1, Ranked=4.
export function filteredHistory(history: PlayerMatchHistoryEntry[], filters: PlayerFilters, window: PlayerWindow) {
  return [...new Map(history.map((match) => [match.match_id, match])).values()]
    .filter((match) => match.game_mode === 1 && (match.match_mode === 4 || (filters.matchMode === 'ranked,unranked' && match.match_mode === 1))
      && match.start_time >= window.minUnixTimestamp && match.start_time <= window.maxUnixTimestamp)
    .sort((a, b) => b.start_time - a.start_time || b.match_id - a.match_id)
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
