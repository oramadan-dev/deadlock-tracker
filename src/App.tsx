import { useEffect, useState } from 'react'
import { useNavigation, navigate } from './hooks/useNavigation'
import { parseNavigation } from './navigation'
import { MatchOverview } from './components/MatchOverview/MatchOverview'
import { HeroCarousel } from './components/HeroCarousel/HeroCarousel'
import { PlayerSearch } from './components/PlayerSearch/PlayerSearch'
// Load shared primitives before feature overrides; keep this order explicit.
import './App.css'
import './components/DataDisplay/DataDisplay.css'
import './components/HeroCarousel/HeroCarousel.css'
import './components/PlayerSearch/PlayerSearch.css'
import './components/HeroStatistics/HeroStatistics.css'
import './components/PlayerDashboard/PlayerDashboard.css'
import './components/MatchOverview/MatchOverview.css'

type Theme = 'dark' | 'light'

function getInitialTheme(): Theme {
  return localStorage.getItem('theme') === 'light' ? 'light' : 'dark'
}

function App() {
  const view = useNavigation()
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="/" onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          navigate(parseNavigation(''))
        }} aria-label="Deadlock Tracker home">
          <span className="wordmark-mark" aria-hidden="true">DT</span>
          <span>Deadlock Tracker</span>
        </a>
        <button
          className="theme-toggle"
          type="button"
          aria-label={`Switch to ${nextTheme} mode`}
          aria-pressed={theme === 'light'}
          onClick={() => setTheme(nextTheme)}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☼' : '☾'}</span>
          <span>{nextTheme}</span>
        </button>
      </header>

      <main className="main-content">
        <HeroCarousel />
        <PlayerSearch view={view} />
        {view.matchId !== null && <MatchOverview key={view.matchId} matchId={view.matchId} close={() => navigate({ ...view, matchId: null })} />}
      </main>
    </div>
  )
}

export default App
