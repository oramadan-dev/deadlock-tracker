import { useSyncExternalStore } from 'react'
import { parseNavigation, serializeDate, serializeNavigation, type NavigationState } from '../navigation.ts'

let lastSearch: string | undefined
let snapshot: NavigationState | undefined

export function readNavigation(): NavigationState {
  const search = window.location.search
  if (snapshot && search === lastSearch) return snapshot
  const next = parseNavigation(search)
  // Unrelated navigation must not change resource-loader inputs or refetch data.
  if (snapshot) {
    if (serializeDate(next.statistics.date) === serializeDate(snapshot.statistics.date)) {
      next.statistics.date = snapshot.statistics.date
    }
    if (JSON.stringify(next.statistics) === JSON.stringify(snapshot.statistics)) next.statistics = snapshot.statistics
    if (next.player && snapshot.player) {
      if (serializeDate(next.player.filters.date) === serializeDate(snapshot.player.filters.date)) {
        next.player.filters.date = snapshot.player.filters.date
      }
      if (JSON.stringify(next.player.filters) === JSON.stringify(snapshot.player.filters)) next.player.filters = snapshot.player.filters
      if (JSON.stringify(next.player.sorting) === JSON.stringify(snapshot.player.sorting)) next.player.sorting = snapshot.player.sorting
    }
  }
  lastSearch = search
  snapshot = next
  return next
}

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener('tracker:navigate', onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener('tracker:navigate', onChange)
  }
}

export function navigate(next: NavigationState) {
  const search = serializeNavigation(next)
  if (search === serializeNavigation(readNavigation())) return
  window.history.pushState(null, '', window.location.pathname + search + window.location.hash)
  window.dispatchEvent(new Event('tracker:navigate'))
}

export function useNavigation() {
  return useSyncExternalStore(subscribe, readNavigation)
}
