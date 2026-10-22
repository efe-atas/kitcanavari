import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { Icon } from './Icon'

interface Props {
  title: string
  closeLabel: string
  onClose: () => void
  children: ComponentChildren
}

const PHONE = '(max-width: 640px)'
const isPhone = () => typeof matchMedia === 'function' && matchMedia(PHONE).matches

/**
 * The side panel. On wide screens it sits beside the plan and does not block it; on phones it is a full-height
 * sheet that keeps focus inside. Esc closes; focus returns to what opened it.
 */
export function Drawer({ title, closeLabel, onClose, children }: Props) {
  const ref = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    heading.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !isPhone() || !ref.current) return
      const items = [...ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]')]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  useEffect(() => { heading.current?.focus() }, [title])

  return (
    <aside class="drawer" ref={ref} aria-labelledby="drawer-title">
      <header class="drawer-head">
        <h2 id="drawer-title" tabIndex={-1} ref={heading}>{title}</h2>
        <button type="button" class="icon-button" onClick={onClose} aria-label={closeLabel}><Icon name="close" size={20} /></button>
      </header>
      <div class="drawer-body">{children}</div>
    </aside>
  )
}
