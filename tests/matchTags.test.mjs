import assert from 'node:assert/strict'
import { test } from 'node:test'
import { globalKdaTag, historyTags, laneTag } from '../src/matchTags.ts'
import { loadLaneTag, loadMatchPerformance } from '../src/services/players.ts'
import { MatchesApi } from 'deadlock_api_client/apis/matches-api'
import { AnalyticsApi } from 'deadlock_api_client/apis/analytics-api'

const match = { match_id: 100, account_id: 42, hero_id: 1, game_mode: 1, match_mode: 4,
  player_match_outcome: 1, match_duration_s: 1200, start_time: 10000000,
  player_kills: 8, player_deaths: 4, player_assists: 8, last_hits: 200, net_worth: 20000, denies: 10 }
const previous = Array.from({ length: 5 }, (_, index) => ({ ...match, match_id: index + 1,
  start_time: match.start_time - (index + 1) * 1800, player_kills: 4, player_assists: 4, last_hits: 100, net_worth: 10000, denies: 5 }))

test('history provides only streaks, never personal performance comparisons', () => {
  assert.deepEqual(historyTags(match, [...previous, previous[0]]).map((tag) => tag.label), ['6 win streak'])
  assert.deepEqual(historyTags(match, [{ ...previous[0], player_match_outcome: 2 }, ...previous.slice(1)]), [])
  assert.deepEqual(historyTags({ ...match, team_abandoned: true }, previous), [])
})

const globalStats = [{ hero_id: 1, matches: 100, total_kills: 400, total_assists: 400, total_deaths: 400 }]
test('KDA tags require supported global hero averages and at least 100 games', () => {
  assert.equal(globalKdaTag(match, globalStats)?.label, 'High KDA')
  assert.match(globalKdaTag(match, globalStats).evidence, /global hero KDA/)
  assert.equal(globalKdaTag({ ...match, player_kills: 0, player_assists: 1 }, globalStats)?.label, 'Low KDA')
  for (const stats of [[], [{ ...globalStats[0], matches: 99 }], [{ ...globalStats[0], hero_id: 2 }], [{ ...globalStats[0], total_deaths: 0 }]]) {
    assert.equal(globalKdaTag(match, stats), null)
  }
  for (const patch of [{ player_deaths: 0 }, { player_kills: undefined }, { team_abandoned: true }, { player_kills: 4, player_assists: 4 }]) {
    assert.equal(globalKdaTag({ ...match, ...patch }, globalStats), null)
  }
})

test('automatic performance loads deduplicate global requests, use prior dates and tolerate unavailable data', async (t) => {
  let calls = 0
  t.mock.method(AnalyticsApi.prototype, 'heroStats', async (query) => {
    calls++
    assert.equal(query.accountIds, undefined)
    assert.equal(query.matchMode, 'ranked')
    assert.equal(query.gameMode, 'normal')
    assert.equal(query.minDurationS, 600)
    assert.equal(query.maxUnixTimestamp, Math.floor(match.start_time / 86400) * 86400 - 1)
    assert.equal(query.maxUnixTimestamp - query.minUnixTimestamp, 30 * 86400 - 1)
    return { data: globalStats }
  })
  t.mock.method(MatchesApi.prototype, 'metadata', async () => { throw new Error('Unavailable') })
  const result = await loadMatchPerformance([match, { ...match, match_id: 101 }], new AbortController().signal)
  assert.equal(calls, 1)
  assert.equal(result[100][0].label, 'High KDA')
  t.mock.method(AnalyticsApi.prototype, 'heroStats', async () => { throw new Error('Unavailable') })
  assert.deepEqual(await loadMatchPerformance([match], new AbortController().signal), { 100: [] })
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(loadMatchPerformance([match], controller.signal), { name: 'AbortError' })
})

const player = (account_id, team, souls) => ({ account_id, team, assigned_lane: 1, stats: [{ time_stamp_s: 540, net_worth: souls }] })
const metadata = { match_info: { match_id: 100, game_mode: 1, players: [player(42, 0, 6000), player(43, 0, 6000), player(44, 1, 5000), player(45, 1, 5000)] } }
test('lane tags compare matched 9-minute sides, including team zero and symmetric losses', () => {
  assert.equal(laneTag(metadata, 100, 42)?.label, 'Won lane')
  assert.equal(laneTag(metadata, 100, 44)?.label, 'Lost lane')
  assert.match(laneTag(metadata, 100, 42).evidence, /9:00/)
  const even = structuredClone(metadata)
  even.match_info.players.forEach((row) => { row.stats[0].net_worth = 5000 })
  assert.equal(laneTag(even, 100, 42)?.label, 'Even lane')
  assert.equal(laneTag(metadata, 999, 42), null)
  assert.equal(laneTag(metadata, 100, 999), null)
  assert.equal(laneTag({}, 100, 42), null)
  for (const alter of [
    (data) => data.match_info.players.pop(),
    (data) => { data.match_info.players[0].stats[0].time_stamp_s = 720 },
    (data) => { delete data.match_info.players[0].stats[0].net_worth },
    (data) => { data.match_info.players[0].abandon_match_time_s = 200 },
  ]) {
    const incomplete = structuredClone(metadata)
    alter(incomplete)
    assert.equal(laneTag(incomplete, 100, 42), null)
  }
})

test('lane service skips Steam fallback, forwards cancellation and rejects stale responses', async (t) => {
  const controller = new AbortController()
  t.mock.method(MatchesApi.prototype, 'metadata', async (query, options) => {
    assert.deepEqual(query, { matchId: 100, disableSteam: true })
    assert.equal(options.signal, controller.signal)
    return { data: metadata }
  })
  assert.equal((await loadLaneTag(100, 42, controller.signal)).label, 'Won lane')
  controller.abort()
  await assert.rejects(loadLaneTag(100, 42, controller.signal), { name: 'AbortError' })
})
