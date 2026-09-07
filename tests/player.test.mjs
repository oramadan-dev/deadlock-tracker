import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parsePlayerQuery, summarizePlayer, filteredHistory, matchOutcome, compareMetric, steamProfileUrl } from '../src/player.ts'
import { loadPlayerStats, loadPlayerHeroes, loadMates, searchProfiles, loadProfiles, loadHeroDirectory, playerDefaults } from '../src/services/players.ts'
import { AnalyticsApi } from 'deadlock_api_client/apis/analytics-api'
import { PlayersApi } from 'deadlock_api_client/apis/players-api'
import { SteamApi } from 'deadlock_api_client/apis/steam-api'
import { HeroesApi } from 'deadlock_api_client/apis/heroes-api'

test('supported identities normalize exactly; invalid IDs and vanity URLs fail', () => {
  for (const input of ['12345', ' 12345 ', '[U:1:12345]', '76561197960278073', 'https://steamcommunity.com/profiles/76561197960278073/']) {
    assert.deepEqual(parsePlayerQuery(input), { kind: 'account', accountId: 12345 })
  }
  assert.equal(parsePlayerQuery('76561202255233023').accountId, 4294967295)
  assert.equal(steamProfileUrl(12345), 'https://steamcommunity.com/profiles/76561197960278073')
  for (const input of ['', '0', '-1', '1.5', '4294967296', '[U:1:4294967296]', '76561197960265728', '76561202255233024', 'https://evil.test/profiles/76561197960278073', 'https://steamcommunity.com/profiles/12345']) assert.throws(() => parsePlayerQuery(input))
  assert.throws(() => parsePlayerQuery('https://steamcommunity.com/id/example'), /Custom Steam URLs/)
  assert.deepEqual(parsePlayerQuery(' Same Name '), { kind: 'name', name: 'Same Name' })
})

test('summary weights raw totals, retains historical hero IDs, and handles no deaths or games', () => {
  const rows = [{ hero_id: 999, matches: 2, wins: 1, losses: 1, total_kills: 10, total_deaths: 2, total_assists: 4 },
    { hero_id: 1, matches: 8, wins: 6, losses: 2, total_kills: 10, total_deaths: 3, total_assists: 6 }]
  const result = summarizePlayer(rows)
  assert.equal(result.games, 10)
  assert.equal(result.winRate, 0.7)
  assert.deepEqual(result.kda, [2, 0.5, 1])
  assert.equal(result.aggregate, 6)
  assert.equal(summarizePlayer([{ ...rows[0], total_deaths: 0 }]).aggregate, null)
  assert.equal(summarizePlayer([]).winRate, null)
  assert.deepEqual(summarizePlayer([]).kda, [null, null, null])
  for (const direction of ['asc', 'desc']) {
    assert.ok(compareMetric(null, 1, direction) > 0)
    assert.ok(compareMetric(1, null, direction) < 0)
    assert.equal(compareMetric(1, 1, direction), 0)
  }
})

test('history applies exact modes, inclusive bounds, deduplicates and preserves unusual outcomes', () => {
  const match = (id, start, mode = 4, game = 1) => ({ match_id: id, start_time: start, match_mode: mode, game_mode: game })
  const history = [match(1, 10), match(2, 20, 1), match(3, 20), match(3, 20), match(4, 9), match(5, 21), match(6, 15, 2), match(7, 15, 4, 4)]
  const window = { minUnixTimestamp: 10, maxUnixTimestamp: 20 }
  assert.deepEqual(filteredHistory(history, playerDefaults, window).map((m) => m.match_id), [3, 2, 1])
  assert.deepEqual(filteredHistory(history, { ...playerDefaults, matchMode: 'ranked' }, window).map((m) => m.match_id), [3, 1])
  assert.deepEqual([0, 1, 2, 3, 4, 5, 99].map(matchOutcome), ['Invalid', 'Win', 'Loss', 'Penalized', 'Penalized party', 'Not scored', 'Unknown'])
})

