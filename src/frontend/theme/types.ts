import type { MoodKey } from '@shared/mood'

/** The light or dark variant of a Theme. */
export type Scheme = 'dark' | 'light'

export const SCHEMES: readonly Scheme[] = ['dark', 'light']

/**
 * The user's Scheme choice. `system` follows the OS
 * through `prefers-color-scheme`.
 */
export type SchemePreference = Scheme | 'system'

export const SCHEME_PREFERENCES: readonly SchemePreference[] =
  ['system', ...SCHEMES]

/** A step in a colour scale, lightest (100) to darkest. */
export type Shade =
  100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900

export type Scale = Readonly<Record<Shade, string>>

/** The concrete colours of one Theme in one Scheme. */
export interface Palette {
  readonly background: Scale
  readonly foreground: Scale
  readonly accent: Scale
  /** Rule breaks and errors, as `--color-danger`. */
  readonly danger: string
  /** Each Mood's colour, as `--color-mood-<key>`. */
  readonly mood: Readonly<Record<MoodKey, string>>
}

/** A named visual identity: one Palette per Scheme. */
export interface Theme {
  readonly id: string
  readonly name: string
  readonly palettes: Readonly<Record<Scheme, Palette>>
}
