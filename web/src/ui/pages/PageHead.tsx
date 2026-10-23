import type { ComponentChildren } from 'preact'

/** The title of a page, one line on what it answers, and its page-wide actions on the right. */
export function PageHead({ title, lead, children }: { title: string; lead?: string; children?: ComponentChildren }) {
  return (
    <header class="page-head">
      <div class="page-head-text">
        <h1>{title}</h1>
        {lead && <p class="page-lead">{lead}</p>}
      </div>
      {children && <div class="page-actions">{children}</div>}
    </header>
  )
}
