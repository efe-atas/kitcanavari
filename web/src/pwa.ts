// Registers the service worker (production builds only) and tells the app when a new version is waiting.
export const UPDATE_EVENT = 'kit:update-ready'

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      const announce = (worker: ServiceWorker | null) => {
        if (worker && navigator.serviceWorker.controller) window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: worker }))
      }
      if (reg.waiting) announce(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing
        worker?.addEventListener('statechange', () => { if (worker.state === 'installed') announce(worker) })
      })
      // Look for a new version now and then while the app stays open.
      setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000)
    }).catch(() => undefined)
    // The first install also takes control (clients.claim): reload only when the user asked for the new version.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!wanted || reloading) return
      reloading = true
      location.reload()
    })
  })
}

let wanted = false
let reloading = false

/** Switch to the waiting version; the page reloads once it takes over. */
export function applyUpdate(worker: ServiceWorker): void {
  wanted = true
  worker.postMessage({ type: 'skip-waiting' })
}
