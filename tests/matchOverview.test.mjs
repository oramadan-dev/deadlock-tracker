import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseMatchOverview } from '../src/matchOverview.ts'
import { recordedMvpTag } from '../src/matchTags.ts'
import { loadMatchOverview } from '../src/services/matches.ts'
import { MatchesApi } from 'deadlock_api_client/apis/matches-api'
const fixture = () => ({ match_info: { match_id: 42, duration_s: 1000, start_time: 10000, match_outcome: 0, winning_team: 0,
  players: [{ account_id: 1, hero_id: 5, team: 0, kills: 4, deaths: 0, assists: 3, net_worth: 10000,
    mvp_rank: 1, stats: [{ time_stamp_s: 540, player_damage: 99 }, { time_stamp_s: 1000, player_damage: 500, player_healing: 0 }] },
    { account_id: 2, hero_id: 6, team: 1, stats: [{ time_stamp_s: 540, player_damage: 99 }] }] } })
test('overview preserves team zero winner, zero stats and requires final snapshots', () => {
 const data = parseMatchOverview(fixture(), 42)
 assert.equal(data.winner, 0)
 assert.equal(data.players.length, 2)
 assert.equal(data.players[0].deaths, 0)
 assert.equal(data.players[0].healing, 0)
 assert.equal(data.players[0].damage, 500)
 assert.equal(data.players[1].damage, null)
 assert.equal(data.players[1].kills, null)
 const draw = fixture(); draw.match_info.match_outcome = 2
 assert.equal(parseMatchOverview(draw, 42).winner, null)
 assert.throws(() => parseMatchOverview({}, 42))
 assert.throws(() => parseMatchOverview(fixture(), 43))
 const duplicate = fixture(); duplicate.match_info.players.push(duplicate.match_info.players[0])
 assert.throws(() => parseMatchOverview(duplicate, 42), /Duplicate/)
})
test('recorded MVP rank never fabricates an award for missing metadata', () => {
 assert.equal(recordedMvpTag(fixture(), 42, 1).label, 'MVP rank 1')
 assert.equal(recordedMvpTag(fixture(), 42, 2), null)
 assert.equal(recordedMvpTag(fixture(), 43, 1), null)
 assert.equal(recordedMvpTag({}, 42, 1), null)
})
test('overview uses cached metadata and rejects aborted completions', async (t) => {
 const controller = new AbortController()
 t.mock.method(MatchesApi.prototype, 'metadata', async (query) => {
  assert.equal(query.disableSteam, true)
  return { data: fixture() }
 })
 assert.equal((await loadMatchOverview(42, controller.signal)).players.length, 2)
 controller.abort()
 await assert.rejects(loadMatchOverview(42, controller.signal), { name: 'AbortError' })
})
