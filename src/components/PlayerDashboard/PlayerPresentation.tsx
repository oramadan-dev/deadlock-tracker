import type { Resource } from '../../hooks/useResource'
import type { loadHeroDirectory } from '../../services/players'

export function Status<T>({ resource, label }: {
  resource: { state: Resource<T>, retry: () => void }
  label: string
}) {
  if (resource.state.status === 'success') return null
  if (resource.state.status === 'loading') return <p role="status">Loading {label}…</p>

  return (
    <p role="status">
      {label} unavailable.{' '}
      <button className="theme-toggle" onClick={resource.retry}>Retry {label}</button>
    </p>
  )
}

export function Pager({ page, size, count, change, label }: {
  page: number
  size: number
  count: number
  change: (page: number) => void
  label: string
}) {
  if (count <= size) return null

  return (
    <nav className="player-pagination" aria-label={label}>
      <button className="theme-toggle" disabled={page === 0} onClick={() => change(page - 1)}>
        Previous
      </button>
      <span>Page {page + 1} of {Math.ceil(count / size)}</span>
      <button className="theme-toggle" disabled={(page + 1) * size >= count} onClick={() => change(page + 1)}>
        Next
      </button>
    </nav>
  )
}

export type HeroDirectory = Awaited<ReturnType<typeof loadHeroDirectory>>

export function HeroName({ id, heroes }: { id: number, heroes: HeroDirectory }) {
  const hero = heroes.find((entry) => entry.id === id)

  return (
    <span className="statistics-hero">
      {hero && (
        <img
          src={hero.images.icon_image_small_webp ?? hero.images.icon_image_small ?? undefined}
          alt=""
          width="36"
          height="36"
          onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
        />
      )}
      {hero?.name ?? 'Hero ' + id}
    </span>
  )
}
