import { useEffect, useState } from 'react'
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
        <form className="player-search" action="#" onSubmit={(event) => event.preventDefault()}>
          <label className="visually-hidden" htmlFor="player-name">Find a player</label>
          <input
            id="player-name"
            name="player"
            type="search"
            placeholder="Steam name or account ID"
            autoComplete="off"
          />
          <button type="submit">Search</button>
        </form>
      </main>
    </div>
  )
}

export default App
