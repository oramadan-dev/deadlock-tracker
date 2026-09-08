import { useEffect, useState } from 'react'

export type Resource<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success', data: T }

type ResourceLoader<T> = (signal: AbortSignal) => Promise<T>
type ResourceResult<T> = {
  loader: ResourceLoader<T>
  attempt: number
  state: Resource<T>
}

// Callers must keep loader identity stable until its request inputs change.
export function useResource<T>(loader: ResourceLoader<T>) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<ResourceResult<T>>(() => ({
    loader,
    attempt: 0,
    state: { status: 'loading' },
  }))

  useEffect(() => {
    const controller = new AbortController()
    loader(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return
        setResult({ loader, attempt, state: { status: 'success', data } })
      },
      () => {
        if (controller.signal.aborted) return
        setResult({ loader, attempt, state: { status: 'error' } })
      },
    )
    return () => controller.abort()
  }, [loader, attempt])

  // Hide obsolete results immediately, before the replacement effect runs.
  const isCurrentRequest = result.loader === loader && result.attempt === attempt
  const state: Resource<T> = isCurrentRequest ? result.state : { status: 'loading' }

  function retry() {
    setAttempt((previous) => previous + 1)
  }

  return { state, retry }
}
