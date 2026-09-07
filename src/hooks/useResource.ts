import { useEffect, useRef, useState } from 'react'

export type Resource<T> = { status: 'loading' } | { status: 'error' } | { status: 'success', data: T }

// Each loader identity owns one request; an obsolete completion cannot publish.
export function useResource<T>(loader: (signal: AbortSignal) => Promise<T>, initial?: T) {
  const seed = useRef({ loader, available: initial !== undefined })
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ loader: typeof loader, attempt: number, state: Resource<T> }>(() => ({
    loader, attempt: 0, state: initial === undefined ? { status: 'loading' } : { status: 'success', data: initial },
  }))
  useEffect(() => {
    if (seed.current.available && loader === seed.current.loader && attempt === 0) return
    const controller = new AbortController()
    loader(controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResult({ loader, attempt, state: { status: 'success', data } }) },
      () => { if (!controller.signal.aborted) setResult({ loader, attempt, state: { status: 'error' } }) },
    )
    return () => controller.abort()
  }, [loader, attempt])
  const state: Resource<T> = result.loader === loader && result.attempt === attempt ? result.state : { status: 'loading' }
  return { state, retry: () => setAttempt((value) => value + 1) }
}
