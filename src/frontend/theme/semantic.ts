import { MOODS, type Mood } from '@shared/mood'
import {
  SLEEP_COLOURS,
  type Palette,
  type Scheme,
  type Shade
} from './types'

/**
 * The semantic colours components use, each exposed as
 * the CSS custom property `--color-<token>`.
 */
export type SemanticToken =
  | 'surface'
  | 'surface-raised'
  | 'border'
  | 'text'
  | 'text-muted'
  | 'accent'
  | 'text-on-accent'

/** Palette entries that are single colours. */
type Single =
  | 'danger'
  | 'income'
  | 'expense'
  | 'tile'
  | 'tile-icon'
  | 'widget-title'

type ScaleRef = readonly [
  Exclude<keyof Palette, 'mood' | 'sleep' | Single>,
  Shade
]

/** Where each token points in a Palette, per Scheme. */
export const SEMANTIC_MAP: Readonly<
  Record<Scheme, Record<SemanticToken, ScaleRef>>
> = {
  dark: {
    surface: ['background', 900],
    'surface-raised': ['background', 800],
    border: ['background', 600],
    text: ['foreground', 100],
    'text-muted': ['foreground', 400],
    accent: ['accent', 400],
    'text-on-accent': ['foreground', 900]
  },
  light: {
    surface: ['background', 100],
    'surface-raised': ['background', 200],
    border: ['background', 400],
    text: ['foreground', 900],
    'text-muted': ['foreground', 600],
    accent: ['accent', 600],
    'text-on-accent': ['foreground', 100]
  }
}

export const cssVar = (token: SemanticToken): string =>
  `--color-${token}`

/** Resolves every semantic token to a colour. */
export const resolveSemantic = (
  palette: Palette,
  scheme: Scheme
): Record<SemanticToken, string> => {
  const map = SEMANTIC_MAP[scheme]
  const entries = Object.entries(map).map(
    ([token, [scale, shade]]) =>
      [token, palette[scale][shade]]
  )
  return Object.fromEntries(entries) as
    Record<SemanticToken, string>
}

/** A Mood's colour, as a CSS value. */
export const moodColour = (mood: Mood): string =>
  `var(--color-${mood.colour})`

/**
 * Writes the semantic custom properties, the danger,
 * Income and Expense colours, the Mood colours and the
 * Sleep Timeline's for a Palette onto
 * `el` (the root element by default).
 */
export const applyPalette = (
  palette: Palette,
  scheme: Scheme,
  el: HTMLElement = document.documentElement
): void => {
  const colours = resolveSemantic(palette, scheme)
  for (const [token, colour] of Object.entries(colours)) {
    el.style.setProperty(
      cssVar(token as SemanticToken),
      colour
    )
  }
  const singles: readonly Single[] = [
    'danger',
    'income',
    'expense',
    'tile',
    'tile-icon',
    'widget-title'
  ]
  for (const name of singles)
    el.style.setProperty(`--color-${name}`, palette[name])
  for (const mood of MOODS) {
    el.style.setProperty(
      `--color-${mood.colour}`,
      palette.mood[mood.key]
    )
  }
  for (const name of SLEEP_COLOURS) {
    el.style.setProperty(
      `--color-sleep-${name}`,
      palette.sleep[name]
    )
  }
  el.style.colorScheme = scheme
}
