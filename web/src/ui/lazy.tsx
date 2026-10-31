import type { ComponentType, JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'

/**
 * A component whose code is downloaded the first time it is shown (pages most visits never open), with a
 * placeholder meanwhile.
 */
export function lazyComponent<P extends object>(load: () => Promise<ComponentType<P>>, fallback: () => JSX.Element) {
  let loaded: ComponentType<P> | null = null
  let pending: Promise<ComponentType<P>> | null = null
  return function Lazy(props: P) {
    const [C, setC] = useState<ComponentType<P> | null>(() => loaded)
    useEffect(() => {
      if (C) return
      pending ??= load().then((c) => (loaded = c))
      let live = true
      pending.then((c) => { if (live) setC(() => c) })
      return () => { live = false }
    }, [])
    return C ? <C {...props} /> : fallback()
  }
}
