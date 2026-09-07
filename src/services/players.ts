import { AnalyticsApi } from 'deadlock_api_client/apis/analytics-api'
import { PlayersApi } from 'deadlock_api_client/apis/players-api'
import { SteamApi } from 'deadlock_api_client/apis/steam-api'
import { HeroesApi } from 'deadlock_api_client/apis/heroes-api'
import { dateBounds, type DateSelection } from './statistics.ts'
export type { SteamProfile } from 'deadlock_api_client/models/steam-profile'
export type { AnalyticsHeroStats } from 'deadlock_api_client/models/analytics-hero-stats'
export type { PlayerMatchHistoryEntry } from 'deadlock_api_client/models/player-match-history-entry'

export type PlayerFilters = { date: DateSelection, matchMode: 'ranked' | 'ranked,unranked' }
export const playerDefaults: PlayerFilters = { date: { kind: 'rolling', days: 30 }, matchMode: 'ranked,unranked' }
export type PlayerWindow = ReturnType<typeof dateBounds>
const analytics = new AnalyticsApi()
const players = new PlayersApi()
const steam = new SteamApi()
const heroes = new HeroesApi()
const options = (signal: AbortSignal) => ({ signal, timeout: 20000 })

export async function searchProfiles(searchQuery: string, signal: AbortSignal) {
  const { data } = await steam.steamSearch({ searchQuery, limit: 20, minMatchesPlayedLast30d: 0 }, options(signal))
  signal.throwIfAborted()
  return [...new Map(data.map((profile) => [profile.account_id, profile])).values()]
}
export async function loadProfiles(accountIds: number[], signal: AbortSignal) {
  if (!accountIds.length) return []
  const { data } = await steam.steam({ accountIds, refresh: false }, options(signal))
  signal.throwIfAborted()
  return data
}
export async function loadPlayerStats(accountId: number, filters: PlayerFilters, window: PlayerWindow, signal: AbortSignal) {
  const { data } = await analytics.heroStats({ accountIds: [accountId], bucket: 'no_bucket', gameMode: 'normal', matchMode: filters.matchMode, ...window }, options(signal))
  signal.throwIfAborted()
  return data
}
export async function loadPlayerHeroes(accountId: number, filters: PlayerFilters, window: PlayerWindow, signal: AbortSignal) {
  const { data } = await players.playerHeroStats({ accountIds: [accountId], gameMode: 'normal', matchMode: filters.matchMode, ...window }, options(signal))
  signal.throwIfAborted()
  return data
}
export async function loadHistory(accountId: number, signal: AbortSignal) {
  const { data } = await players.matchHistory({ accountId, forceRefetch: false }, options(signal))
  signal.throwIfAborted()
  return data
}
export async function loadRank(accountId: number, signal: AbortSignal) {
  const { data } = await players.rank({ accountId }, options(signal))
  signal.throwIfAborted()
  return data
}
export async function loadMates(accountId: number, window: PlayerWindow, signal: AbortSignal) {
  const { data } = await players.mateStats({ accountId, gameMode: 'normal', sameParty: false, ...window }, options(signal))
  signal.throwIfAborted()
  return data.filter((mate) => mate.mate_id !== accountId)
    .sort((a, b) => b.matches_played - a.matches_played || a.mate_id - b.mate_id).slice(0, 10)
}
export async function loadHeroDirectory(signal: AbortSignal) {
  const { data } = await heroes.listHeroes({ language: 'english', onlyActive: false }, options(signal))
  signal.throwIfAborted()
  return data
}
