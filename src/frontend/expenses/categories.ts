// What the Category picker offers for typed text,
// like Notion's tags field: the Categories whose names
// contain it, ignoring case, in alphabetical order with
// an exact match first, then a choice to create it when
// no name matches it exactly.
import type { Category } from '@shared/expenses'
import { locale } from '@/locale/format'

/** A Category to pick, or a name to create one with. */
export type CategoryChoice =
  | { readonly kind: 'pick'; readonly category: Category }
  | { readonly kind: 'create'; readonly name: string }

const fold = (text: string): string =>
  text.trim().toLocaleLowerCase(locale())

/** What to offer for `query`, in order. */
export const categoryChoices = (
  categories: readonly Category[],
  query: string
): CategoryChoice[] => {
  const typed = fold(query)
  const matching = categories
    .filter(({ name }) => fold(name).includes(typed))
    .sort((a, b) =>
      Number(fold(b.name) === typed)
        - Number(fold(a.name) === typed)
      || a.name.localeCompare(b.name, locale()))
  const picks = matching.map(category =>
    ({ kind: 'pick', category }) as const)
  const exact = matching.some(({ name }) =>
    fold(name) === typed)
  return typed === '' || exact
    ? picks
    : [...picks, { kind: 'create', name: query.trim() }]
}
