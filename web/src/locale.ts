// Language helpers: the locale for dates and numbers, and the language long texts and curated data come in.
import type { Lang } from './types'

const LOCALES: Record<Lang, string> = { tr: 'tr-TR', en: 'en-GB' }

/** BCP 47 locale for dates. */
export const locale = (lang: Lang) => LOCALES[lang]

/** "1,7" in Turkish, "1.7" in English. */
export const decimal = (lang: Lang, n: number | string) => String(n).replace('.', lang === 'en' ? '.' : ',')

/** Language of the curated texts (the guide, the glossary, the career data). */
export const cl = (lang: Lang): 'tr' | 'en' => (lang === 'tr' ? 'tr' : 'en')

export const LANGS: Lang[] = ['tr', 'en']
