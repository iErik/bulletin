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

/** The Sleep Timeline's colours, from Figma's frame. */
export type SleepColour =
  | 'date'
  | 'caption'
  | 'hour'
  | 'half'
  | 'tick'
  | 'dot'
  | 'track'
  | 'line-from'
  | 'line-to'
  | 'line-glow'
  | 'end'
  | 'end-tint'

export const SLEEP_COLOURS: readonly SleepColour[] = [
  'date', 'caption', 'hour', 'half', 'tick', 'dot',
  'track', 'line-from', 'line-to', 'line-glow', 'end',
  'end-tint'
]

/** Whose Day Pill colours: a Mood's, or a done Habit's. */
export type PillKey = MoodKey | 'habit'

/**
 * A filled Day Pill's colours, from Figma's "Mood
 * Indicator": the blurred `base`, the inner `glow`,
 * its shadows' colour, and the `tint` of the one that
 * drops below it.
 */
export interface PillColours {
  readonly base: string
  readonly glow: string
  readonly shadow: string
  readonly tint: string
}

export const PILL_PARTS: readonly (keyof PillColours)[] =
  ['base', 'glow', 'shadow', 'tint']

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
  /** Income amounts, as `--color-income`. */
  readonly income: string
  /** Expense amounts, as `--color-expense`. */
  readonly expense: string
  /** A Widget's icon tile, as `--color-tile`. */
  readonly tile: string
  /** A Widget's icon, as `--color-tile-icon`. */
  readonly 'tile-icon': string
  /** A Widget's title, as `--color-widget-title`. */
  readonly 'widget-title': string
  /** Each Mood's colour, as `--color-mood-<key>`. */
  readonly mood: Readonly<Record<MoodKey, string>>
  /** An empty Day Pill, as `--color-pill-empty`. */
  readonly 'pill-empty': string
  /** Month Grid weekdays, as `--color-weekday`. */
  readonly weekday: string
  /** Filled Day Pills', as `--color-pill-<key>-<part>`. */
  readonly pill: Readonly<Record<PillKey, PillColours>>
  /** The Sleep Timeline's, as `--color-sleep-<key>`. */
  readonly sleep: Readonly<Record<SleepColour, string>>
}

/** A named visual identity: one Palette per Scheme. */
export interface Theme {
  readonly id: string
  readonly name: string
  readonly palettes: Readonly<Record<Scheme, Palette>>
}
