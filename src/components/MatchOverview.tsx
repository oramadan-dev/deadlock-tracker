import { useCallback, useEffect, useRef } from 'react'
import { useResource } from '../hooks/useResource'
import { loadMatchOverview, loadOverviewTags } from '../services/matches'
import { loadHeroDirectory, loadProfiles } from '../services/players'
const format = (value: number | null) => value === null ? '—' : value.toLocaleString()

function Scoreboard({ match }: { match: Awaited<ReturnType<typeof loadMatchOverview>> }) {
  const heroes = useResource(loadHeroDirectory)
  const profiles = useResource(useCallback((signal: AbortSignal) => loadProfiles(match.players.map((player) => player.accountId), signal), [match]))
  const tags = useResource(useCallback((signal: AbortSignal) => loadOverviewTags(match, signal), [match]))

  return <>
    <p>
      {match.outcome === 2 ? 'Draw' : match.winner === null ? 'Winner unavailable' : `Team ${match.winner + 1} won`}
      {match.duration !== null && ` · ${Math.floor(match.duration / 60)}:${String(match.duration % 60).padStart(2, '0')}`}
      {match.start !== null && ` · ${new Date(match.start * 1000).toLocaleString()}`}
    </p>
    {profiles.state.status === 'error' && <p role="status">Player names unavailable. <button className="theme-toggle" onClick={profiles.retry}>Retry names</button>
    </p>}
    {heroes.state.status === 'error' && <p role="status">Hero portraits unavailable. <button className="theme-toggle" onClick={heroes.retry}>Retry portraits</button>
    </p>}
    {(tags.state.status === 'error' || (tags.state.status === 'success' && tags.state.data.incomplete)) && <p role="status">Some performance tags are unavailable. <button className="theme-toggle" onClick={tags.retry}>Retry tags</button>
    </p>}
    {!match.players.length && <p>No player statistics recorded for this match.</p>}
    {[0, 1].map((team) => <section key={team} aria-label={'Team ' + (team + 1)}>
      <h3>Team {team + 1} {match.winner !== null && <span className={'match-result ' + (match.winner === team ? 'match-result-win' : 'match-result-loss')}>
        {match.winner === team ? 'Win' : 'Loss'}
      </span>}
      </h3>
      <div
        className="statistics-table-scroll"
        tabIndex={0}
        aria-label={'Team ' + (team + 1) + ' final stats, scroll for more columns'}>
        <table className="player-table">
          <thead>
            <tr>
              {['Player / hero', 'K / D / A', 'Souls', 'Level', 'Last hits', 'Denies', 'Hero damage', 'Damage taken', 'Healing', 'Boss damage', 'Tags'].map((label) => <th scope="col" key={label}>
                {label}
              </th>)}
            </tr>
          </thead>
          <tbody>
            {match.players.filter((player) => player.team === team).map((player) => {
              const hero = heroes.state.status === 'success' ? heroes.state.data.find((entry) => entry.id === player.heroId) : undefined
              const profile = profiles.state.status === 'success' ? profiles.state.data.find((entry) => entry.account_id === player.accountId) : undefined
              const playerTags = tags.state.status === 'success' ? tags.state.data.tags[player.accountId] ?? [] : []
              return <tr key={player.accountId}>
                <th scope="row">
                  <span className="statistics-hero">
                    {hero && <img
                      alt=""
                      width="36"
                      height="36"
                      src={hero.images.icon_image_small_webp ?? hero.images.icon_image_small ?? undefined} />}
                    <span>
                      {profile?.personaname || 'Account ' + player.accountId}
                      <small className="match-player-hero">
                        {hero?.name ?? 'Hero ' + player.heroId}
                        {player.abandoned ? ' · Abandoned' : ''}
                      </small>
                    </span>
                  </span>
                </th>
                <td>
                  {format(player.kills)} / {format(player.deaths)} / {format(player.assists)}
                </td>
                {[player.souls, player.level, player.lastHits, player.denies, player.damage, player.taken, player.healing, player.bossDamage].map((value, index) => <td key={index}>
                  {format(value)}
                </td>)}
                <td>
                  <div className="match-tags">
                    {playerTags.map((tag) => <span
                      key={tag.label}
                      className={'match-tag match-tag-' + tag.tone}
                      tabIndex={0}
                      title={tag.evidence}
                      aria-label={tag.label + ': ' + tag.evidence}>
                      {tag.label}
                    </span>)}
                    {!playerTags.length && (tags.state.status === 'loading' ? '…' : '—')}
                  </div>
                </td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </section>)}
    <p className="statistics-note">Final damage and healing require an end-of-match snapshot. Missing values show —. Tags use the same recorded-history, global KDA, and lane rules as Recent matches. MVP rank is shown only when recorded; no Key player award is inferred.</p>
  </>
}

export function MatchOverview({ matchId, close }: { matchId: number, close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const data = useResource(useCallback((signal: AbortSignal) => loadMatchOverview(matchId, signal), [matchId]))
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])

  return <dialog className="match-overview" ref={dialog} onCancel={close} aria-labelledby="match-overview-title">
    <div className="statistics-heading">
      <h2 id="match-overview-title">Match {matchId}
      </h2>
      <button className="theme-toggle" onClick={close} autoFocus>Close match</button>
    </div>
    {data.state.status === 'loading' && <p role="status">Loading match overview…</p>}
    {data.state.status === 'error' && <p role="status">Match metadata unavailable. <button className="theme-toggle" onClick={data.retry}>Retry match</button>
    </p>}
    {data.state.status === 'success' && <Scoreboard match={data.state.data} />}
  </dialog>
}
