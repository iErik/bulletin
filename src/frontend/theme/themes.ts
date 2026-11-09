import type { Scale, Shade, Theme } from './types'

const SHADES: readonly Shade[] =
  [100, 200, 300, 400, 500, 600, 700, 800, 900]

/** Builds a Scale from nine colours, 100 to 900. */
export const scale = (colours: readonly string[]): Scale =>
  Object.fromEntries(
    SHADES.map((shade, i) => [shade, colours[i]])
  ) as Record<Shade, string>

/**
 * The built-in Theme. Its Palettes are placeholders
 * until the real colours land.
 */
export const defaultTheme: Theme = {
  id: 'default',
  name: 'Default',
  palettes: {
    dark: {
      background: scale([
        '#e4e6eb', '#c3c7d0', '#9ba1ae', '#6f7685',
        '#4b5160', '#353a46', '#262a33', '#1b1e25',
        '#121419'
      ]),
      foreground: scale([
        '#f5f6f8', '#e2e5ea', '#c8ccd4', '#a6acb8',
        '#858c9a', '#666d7b', '#4b515d', '#33383f',
        '#1d2025'
      ]),
      accent: scale([
        '#e0e7ff', '#c3cffd', '#a1b2fa', '#8197f5',
        '#6680ee', '#4f69dc', '#3f55bb', '#324497',
        '#263372'
      ])
    },
    light: {
      background: scale([
        '#fbfaf7', '#f3f1ec', '#e8e5de', '#d6d2c8',
        '#b9b4a8', '#948f83', '#6f6a60', '#4b4740',
        '#2a2824'
      ]),
      foreground: scale([
        '#f7f6f3', '#dedbd4', '#bcb8ae', '#98938a',
        '#76726a', '#57544e', '#3e3c38', '#2a2926',
        '#181816'
      ]),
      accent: scale([
        '#e3ebff', '#c2d2fe', '#9db4fb', '#7894f4',
        '#5876e9', '#3f5cd6', '#3249b2', '#283a8c',
        '#1e2c67'
      ])
    }
  }
}

/** Every Theme the app knows, by id. */
export const themes: Readonly<Record<string, Theme>> = {
  [defaultTheme.id]: defaultTheme
}

export const DEFAULT_THEME_ID = defaultTheme.id
