import type { AnalyticsHeroStats, PlayerMatchHistoryEntry } from './services/players.ts'

export type MatchTag = { label: string, tone: 'positive' | 'warning' | 'neutral', evidence: string }
const valid = (value: number) => Number.isFinite(value) && value >= 0
export const tagEligible = (match: PlayerMatchHistoryEntry) => match.game_mode === 1
  && [1, 4].includes(match.match_mode) && [1, 2].includes(match.player_match_outcome)
  && !match.team_abandoned && !(match.abandoned_time_s && match.abandoned_time_s > 0) && match.match_duration_s >= 600

export function historyTags(match: PlayerMatchHistoryEntry, history: PlayerMatchHistoryEntry[]): MatchTag[] {
  if (!tagEligible(match)) return []
  const tags: MatchTag[] = []
  const previous = [...new Map(history.filter((row) => row.account_id === match.account_id && row.match_id !== match.match_id
    && row.start_time < match.start_time).map((row) => [row.match_id, row])).values()]
    .sort((a, b) => b.start_time - a.start_time || b.match_id - a.match_id)
  let streak = 1
  for (const row of previous) {
    if (!tagEligible(row) || row.player_match_outcome !== match.player_match_outcome) break
    streak++
  }
  if (streak >= 3) tags.push({ label: `${streak} ${match.player_match_outcome === 1 ? 'win' : 'loss'} streak`,
    tone: match.player_match_outcome === 1 ? 'positive' : 'warning',
    evidence: `${streak} consecutive recorded ${match.player_match_outcome === 1 ? 'wins' : 'losses'}. History may be incomplete.` })

  return tags
}

export function globalKdaTag(match: PlayerMatchHistoryEntry, stats: AnalyticsHeroStats[]): MatchTag | null {
  if (!tagEligible(match) || ![match.player_kills, match.player_assists, match.player_deaths].every(valid) || match.player_deaths === 0) return null
  const hero = stats.find((row) => row.hero_id === match.hero_id)
  if (!hero || ![hero.matches, hero.total_kills, hero.total_assists, hero.total_deaths].every(valid) || hero.matches < 100 || hero.total_deaths === 0) return null
  const average = (hero.total_kills + hero.total_assists) / hero.total_deaths
  const current = (match.player_kills + match.player_assists) / match.player_deaths
  if (average <= 0 || Math.abs(current / average - 1) < 0.25) return null
  return { label: current > average ? 'High KDA' : 'Low KDA', tone: current > average ? 'positive' : 'warning',
    evidence: `${current.toFixed(1)} KDA vs ${average.toFixed(1)} global hero KDA. Same mode, all ranks; prior 30 days, ${hero.matches.toLocaleString()} games. ≥25% difference.` }
}

// Validated subset of CMsgMatchMetaDataContents, citadel_gcmessages_common.proto.
// The generated client's metadata response is void, so validate unknown data.
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
function number(value: unknown): value is number { return typeof value === 'number' && valid(value) }
export function recordedMvpTag(data: unknown, matchId: number, accountId: number): MatchTag | null {
  if (!record(data) || !record(data.match_info) || String(data.match_info.match_id) !== String(matchId) || !Array.isArray(data.match_info.players)) return null

  const player = data.match_info.players
      .filter(record)
      .find((row) => row.account_id === accountId)

  if (!player || !number(player.mvp_rank) || !Number.isInteger(player.mvp_rank)) return null

  const label =
      player.mvp_rank === 1
          ? 'MVP'
          : player.mvp_rank === 2 || player.mvp_rank === 3
              ? 'Key Player'
              : null

  if (!label) return null

  return {
    label,
    tone: 'positive',
    evidence: `Recorded mvp_rank ${player.mvp_rank} from match metadata.`,
  }
}
export function laneTag(data: unknown, matchId: number, accountId: number): MatchTag | null {
  if (!record(data) || !record(data.match_info)) return null
  const info = data.match_info
  if (String(info.match_id) !== String(matchId) || info.game_mode !== 1 || !Array.isArray(info.players)) return null
  const players: unknown[] = info.players
  if (!players.every(record)) return null
  const player = players.find((row) => row.account_id === accountId)
  if (!player || !number(player.assigned_lane) || player.assigned_lane === 0 || ![0, 1].includes(Number(player.team))) return null
  const lane = players.filter((row) => row.assigned_lane === player.assigned_lane)
  const own = lane.filter((row) => row.team === player.team)
  const enemy = lane.filter((row) => row.team === (player.team === 0 ? 1 : 0))
  if (own.length < 1 || own.length > 2 || own.length !== enemy.length || lane.length !== own.length + enemy.length) return null
  if (new Set(lane.map((row) => row.account_id)).size !== lane.length) return null
  const totals = []
  for (const side of [own, enemy]) {
    let souls = 0
    for (const row of side) {
      if (number(row.abandon_match_time_s) && row.abandon_match_time_s > 0) return null
      if (!Array.isArray(row.stats)) return null
      const stats: unknown[] = row.stats
      const snapshots = stats.filter(record).filter((stat) => stat.time_stamp_s === 540)
      if (snapshots.length !== 1 || !number(snapshots[0].net_worth)) return null
      souls += snapshots[0].net_worth
    }
    totals.push(souls)
  }
  const [ours, theirs] = totals
  if (ours <= 0 || theirs <= 0) return null
  const difference = ours - theirs
  const decisive = Math.abs(difference) >= 500 && Math.abs(difference) / Math.min(ours, theirs) >= 0.1
  return { label: decisive ? difference > 0 ? 'Won lane' : 'Lost lane' : 'Even lane',
    tone: decisive ? difference > 0 ? 'positive' : 'warning' : 'neutral',
    evidence: `9:00 souls: ${ours.toLocaleString()} vs ${theirs.toLocaleString()}. Assigned-lane estimate; ≥500 and ≥10% lead required.` }
}
