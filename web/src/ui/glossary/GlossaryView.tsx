import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { CoursesFile, Lang } from '../../types'
import { Icon } from '../Icon'
import { CATEGORIES, TERMS, termById, type Category } from './terms'

const copy = {
  tr: {
    title: 'Sözlük',
    lead: 'Katalogda ve bu sitede karşına çıkan Almanca ve KIT\'e özgü terimler, sade bir dille. Bir terime sitenin her yerinden "?" ile gelebilirsin.',
    search: 'Terim ara: Stammmodul, SWS, Teilleistung…',
    all: 'Tümü',
    where: 'Nerede görürsün',
    related: 'İlgili',
    empty: 'Bu aramayla eşleşen terim yok.',
  },
  en: {
    title: 'Glossary',
    lead: 'German and KIT-specific terms from the catalog and this site, in plain words. The “?” links across the site lead here.',
    search: 'Search a term: Stammmodul, SWS, Teilleistung…',
    all: 'All',
    where: 'Where you see it',
    related: 'Related',
    empty: 'No term matches this search.',
  },
}

const norm = (s: string) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '')

export function GlossaryView({ lang, data, focus }: { lang: Lang; data: CoursesFile; focus: string | null }) {
  const c = copy[lang]
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<Category | null>(null)

  const shownFocus = useRef(focus)
  useEffect(() => {
    if (!focus) return
    // Following a link to another term clears filters that could hide it.
    if (shownFocus.current !== focus) {
      setQuery('')
      setCat(null)
      shownFocus.current = focus
    }
    requestAnimationFrame(() => document.getElementById(`term-${focus}`)?.scrollIntoView?.({ block: 'center' }))
  }, [focus])

  const list = useMemo(() => {
    const q = norm(query.trim())
    return TERMS.filter((t) => (!cat || t.cat === cat)
      && (!q || norm(`${t.term} ${t.aka ?? ''} ${t.def[lang]}`).includes(q)))
  }, [query, cat, lang])

  const groups = (Object.keys(CATEGORIES) as Category[])
    .map((k) => ({ k, terms: list.filter((t) => t.cat === k) }))
    .filter((g) => g.terms.length)

  return (
    <article class="glossary">
      <header class="guide-head">
        <h2>{c.title}</h2>
        <p class="guide-lead">{c.lead}</p>
      </header>

      <div class="glossary-tools">
        <label class="search-wrap">
          <Icon name="search" />
          <input type="search" class="search" placeholder={c.search} value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
        </label>
        <div class="chips" role="group">
          <button type="button" class="chip" aria-pressed={cat === null} onClick={() => setCat(null)}>{c.all}</button>
          {(Object.keys(CATEGORIES) as Category[]).map((k) => (
            <button key={k} type="button" class="chip" aria-pressed={cat === k} onClick={() => setCat(cat === k ? null : k)}>
              {CATEGORIES[k][lang]}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && <p class="empty">{c.empty}</p>}
      {groups.map((g) => (
        <section key={g.k} class="term-group">
          <h3>{CATEGORIES[g.k][lang]}</h3>
          <dl class="terms">
            {g.terms.map((t) => {
              const fact = t.count?.(data, lang)
              return (
                <div key={t.id} id={`term-${t.id}`} class={`term${focus === t.id ? ' is-focus' : ''}`}>
                  <dt>
                    <span class="term-name">{t.term}</span>
                    {t.aka && <span class="term-aka">{t.aka}</span>}
                  </dt>
                  <dd>
                    <p>{t.def[lang]}</p>
                    {t.where && <p class="term-where"><Icon name="search" size={14} /><span><strong>{c.where}:</strong> {t.where[lang]}</span></p>}
                    {fact && <p class="term-fact">{fact}</p>}
                    {t.related && (
                      <p class="term-related">
                        <span>{c.related}:</span>
                        {t.related.map((id) => {
                          const r = termById(id)
                          return r ? <a key={id} class="chip" href={`#/glossary/${id}`}>{r.term}</a> : null
                        })}
                      </p>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      ))}
    </article>
  )
}

/** Small "?" link to a glossary entry, placed next to a term elsewhere on the site. */
export function TermLink({ id, lang }: { id: string; lang: Lang }) {
  const term = termById(id)
  if (!term) return null
  const label = lang === 'tr' ? `${term.term} ne demek?` : `What is ${term.term}?`
  return <a class="term-link" href={`#/glossary/${id}`} title={label} aria-label={label}>?</a>
}
