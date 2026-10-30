import { useRef, useState } from 'preact/hooks'
import { t } from '../i18n'
import { encodePlan } from '../logic/share'
import type { Lang, UserState } from '../types'
import { Icon } from './Icon'
import { Overlay } from './Overlay'

/** The link to a read-only copy of the plan, with grades left out unless the user wants them in. */
export function shareUrl(state: UserState, withGrades: boolean): string {
  return `${location.href.replace(/#.*$/, '')}#/shared/${encodePlan(state, withGrades)}`
}

export function ShareDialog({ lang, state, onClose }: { lang: Lang; state: UserState; onClose: () => void }) {
  const [grades, setGrades] = useState(false)
  const [copied, setCopied] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const url = shareUrl(state, grades)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // No clipboard permission: select the text so Ctrl/⌘ C works.
      field.current?.select()
    }
  }
  return (
    <Overlay label={t(lang, 'share.title')} onClose={onClose} class="share-dialog">
      <div class="shortcuts-head">
        <h2>{t(lang, 'share.title')}</h2>
        <button type="button" class="icon-button" onClick={onClose} aria-label={t(lang, 'event.close')}><Icon name="close" size={18} /></button>
      </div>
      <p class="share-lead">{t(lang, 'share.lead')}</p>
      <label class="field">
        {t(lang, 'share.link')}
        <input ref={field} type="text" readOnly value={url} onFocus={(e) => (e.target as HTMLInputElement).select()} />
      </label>
      <label class="switch"><input type="checkbox" checked={grades} onChange={(e) => { setGrades((e.target as HTMLInputElement).checked); setCopied(false) }} />{t(lang, 'share.grades')}</label>
      <div class="share-actions">
        <button type="button" class="button" onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={16} />{t(lang, copied ? 'share.copied' : 'share.copy')}</button>
        <a class="button-quiet" href={url} target="_blank" rel="noopener"><Icon name="external" size={16} />{t(lang, 'share.preview')}</a>
      </div>
      <p class="share-note">{t(lang, 'share.private')}</p>
    </Overlay>
  )
}
