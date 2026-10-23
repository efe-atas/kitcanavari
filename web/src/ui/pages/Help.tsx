import { t } from '../../i18n'
import type { CoursesFile, Lang } from '../../types'
import { GlossaryView } from '../glossary/GlossaryView'
import { GuideView } from '../guide/GuideView'
import { pageHref } from '../route'
import { PageHead } from './PageHead'

/** How the degree works, and the glossary. A term id (#/help/stamm) opens the glossary at that term. */
export function Help({ lang, data, id }: { lang: Lang; data: CoursesFile; id: string | null }) {
  const glossary = id !== null && id !== 'guide'
  const focus = glossary && id !== 'glossary' ? id : null
  return (
    <div class="help">
      <PageHead title={t(lang, 'nav.help')} lead={t(lang, 'page.help.lead')} />
      <nav class="segmented page-tabs" aria-label={t(lang, 'nav.help')}>
        <a href={pageHref({ kind: 'help', id: 'guide' })} aria-current={!glossary ? 'page' : undefined}>{t(lang, 'info.guide')}</a>
        <a href={pageHref({ kind: 'help', id: 'glossary' })} aria-current={glossary ? 'page' : undefined}>{t(lang, 'help.glossary')}</a>
      </nav>
      {glossary ? <GlossaryView lang={lang} data={data} focus={focus} embedded /> : <GuideView lang={lang} data={data} />}
    </div>
  )
}
