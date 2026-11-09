import type { Palette, Scheme, Shade } from './types'

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

type ScaleRef = readonly [keyof Palette, Shade]

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

/**
 * Writes the semantic custom properties for a Palette
 * onto `el` (the root element by default).
 */
export const applyPalette = (
  palette: Palette,
  scheme: Scheme,
  el: HTMLElement = document.documentElement
): void => {
  const colours = resolveSemantic(palette, scheme)
  for (const [token, colour] of Object.entries(colours))
    el.style.setProperty(
      cssVar(token as SemanticToken),
      colour
    )
  el.style.colorScheme = scheme
}
