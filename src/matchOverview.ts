function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
function numeric(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null }
export function parseMatchOverview(data: unknown, matchId: number) {
  if (!record(data) || !record(data.match_info)) throw new Error('Match metadata unavailable.')
  const info = data.match_info
  if (String(info.match_id) !== String(matchId) || !Array.isArray(info.players)) throw new Error('Invalid match metadata.')
  const duration = numeric(info.duration_s)
  const players = info.players.filter(record).flatMap((player) => {
    const accountId = numeric(player.account_id)
    const heroId = numeric(player.hero_id)
    if (accountId === null || heroId === null || (player.team !== 0 && player.team !== 1)) return []
    // Only an end-of-match snapshot supplies final damage/healing, never a lane snapshot.
    const snapshots = Array.isArray(player.stats) ? player.stats.filter(record).filter((stat) => duration !== null && stat.time_stamp_s === duration) : []
    const final = snapshots.length === 1 ? snapshots[0] : undefined
    return [{ accountId, heroId, team: player.team, kills: numeric(player.kills), deaths: numeric(player.deaths), assists: numeric(player.assists),
      souls: numeric(player.net_worth), level: numeric(player.level), lastHits: numeric(player.last_hits), denies: numeric(player.denies),
      damage: numeric(final?.player_damage), taken: numeric(final?.player_damage_taken), healing: numeric(final?.player_healing),
      bossDamage: numeric(final?.boss_damage), abandoned: (numeric(player.abandon_match_time_s) ?? 0) > 0 }]
  })
  if (new Set(players.map((player) => player.accountId)).size !== players.length) throw new Error('Duplicate players in match metadata.')
  return { matchId, duration, start: numeric(info.start_time), outcome: numeric(info.match_outcome),
    winner: info.match_outcome === 0 && (info.winning_team === 0 || info.winning_team === 1) ? info.winning_team : null, players }
}
export type MatchOverviewData = ReturnType<typeof parseMatchOverview>
