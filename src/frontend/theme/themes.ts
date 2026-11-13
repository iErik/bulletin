import type {
  PillColours,
  Scale,
  Shade,
  Theme
} from './types'

const SHADES: readonly Shade[] =
  [100, 200, 300, 400, 500, 600, 700, 800, 900]

/** Builds a Scale from nine colours, 100 to 900. */
export const scale = (colours: readonly string[]): Scale =>
  Object.fromEntries(
    SHADES.map((shade, i) => [shade, colours[i]])
  ) as Record<Shade, string>

/** A Day Pill's colours; shadows default to the glow. */
const pill = (
  base: string,
  glow: string,
  shadow = glow,
  tint = shadow
): PillColours => ({ base, glow, shadow, tint })

/**
 * The built-in Theme. Its scales are placeholders until
 * the real colours land; the Mood colours are final.
 */
export const defaultTheme: Theme = {
  id: 'default',
  name: 'Default',
  palettes: {
    dark: {
      background: scale([
        '#e4e6eb', '#c3c7d0', '#9ba1ae', '#6f7685',
        '#4b5160', '#333333', '#262a33', '#191919',
        '#131313'
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
      ]),
      danger: '#f07a7c',
      // Figma's Income and Expense FG.
      income: '#b5e9a7',
      expense: '#b47575',
      // Figma's Widget header: icon tile, icon, title.
      tile: 'rgb(217 217 217 / 8%)',
      'tile-icon': '#a5a5a5',
      'widget-title': 'rgb(165 165 165 / 34%)',
      // Figma's Habits header, with the Habit list open.
      'habit-pill': '#282828',
      'habit-pill-text': 'rgb(165 165 165 / 92%)',
      // Figma's Sleep frame.
      sleep: {
        date: '#cbcbcb',
        caption: 'rgb(255 255 255 / 50%)',
        hour: 'rgb(255 255 255 / 31%)',
        half: 'rgb(255 255 255 / 47%)',
        tick: 'rgb(255 255 255 / 9%)',
        dot: 'rgb(217 217 217 / 45%)',
        track: 'rgb(255 255 255 / 4%)',
        'line-from': '#9c9c9c',
        'line-to': '#505050',
        'line-glow': '#cfcfcf',
        end: '#ffffff',
        'end-tint': '#67a1d4'
      },
      // Figma's Weight line: faint, brightest past the
      // middle, fading out on the right.
      weight: {
        'line-start': 'rgb(128 128 128 / 9%)',
        'line-rise': 'rgb(128 128 128 / 50%)',
        'line-peak': 'rgb(255 255 255 / 75%)',
        'line-end': 'rgb(64 64 64 / 25%)'
      },
      // The Figma mood picker's swatches.
      mood: {
        happy: '#77ca6e',
        okay: '#8e95ee',
        stressed: '#fab18b',
        neutral: '#c8c9ca',
        angry: '#a45f61',
        anxious: '#f8f5ab'
      },
      // Figma's Mood and Habits frames. Angry and
      // anxious have no pill there: their swatch glows
      // on a darker base.
      'pill-empty': '#2c2c2c',
      weekday: 'rgb(165 165 165 / 55%)',
      pill: {
        happy: pill('#77ca6e', '#77ca6e'),
        okay: pill('#6b85be', '#9095f4'),
        stressed: pill('#f0a77f', '#fbb28b'),
        neutral: pill(
          '#a5a5a5', '#d3d3d3', '#ffffff', '#67a1d4'
        ),
        angry: pill('#834c4e', '#a45f61'),
        anxious: pill('#c6c489', '#f8f5ab'),
        habit: pill(
          '#a5a5a5', '#d3d3d3', '#ffffff', '#67a1d4'
        )
      }
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
      ]),
      danger: '#c4373b',
      income: '#2f7d26',
      expense: '#b03a3a',
      // Figma has no light Scheme: the dark header's
      // greys, mirrored for light surfaces.
      tile: 'rgb(38 38 38 / 8%)',
      'tile-icon': '#5a5a5a',
      'widget-title': 'rgb(90 90 90 / 60%)',
      // Each dark channel inverted, as the header's are.
      'habit-pill': '#d7d7d7',
      'habit-pill-text': 'rgb(90 90 90 / 92%)',
      // The dark Sleep frame's, mirrored for light
      // surfaces: dark lines with a soft shadow.
      sleep: {
        date: '#3a3a3a',
        caption: 'rgb(0 0 0 / 50%)',
        hour: 'rgb(0 0 0 / 40%)',
        half: 'rgb(0 0 0 / 55%)',
        tick: 'rgb(0 0 0 / 12%)',
        dot: 'rgb(38 38 38 / 45%)',
        track: 'rgb(0 0 0 / 8%)',
        'line-from': '#5a5a5a',
        'line-to': '#a0a0a0',
        'line-glow': '#6a6a6a',
        end: '#2a2a2a',
        'end-tint': '#3f6fa0'
      },
      // The dark line's, mirrored: each channel inverted,
      // so it's darkest past the middle.
      weight: {
        'line-start': 'rgb(127 127 127 / 9%)',
        'line-rise': 'rgb(127 127 127 / 50%)',
        'line-peak': 'rgb(0 0 0 / 75%)',
        'line-end': 'rgb(191 191 191 / 25%)'
      },
      // Deeper than the dark ones, to stay distinct and
      // visible on light surfaces.
      mood: {
        happy: '#3f9a36',
        okay: '#5a62d8',
        stressed: '#e0763f',
        neutral: '#8b8e93',
        angry: '#a23a3f',
        anxious: '#c6ae1c'
      },
      // The dark pills', mirrored: lighter bases under
      // the light Mood colours, and a dark done Habit.
      'pill-empty': '#e2dfd8',
      weekday: 'rgb(90 90 90 / 55%)',
      pill: {
        happy: pill('#65b25c', '#3f9a36'),
        okay: pill('#7f86e3', '#5a62d8'),
        stressed: pill('#ec9566', '#e0763f'),
        neutral: pill('#adafb3', '#8b8e93'),
        angry: pill('#bd5f63', '#a23a3f'),
        anxious: pill('#dac74c', '#c6ae1c'),
        habit: pill(
          '#8a8a8a', '#4a4a4a', '#4a4a4a', '#3f6fa0'
        )
      }
    }
  }
}

/** Every Theme the app knows, by id. */
export const themes: Readonly<Record<string, Theme>> = {
  [defaultTheme.id]: defaultTheme
}

export const DEFAULT_THEME_ID = defaultTheme.id
