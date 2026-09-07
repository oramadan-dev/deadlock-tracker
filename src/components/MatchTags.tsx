import { historyTags, type MatchTag } from '../matchTags'
import type { PlayerMatchHistoryEntry } from '../services/players'

export function MatchTags({ match, history, performance, loading }: {
  match: PlayerMatchHistoryEntry, history: PlayerMatchHistoryEntry[], performance: MatchTag[], loading: boolean,
}) {
  const tags = [...historyTags(match, history), ...performance]
  return <div className="match-tags">
    {tags.map((tag) => <span key={tag.label} className={'match-tag match-tag-' + tag.tone}
      tabIndex={0} title={tag.evidence} aria-label={tag.label + ': ' + tag.evidence}>{tag.label}</span>)}
    {!tags.length && <span title={loading ? 'Loading performance' : 'No supported performance tags'}>{loading ? '…' : '—'}</span>}
  </div>
}
