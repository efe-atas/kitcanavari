import type { ComponentChildren } from 'preact'
import { useLayoutEffect, useRef } from 'preact/hooks'

interface Props {
  label: string
  onClose: () => void
  /** Element to focus first; the dialog itself when unset. */
  initialFocus?: () => HTMLElement | null
  class?: string
  children: ComponentChildren
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex="0"]'

/**
 * A centred modal dialog over the page (command palette, shortcut list): focus stays inside, Esc and the backdrop
 * close it, and focus goes back to what opened it.
 */
export function Overlay({ label, onClose, initialFocus, class: cls, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    ;(initialFocus?.() ?? ref.current)?.focus()
    document.body.classList.add('has-overlay')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab' || !ref.current) return
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!items.length) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.classList.remove('has-overlay')
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  return (
    <div class="overlay-layer">
      <div class="overlay-backdrop" onClick={onClose} aria-hidden="true" />
      <div class={`overlay${cls ? ` ${cls}` : ''}`} ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {children}
      </div>
    </div>
  )
}
