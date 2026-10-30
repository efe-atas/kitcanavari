import { createContext, type ComponentChildren } from 'preact'
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks'
import { Icon } from './Icon'

export interface ToastInput {
  message: string
  /** A button in the toast, e.g. Undo. */
  action?: { label: string; run: () => void }
  /** A link in the toast, e.g. to the plan. */
  link?: { label: string; href: string }
  tone?: 'default' | 'success' | 'warn'
  /** Stays until closed or acted on (e.g. a new version is ready). */
  persistent?: boolean
}

interface Toast extends ToastInput {
  id: number
}

const SHOW_MS = 6000
const ToastContext = createContext<(t: ToastInput) => void>(() => {})

/** Tell the user what just happened, with a way back where there is one. */
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ closeLabel, children }: { closeLabel: string; children: ComponentChildren }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(1)
  const close = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  const push = useCallback((t: ToastInput) => {
    const id = next.current++
    // One message at a time reads best; the newest replaces older ones.
    setToasts([{ ...t, id }])
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div class="toast-region">
        {toasts.map((t) => <ToastView key={t.id} toast={t} closeLabel={closeLabel} onClose={() => close(t.id)} />)}
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ toast, closeLabel, onClose }: { toast: Toast; closeLabel: string; onClose: () => void }) {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused || toast.persistent) return
    const timer = setTimeout(onClose, SHOW_MS)
    return () => clearTimeout(timer)
  }, [paused])
  return (
    <div class={`toast tone-${toast.tone ?? 'default'}`} role="status" aria-live="polite"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusIn={() => setPaused(true)} onFocusOut={() => setPaused(false)}>
      <span class="toast-icon" aria-hidden="true"><Icon name={toast.tone === 'warn' ? 'alert' : 'check'} size={16} /></span>
      <span class="toast-message">{toast.message}</span>
      {toast.link && <a class="toast-link" href={toast.link.href} onClick={onClose}>{toast.link.label}<Icon name="chevron" size={14} /></a>}
      {toast.action && (
        <button type="button" class="toast-action" onClick={() => { toast.action!.run(); onClose() }}>{toast.action.label}</button>
      )}
      <button type="button" class="toast-close" aria-label={closeLabel} onClick={onClose}><Icon name="close" size={14} /></button>
    </div>
  )
}