test('search retains duplicate display names, includes inactive accounts, and avoids live refresh', async (t) => {
  t.mock.method(SteamApi.prototype, 'steamSearch', async (query) => {
    assert.equal(query.limit, 20)
    assert.equal(query.minMatchesPlayedLast30d, 0)
    return { data: [{ account_id: 1, personaname: 'Same' }, { account_id: 2, personaname: 'Same' }, { account_id: 1, personaname: 'Same' }] }
  })
  assert.equal((await searchProfiles('Same', new AbortController().signal)).length, 2)
  t.mock.method(SteamApi.prototype, 'steam', async (query) => { assert.equal(query.refresh, false); return { data: [] } })
  assert.deepEqual(await loadProfiles([1], new AbortController().signal), [])
  t.mock.method(HeroesApi.prototype, 'listHeroes', async (query) => { assert.equal(query.onlyActive, false); return { data: [] } })
  await loadHeroDirectory(new AbortController().signal)
})

test('player endpoints align filters without rank/minimum constraints; teammates have date-only filtering', async (t) => {
  const window = { minUnixTimestamp: 100, maxUnixTimestamp: 200 }
  const seen = []
  t.mock.method(AnalyticsApi.prototype, 'heroStats', async (query) => { seen.push(query); return { data: [] } })
  t.mock.method(PlayersApi.prototype, 'playerHeroStats', async (query) => { seen.push(query); return { data: [] } })
  const signal = new AbortController().signal
  await loadPlayerStats(42, playerDefaults, window, signal)
  await loadPlayerHeroes(42, playerDefaults, window, signal)
  for (const query of seen) {
    assert.deepEqual(query.accountIds, [42])
    assert.equal(query.gameMode, 'normal')
    assert.equal(query.matchMode, 'ranked,unranked')
    assert.equal(query.minUnixTimestamp, 100)
    assert.equal(query.maxUnixTimestamp, 200)
    assert.equal(query.minAverageBadge, undefined)
    assert.equal(query.minMatches, undefined)
  }
  t.mock.method(PlayersApi.prototype, 'mateStats', async (query) => {
    assert.equal(query.sameParty, false)
    assert.equal(query.matchMode, undefined)
    assert.equal(query.minUnixTimestamp, 100)
    return { data: [{ mate_id: 3, matches_played: 5 }, { mate_id: 2, matches_played: 5 }, { mate_id: 42, matches_played: 99 }] }
  })
  assert.deepEqual((await loadMates(42, window, signal)).map((m) => m.mate_id), [2, 3])
})

test('superseded player and name requests reject even when transport resolves after abort', async (t) => {
  for (const [api, method, call] of [
    [AnalyticsApi, 'heroStats', (signal) => loadPlayerStats(42, playerDefaults, { minUnixTimestamp: 1, maxUnixTimestamp: 2 }, signal)],
    [SteamApi, 'steamSearch', (signal) => searchProfiles('Same', signal)],
  ]) {
    let release
    t.mock.method(api.prototype, method, () => new Promise((resolve) => { release = resolve }))
    const controller = new AbortController()
    const request = call(controller.signal)
    controller.abort()
    release({ data: [] })
    await assert.rejects(request, { name: 'AbortError' })
  }
})

test('hero performance joins by identity, preserves missing details, and sorts deterministically', async () => {
  const { buildHeroPerformanceRows } = await import('../src/player.ts')
  const hero = (id, games, deaths) => ({ hero_id: id, matches: games, wins: 2, total_kills: 6, total_assists: 4, total_deaths: deaths })
  const stats = [hero(9, 4, 0), hero(3, 4, 2), hero(2, 4, 2), hero(1, 8, 4)]
  const details = [{ hero_id: 3, time_played: 120, last_played: 50 }]
  const heroes = [{ id: 3, name: 'Historical hero' }]
  const rows = buildHeroPerformanceRows(stats, details, heroes, { key: 'kda', direction: 'desc' })
  assert.deepEqual(rows.map((row) => row.stat.hero_id), [2, 3, 1, 9])
  assert.equal(rows[1].hero, 'Historical hero')
  assert.equal(rows[1].time, 120)
  assert.equal(rows[1].last, 50)
  assert.equal(rows[0].hero, 'Hero 2')
  assert.equal(rows[0].time, null)
  assert.equal(rows[0].winRate, 0.5)
  assert.equal(rows[3].kda, null)
  const ascending = buildHeroPerformanceRows(stats, null, heroes, { key: 'kda', direction: 'asc' })
  assert.deepEqual(ascending.map((row) => row.stat.hero_id), [1, 2, 3, 9])
  assert.deepEqual(stats.map((row) => row.hero_id), [9, 3, 2, 1])
  assert.deepEqual(buildHeroPerformanceRows([], null, [], { key: 'games', direction: 'desc' }), [])
})
