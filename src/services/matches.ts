import { MatchesApi } from 'deadlock_api_client/apis/matches-api'
import { AnalyticsApi } from 'deadlock_api_client/apis/analytics-api'
import { parseMatchOverview } from '../matchOverview.ts'
import { globalKdaTag, historyTags, laneTag, recordedMvpTag, tagEligible, type MatchTag } from '../matchTags.ts'
import { loadHistory, type AnalyticsHeroStats } from './players.ts'

export async function loadMatchOverview(matchId: number, signal: AbortSignal) {
  const { data } = await new MatchesApi().metadata(
    { matchId, disableSteam: true },
    { signal, timeout: 20000 },
  )
  signal.throwIfAborted()
  // The generated client declares void; the domain parser validates the payload.
  const metadata: unknown = data
  return { ...parseMatchOverview(metadata, matchId), metadata }
}

export async function loadOverviewTags(match: Awaited<ReturnType<typeof loadMatchOverview>>, signal: AbortSignal) {
  const tagsByAccount: Record<number, MatchTag[]> = {}
  const missingHistoryAccountIds: number[] = []
  const pendingPlayers = [...match.players]
  const matchDayStart = Math.floor((match.start ?? 0) / 86400) * 86400
  const baselines = new Map<number, Promise<AnalyticsHeroStats[]>>()

  // Every participant of the same mode shares one request, including failures.
  function loadBaseline(matchMode: number) {
    const existing = baselines.get(matchMode)
    if (existing) return existing

    const request = new AnalyticsApi().heroStats({
      bucket: 'no_bucket',
      gameMode: 'normal',
      matchMode: matchMode === 4 ? 'ranked' : 'unranked',
      minUnixTimestamp: matchDayStart - 30 * 86400,
      maxUnixTimestamp: matchDayStart - 1,
      minDurationS: 600,
    }, { signal, timeout: 20000 }).then(({ data }) => data)
    baselines.set(matchMode, request)
    return request
  }

  async function loadPlayerTags(player: typeof match.players[number]) {
    const tags = [recordedMvpTag(match.metadata, match.matchId, player.accountId)]
      .filter((tag) => tag !== null)
    try {
      const history = await loadHistory(player.accountId, signal)
      const entry = history.find((row) => row.match_id === match.matchId && row.hero_id === player.heroId)
      if (!entry) {
        missingHistoryAccountIds.push(player.accountId)
        return tags
      }

      tags.push(...historyTags(entry, history))
      if (!tagEligible(entry)) return tags

      const lane = laneTag(match.metadata, match.matchId, player.accountId)
      if (lane) tags.push(lane)
      const baseline = await loadBaseline(entry.match_mode)
      const kda = globalKdaTag(entry, baseline)
      if (kda) tags.push(kda)
    } catch {
      missingHistoryAccountIds.push(player.accountId)
    }
    return tags
  }

  async function worker() {
    while (pendingPlayers.length) {
      signal.throwIfAborted()
      const player = pendingPlayers.shift()
      if (!player) return
      const tags = await loadPlayerTags(player)
      signal.throwIfAborted()
      tagsByAccount[player.accountId] = tags
    }
  }

  await Promise.all([worker(), worker(), worker()])
  return { tags: tagsByAccount, incomplete: missingHistoryAccountIds.length > 0 }
}
