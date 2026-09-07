import { useEffect, useState } from 'react'
import { listHeroes, type HeroSummary } from '../../services/heroes'

type HeroState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success', heroes: HeroSummary[] }

function HeroPortrait({ hero }: { hero: HeroSummary }) {
  const [failed, setFailed] = useState(false)
  const picture = hero.images.icon_hero_card_webp ?? hero.images.icon_hero_card
    ?? hero.images.icon_image_small_webp ?? hero.images.icon_image_small

  return (
    <li className="hero-card">
      {picture && !failed ? (
        <img src={picture} alt="" width="132" height="168" onError={() => setFailed(true)} />
      ) : (
        <span className="hero-picture-fallback">Portrait unavailable</span>
      )}
      <span className="hero-name">{hero.name}</span>
    </li>
  )
}

export function HeroCarousel() {
  const [state, setState] = useState<HeroState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    listHeroes(controller.signal).then(
      (heroes) => {
        if (!controller.signal.aborted) setState({ status: 'success', heroes })
      },
      () => {
        if (!controller.signal.aborted) setState({ status: 'error' })
      },
    )
    return () => controller.abort()
  }, [attempt])

  return (
    <section className="hero-carousel" aria-label="Heroes">
      {state.status === 'loading' && <p role="status">Loading heroes…</p>}
      {state.status === 'error' && (
        <div role="status">
          <p>Couldn’t load heroes.</p>
          <button className="theme-toggle" type="button" onClick={() => {
            setState({ status: 'loading' })
            setAttempt((value) => value + 1)
          }}>Retry</button>
        </div>
      )}
      {state.status === 'success' && (state.heroes.length === 0 ? (
        <p role="status">No heroes available.</p>
      ) : (
          <div className="hero-viewport" tabIndex={0} aria-label="Hero portraits, scroll to explore">
            <div className="hero-track" style={{ animationDuration: `${state.heroes.length * 6}s` }}>
              <ul className="hero-group">
                {state.heroes.map((hero) => <HeroPortrait key={hero.id} hero={hero} />)}
              </ul>
              <ul className="hero-group hero-group-copy" aria-hidden="true">
                {state.heroes.map((hero) => <HeroPortrait key={hero.id} hero={hero} />)}
              </ul>
            </div>
          </div>
      ))}
    </section>
  )
}
