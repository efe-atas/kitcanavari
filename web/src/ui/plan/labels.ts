import { t } from '../../i18n'
import { rowBucket, type RowId } from '../../logic/matrix'
import type { Lang, UserState } from '../../types'

/** "Human-centred Machine Intelligence", "1. uzmanlık alanı" when unset, "Seçmeli", … */
export function rowLabel(lang: Lang, s: UserState, row: RowId): string {
  if (row === 'area0' || row === 'area1') return rowBucket(s, row) ?? t(lang, row === 'area0' ? 'plan.area1' : 'plan.area2')
  return t(lang, `plan.row.${row}`)
}
