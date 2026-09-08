import { defaults, type Preferences } from './statistics.ts'
import type { HeroSort } from './player.ts'
import type { PlayerFilters } from './services/players.ts'
import type { DateSelection } from './services/statistics.ts'

export type PlayerView = {
  accountId: number
  tab: 'matches' | 'heroes'
  filters: PlayerFilters
  matchPage: number
  heroPage: number
  sorting: { key: HeroSort, direction: 'asc' | 'desc' }
}

export type NavigationState = {
  statistics: Preferences
  player: PlayerView | null
  matchId: number | null
}

export function defaultPlayerView(accountId: number): PlayerView {
  return {
    accountId, tab: 'matches', filters: { date: { kind: 'all' }, matchMode: 'ranked,unranked' },
    matchPage: 0, heroPage: 0, sorting: { key: 'games', direction: 'desc' },
  }
}

function integer(value: string | null, min: number, max: number): number | null {
  if (value === null || !/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null
}

function choice<T extends string>(value: string | null, choices: readonly T[], fallback: T): T {
  return choices.find((candidate) => candidate === value) ?? fallback
}

export function parseDate(value: string | null): DateSelection {
  if (value === '7d') return { kind: 'rolling', days: 7 }
  if (value === '30d') return { kind: 'rolling', days: 30 }
  // Keep the API-provided season boundary, including in links to older seasons.
  const start = value?.startsWith('season-') ? integer(value.slice(7), 1, 4102444800) : null
  return start === null ? { kind: 'all' } : { kind: 'season', start }
}

export function serializeDate(date: DateSelection): string {
  if (date.kind === 'rolling') return `${date.days}d`
  if (date.kind === 'season') return `season-${date.start}`
  return 'all'
}

export function parseNavigation(search: string): NavigationState {
  const params = new URLSearchParams(search)
  const minRank = integer(params.get('minRank'), 1, 11) ?? defaults.minRank
  const maxRank = integer(params.get('maxRank'), 1, 11) ?? defaults.maxRank
  const statistics: Preferences = {
    ...defaults,
    date: parseDate(params.get('date')),
    matchMode: params.get('mode') === 'all' ? 'ranked,unranked' : 'ranked',
    minRank: minRank <= maxRank ? minRank : defaults.minRank,
    maxRank: minRank <= maxRank ? maxRank : defaults.maxRank,
    sort: choice(params.get('sort'), defaults.columns, defaults.sort),
    direction: choice(params.get('dir'), ['asc', 'desc'], 'desc'),
  }
  const accountId = integer(params.get('player'), 1, 4294967295)
  const player = accountId === null ? null : defaultPlayerView(accountId)
  if (player) {
    player.tab = choice(params.get('tab'), ['matches', 'heroes'], 'matches')
    player.filters = {
      date: parseDate(params.get('playerDate')),
      matchMode: params.get('playerMode') === 'ranked' ? 'ranked' : 'ranked,unranked',
    }
    player.matchPage = (integer(params.get('page'), 1, 1000000) ?? 1) - 1
    player.heroPage = (integer(params.get('heroPage'), 1, 1000000) ?? 1) - 1
    player.sorting = {
      key: choice(params.get('heroSort'), ['hero', 'games', 'winRate', 'kda', 'time', 'last'], 'games'),
      direction: choice(params.get('heroDir'), ['asc', 'desc'], 'desc'),
    }
  }
  return { statistics, player, matchId: integer(params.get('match'), 1, Number.MAX_SAFE_INTEGER) }
}

export function serializeNavigation(state: NavigationState): string {
  const params = new URLSearchParams()
  function optional(key: string, value: string | number, fallback: string | number) {
    if (value !== fallback) params.set(key, String(value))
  }
  const { statistics, player, matchId } = state
  if (player) params.set('player', String(player.accountId))
  if (matchId !== null) params.set('match', String(matchId))
  optional('date', serializeDate(statistics.date), 'all')
  optional('mode', statistics.matchMode === 'ranked' ? 'ranked' : 'all', 'ranked')
  optional('minRank', statistics.minRank, defaults.minRank)
  optional('maxRank', statistics.maxRank, defaults.maxRank)
  optional('sort', statistics.sort, defaults.sort)
  optional('dir', statistics.direction, defaults.direction)
  if (player) {
    optional('tab', player.tab, 'matches')
    optional('playerDate', serializeDate(player.filters.date), 'all')
    optional('playerMode', player.filters.matchMode === 'ranked' ? 'ranked' : 'all', 'all')
    optional('page', player.matchPage + 1, 1)
    optional('heroPage', player.heroPage + 1, 1)
    optional('heroSort', player.sorting.key, 'games')
    optional('heroDir', player.sorting.direction, 'desc')
  }
  const search = params.toString()
  return search ? '?' + search : ''
}

export function changePlayerFilters(player: PlayerView, patch: Partial<PlayerFilters>): PlayerView {
  return { ...player, filters: { ...player.filters, ...patch }, matchPage: 0, heroPage: 0, sorting: { key: 'games', direction: 'desc' } }
}

export function visiblePage(page: number, count: number, size: number): number {
  return Math.min(page, Math.max(0, Math.ceil(count / size) - 1))
}
