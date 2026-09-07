import { useEffect, useRef, useState } from 'react'
import { parsePlayerQuery, steamProfileUrl } from '../../player'
import { loadPlayerStats, playerDefaults, searchProfiles, type SteamProfile, type AnalyticsHeroStats, type PlayerWindow } from '../../services/players'
import { dateBounds } from '../../services/statistics'
import { HeroStatistics } from '../HeroStatistics/HeroStatistics'
import { PlayerDashboard } from '../PlayerDashboard/PlayerDashboard'

type Selection = { accountId: number, stats: AnalyticsHeroStats[], window: PlayerWindow, revision: number }

type SearchState = { status: 'idle' } | { status: 'loading' } | { status: 'error', message: string }
  | { status: 'candidates', profiles: SteamProfile[] }

export function PlayerSearch() {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>({ status: 'idle' })
  const [selected, setSelected] = useState<Selection | null>(null)
  const request = useRef<AbortController | null>(null)
  const retryAction = useRef<() => void>(() => { })
  useEffect(() => () => request.current?.abort(), [])
  function begin() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setState({ status: 'loading' })
    return controller
  }
  async function select(accountId: number) {
    const controller = begin()
    retryAction.current = () => { void select(accountId) }
    const window = dateBounds(playerDefaults.date)
    try {
      const stats = await loadPlayerStats(accountId, playerDefaults, window, controller.signal)
      if (controller.signal.aborted) return
      setSelected((previous) => ({ accountId, stats, window, revision: (previous?.revision ?? 0) + 1 }))
      setState({ status: 'idle' })
    } catch {
      if (!controller.signal.aborted) setState({ status: 'error', message: 'Couldn’t load this player. Try again.' })
    }
  }
  async function search() {
    const controller = begin()
    retryAction.current = () => { void search() }
    try {
      const parsed = parsePlayerQuery(query)
      if (parsed.kind === 'account') { await select(parsed.accountId); return }
      const profiles = await searchProfiles(parsed.name, controller.signal)
      if (!controller.signal.aborted) setState({ status: 'candidates', profiles })
    } catch (error) {
      if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error && !('isAxiosError' in error) ? error.message : 'Couldn’t search profiles. Try again.' })
    }
  }
  function overview() {
    request.current?.abort()
    setSelected(null)
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
    {state.status === 'loading' && <p role="status">Loading player…</p>}
    {state.status === 'error' && <div role="status">
      {state.message} <button className="theme-toggle" onClick={() => retryAction.current()}>Retry</button>
    </div>}
    {state.status === 'candidates' && <section className="player-candidates" aria-label="Choose a player">
      <h2>Choose a player</h2>
      {!state.profiles.length ? <p>No indexed profiles found. Try an account ID.</p> : <>
        <p className="statistics-note">Indexed Steam profiles · Select an account to continue
          {state.profiles.length === 20 ? ' · Showing up to 20 results; refine your name if needed' : ''}
        </p>
        <ul>
          {state.profiles.map((profile) => <li key={profile.account_id}>
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
    {selected ? <PlayerDashboard
      key={selected.revision}
      accountId={selected.accountId}
      initialStats={selected.stats}
      initialWindow={selected.window}
      select={(id) => { void select(id) }}
      overview={overview} /> : <HeroStatistics />}
  </>
}
