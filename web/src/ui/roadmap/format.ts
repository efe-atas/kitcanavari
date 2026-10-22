import { t } from '../../i18n'
import { PRIOR, termLabel } from '../../logic/terms'
import type { Lang } from '../../types'

/** "Passed before", "WS 26/27", "SS 27", … */
export const termName = (lang: Lang, term: string) => (term === PRIOR ? t(lang, 'road.prior') : termLabel(term))
