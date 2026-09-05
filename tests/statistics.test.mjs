import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateRows, defaults, topRows } from '../src/statistics.ts'
import { activeSeasonStart, dateBounds, loadStatistics } from '../src/services/statistics.ts'
import { AnalyticsApi } from 'deadlock_api_client/apis/analytics-api'
import { HeroesApi } from 'deadlock_api_client/apis/heroes-api'

const stat = (id, overrides = {}) => ({
  hero_id: id, bucket: 0, wins: 60, losses: 40, matches: 100,
  total_kills: 600, total_deaths: 200, total_assists: 800,
  total_net_worth: 100000, total_last_hits: 1000, total_denies: 100,
  total_player_damage: 10000, total_player_damage_taken: 10000,
  total_boss_damage: 1000, total_creep_damage: 1000, total_neutral_damage: 1000,
  total_max_health: 1000, total_shots_hit: 75, total_shots_missed: 25,
  ...overrides,
})
const fixture = (stats) => ({ heroes: stats.map((s) => ({ id: s.hero_id, name: `Hero ${s.hero_id}`, images: {} })), stats, bans: [{ hero_id: 1, bans: 20 }], totalGames: 200, fetchedAt: 0 })

test('rates use their intended denominators and KDA uses aggregate totals', () => {
  const [row] = calculateRows(fixture([stat(1)]))
  assert.equal(row.values.winRate, 0.6)
  assert.equal(row.values.pickRate, 0.5)
  assert.equal(row.values.banRate, 0.1)
  assert.equal(row.values.ratio, 7)
  assert.equal(row.values.accuracy, 0.75)
  assert.deepEqual(row.averageKda, [6, 2, 8])
})

test('zero denominators and unavailable supplemental data stay undefined', () => {
  const data = fixture([stat(1, { matches: 0, total_deaths: 0, total_shots_hit: 0, total_shots_missed: 0 })])
  data.totalGames = 0
  data.bans = null
  const [row] = calculateRows(data)
  for (const key of ['winRate', 'pickRate', 'banRate', 'ratio', 'accuracy', 'bans']) assert.equal(row.values[key], null)
  assert.deepEqual(row.averageKda, [null, null, null])
})

test('active identity join, minimum sample, tie order, and top five', () => {
  const data = fixture([stat(9, { matches: 99 }), stat(3), stat(2), stat(1), stat(4), stat(5), stat(6), stat(7, { matches: 200, wins: 120 })])
  data.heroes = data.heroes.filter((hero) => hero.id !== 1)
  assert.deepEqual(topRows(data, defaults).map((r) => r.hero.id), [7, 2, 3, 4, 5])
  assert.deepEqual(topRows(data, { ...defaults, minimum: 1000 }), [])
  assert.deepEqual(topRows(fixture([]), defaults), [])
})

test('undefined ratios sort last in either direction', () => {
  const data = fixture([stat(1, { total_deaths: 0 }), stat(2), stat(3, { total_deaths: 400 })])
  assert.deepEqual(topRows(data, { ...defaults, sort: 'ratio' }).map((r) => r.hero.id), [2, 3, 1])
  assert.deepEqual(topRows(data, { ...defaults, sort: 'ratio', direction: 'asc' }).map((r) => r.hero.id), [3, 2, 1])
})

test('service shares filters, tolerates supplemental failures and rejects aborted stale work', async (t) => {
  const requests = []
  let release
  let hold = false
  t.mock.method(HeroesApi.prototype, 'listHeroes', async () => ({ data: [] }))
  t.mock.method(AnalyticsApi.prototype, 'heroStats', async (query) => {
    requests.push(query)
    if (hold) await new Promise((resolve) => { release = resolve })
    return { data: [] }
  })
  t.mock.method(AnalyticsApi.prototype, 'heroBanStats', async (query) => { requests.push(query); throw new Error('Unavailable') })
  t.mock.method(AnalyticsApi.prototype, 'gameStats', async (query) => { requests.push(query); throw new Error('Unavailable') })
  const result = await loadStatistics(defaults, new AbortController().signal)
  assert.equal(result.bans, null)
  assert.equal(result.totalGames, null)
  for (const request of requests) {
    assert.equal(request.minAverageBadge, 91)
    assert.equal(request.maxAverageBadge, 116)
    assert.equal(request.matchMode, 'ranked')
    assert.equal(request.maxUnixTimestamp - request.minUnixTimestamp, 604800)
    assert.equal(request.minUnixTimestamp, requests[0].minUnixTimestamp)
  }
  hold = true
  const controller = new AbortController()
  const stale = loadStatistics(defaults, controller.signal)
  controller.abort()
  release()
  await assert.rejects(stale, { name: 'AbortError' })
})


test('date windows and active season boundaries', () => {
  const now = 2000000000000
  for (const days of [7, 30]) {
    const bounds = dateBounds({ kind: 'rolling', days }, now)
    assert.equal(bounds.maxUnixTimestamp - bounds.minUnixTimestamp, days * 86400)
    assert.equal(bounds.maxUnixTimestamp % 3600, 0)
  }
  const seasons = [{ intervals: [
    { start_timestamp: 10, end_timestamp: 50 },
    { start_timestamp: 20, end_timestamp: 40 },
    { start_timestamp: 60, end_timestamp: 80 },
  ] }]
  assert.equal(activeSeasonStart(seasons, 30), 20)
  assert.equal(activeSeasonStart(seasons, 40), 10)
  assert.equal(activeSeasonStart(seasons, 50), null)
  assert.equal(activeSeasonStart(seasons, 5), null)
  assert.equal(activeSeasonStart([], 30), null)
  assert.equal(dateBounds({ kind: 'season', start: 20 }, now).minUnixTimestamp, 20)
})

test('all matches and season dates are identical across analytics requests', async (t) => {
  const requests = []
  t.mock.method(HeroesApi.prototype, 'listHeroes', async () => ({ data: [] }))
  for (const method of ['heroStats', 'heroBanStats', 'gameStats']) {
    t.mock.method(AnalyticsApi.prototype, method, async (query) => { requests.push(query); return { data: [] } })
  }
  await loadStatistics({ ...defaults, date: { kind: 'season', start: 1785430800 }, matchMode: 'ranked,unranked' }, new AbortController().signal)
  assert.equal(requests.length, 3)
  for (const query of requests) {
    assert.equal(query.matchMode, 'ranked,unranked')
    assert.equal(query.minUnixTimestamp, 1785430800)
    assert.equal(query.maxUnixTimestamp, requests[0].maxUnixTimestamp)
  }
})
