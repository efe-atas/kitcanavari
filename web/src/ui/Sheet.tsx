import type { ComponentChildren } from 'preact'
import { useLayoutEffect, useRef } from 'preact/hooks'
import { Icon } from './Icon'

interface Props {
  title: string
  closeLabel: string
  onClose: () => void
  children: ComponentChildren
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, summary, [tabindex="0"]'

/**
 * A modal sheet over the page: from the right on wide screens, full screen on phones. It keeps focus inside,
 * Esc and the backdrop close it, and focus returns to what opened it.
 */
export function Sheet({ title, closeLabel, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    heading.current?.focus()
    document.body.classList.add('has-sheet')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !ref.current) return
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('has-sheet')
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  return (
    <div class="sheet-layer">
      <div class="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div class="sheet" ref={ref} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-head">
          <h2 id="sheet-title" tabIndex={-1} ref={heading}>{title}</h2>
          <button type="button" class="icon-button" onClick={onClose} aria-label={closeLabel}><Icon name="close" size={20} /></button>
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  )
}
