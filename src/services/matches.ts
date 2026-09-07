import { MatchesApi } from 'deadlock_api_client/apis/matches-api'
import { AnalyticsApi } from 'deadlock_api_client/apis/analytics-api'
import { parseMatchOverview } from '../matchOverview.ts'
import { globalKdaTag, historyTags, laneTag, recordedMvpTag, tagEligible, type MatchTag } from '../matchTags.ts'
import { loadHistory } from './players.ts'

export async function loadMatchOverview(matchId: number, signal: AbortSignal) {
  const { data } = await new MatchesApi().metadata({ matchId, disableSteam: true }, { signal, timeout: 20000 })
  signal.throwIfAborted()
  return { ...parseMatchOverview(data, matchId), metadata: data as unknown }
}

export async function loadOverviewTags(match: Awaited<ReturnType<typeof loadMatchOverview>>, signal: AbortSignal) {
  const result: Record<number, MatchTag[]> = {}
  const histories: number[] = []
  const pending = [...match.players]
  // One baseline per match, shared by every participant.
  const end = Math.floor((match.start ?? 0) / 86400) * 86400
  let baseline: Awaited<ReturnType<AnalyticsApi['heroStats']>>['data'] = []
  // Match mode is validated through each participant's recorded history below.
  const baselines = new Map<number, Promise<typeof baseline>>()
  async function worker() {
    while (pending.length) {
      signal.throwIfAborted()
      const player = pending.shift()
      if (!player) return
      const tags = [recordedMvpTag(match.metadata, match.matchId, player.accountId)].filter((tag) => tag !== null)
      try {
        const history = await loadHistory(player.accountId, signal)
        const entry = history.find((row) => row.match_id === match.matchId && row.hero_id === player.heroId)
        if (entry) {
          tags.push(...historyTags(entry, history))
          if (tagEligible(entry)) {
            const lane = laneTag(match.metadata, match.matchId, player.accountId)
            if (lane) tags.push(lane)
            let request = baselines.get(entry.match_mode)
            if (!request) {
              request = new AnalyticsApi().heroStats({ bucket: 'no_bucket', gameMode: 'normal', matchMode: entry.match_mode === 4 ? 'ranked' : 'unranked', minUnixTimestamp: end - 30 * 86400, maxUnixTimestamp: end - 1, minDurationS: 600 }, { signal, timeout: 20000 }).then(({ data }) => data)
              baselines.set(entry.match_mode, request)
            }
            baseline = await request
            const kda = globalKdaTag(entry, baseline)
            if (kda) tags.push(kda)
          }
        } else histories.push(player.accountId)
      } catch { histories.push(player.accountId) }
      signal.throwIfAborted()
      result[player.accountId] = tags
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return { tags: result, incomplete: histories.length > 0 }
}
