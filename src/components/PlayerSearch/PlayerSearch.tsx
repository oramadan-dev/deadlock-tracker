import { useEffect, useRef, useState } from 'react'
import { parsePlayerQuery, steamProfileUrl } from '../../player'
import { searchProfiles, type SteamProfile } from '../../services/players'
import { defaultPlayerView, type NavigationState } from '../../navigation'
import { navigate } from '../../hooks/useNavigation'
import { HeroStatistics } from '../HeroStatistics/HeroStatistics'
import { PlayerDashboard } from '../PlayerDashboard/PlayerDashboard'

type SearchState = { status: 'idle' } | { status: 'loading' } | { status: 'error', message: string }
  | { status: 'candidates', profiles: SteamProfile[] }

export function PlayerSearch({ view }: { view: NavigationState }) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>({ status: 'idle' })
  const [searchView, setSearchView] = useState(view)
  const visibleState: SearchState = searchView === view ? state : { status: 'idle' }
  const request = useRef<AbortController | null>(null)
  const retryAction = useRef<() => void>(() => { })
  useEffect(() => () => request.current?.abort(), [view])
  function begin() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setSearchView(view)
    setState({ status: 'loading' })
    return controller
  }
  function select(accountId: number) {
    request.current?.abort()
    setState({ status: 'idle' })
    navigate({ ...view, player: defaultPlayerView(accountId), matchId: null })
  }
  async function search() {
    const controller = begin()
    retryAction.current = () => { void search() }
    try {
      const parsed = parsePlayerQuery(query)
      if (parsed.kind === 'account') { select(parsed.accountId); return }
      const profiles = await searchProfiles(parsed.name, controller.signal)
      if (!controller.signal.aborted) setState({ status: 'candidates', profiles })
    } catch (error) {
      if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error && !('isAxiosError' in error) ? error.message : 'Couldn’t search profiles. Try again.' })
    }
  }
  function overview() {
    request.current?.abort()
    navigate({ ...view, player: null, matchId: null })
    setState({ status: 'idle' })
  }

  return <>
    <form className="player-search" onSubmit={(event) => { event.preventDefault(); void search() }}>
      <label className="visually-hidden" htmlFor="player-name">Find a player</label>
      <input
        id="player-name"
        name="player"
        type="search"
        placeholder="Steam name or account ID"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)} />
      <button type="submit">Search</button>
    </form>
    {visibleState.status === 'loading' && <p role="status">Loading player…</p>}
    {visibleState.status === 'error' && <div role="status">
      {visibleState.message} <button className="theme-toggle" onClick={() => retryAction.current()}>Retry</button>
    </div>}
    {visibleState.status === 'candidates' && <section className="player-candidates" aria-label="Choose a player">
      <h2>Choose a player</h2>
      {!visibleState.profiles.length ? <p>No indexed profiles found. Try an account ID.</p> : <>
        <p className="statistics-note">Indexed Steam profiles · Select an account to continue
          {visibleState.profiles.length === 20 ? ' · Showing up to 20 results; refine your name if needed' : ''}
        </p>
        <ul>
          {visibleState.profiles.map((profile) => <li key={profile.account_id}>
            <button className="candidate-select" onClick={() => { void select(profile.account_id) }}>
              <img
                src={profile.avatarmedium}
                alt=""
                width="44"
                height="44"
                onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />
              <span>
                <strong>
                  {profile.personaname || 'Account ' + profile.account_id}
                </strong>
                <small>Account {profile.account_id} · {profile.matches_played_last_30d} matches in 30 days</small>
              </span>
            </button>
            <a href={steamProfileUrl(profile.account_id)} target="_blank" rel="noreferrer">Steam profile</a>
          </li>)}
        </ul>
      </>}
    </section>}
    {view.player ? <PlayerDashboard
      key={view.player.accountId}
      view={view.player}
      change={(player) => navigate({ ...view, player })}
      openMatch={(matchId) => navigate({ ...view, matchId })}
      select={select}
      overview={overview} /> : <HeroStatistics preferences={view.statistics} change={(statistics) => navigate({ ...view, statistics })} />}
  </>
}
