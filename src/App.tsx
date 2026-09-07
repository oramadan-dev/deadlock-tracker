import { useEffect, useState } from 'react'
import { HeroCarousel } from './components/HeroCarousel'
import { PlayerSearch } from './components/PlayerSearch'
import './App.css'

type Theme = 'dark' | 'light'

function getInitialTheme(): Theme {
  return localStorage.getItem('theme') === 'light' ? 'light' : 'dark'
}

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Deadlock Tracker home">
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
        <PlayerSearch />
      </main>
    </div>
  )
}

export default App
