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
        '#e4e6eb', // 100
        '#c3c7d0', // 200
        '#9ba1ae', // 300
        '#6f7685', // 400
        '#4b5160', // 500
        '#333333', // 600
        '#262a33', // 700
        '#191919', // 800
        '#131313', // 900
      ]),
      foreground: scale([
        '#f5f6f8', // 100
        '#e2e5ea', // 200
        '#c8ccd4', // 300
        '#a6acb8', // 400
        '#858c9a', // 500
        '#666d7b', // 600
        '#4b515d', // 700
        '#33383f', // 800
        '#1d2025', // 900
      ]),
      accent: scale([
        '#e0e7ff', // 100
        '#c3cffd', // 200
        '#a1b2fa', // 300
        '#8197f5', // 400
        '#6680ee', // 500
        '#4f69dc', // 600
        '#3f55bb', // 700
        '#324497', // 800
        '#263372', // 900
      ]),
      danger: '#f07a7c',
      income: '#b5e9a7',
      expense: '#b47575',
      tile: 'rgb(217 217 217 / 8%)',
      'tile-icon': '#a5a5a5',
      'widget-title': 'rgb(165 165 165 / 34%)',
      // Figma's Mood Overview values and its green for
      // a change for the better; Insights' red for a
      // change for the worse.
      'stat-value': '#bbbbbb',
      improvement: '#88ba7a',
      worsening: '#ff7070',
      // Figma's Sidebar.
      sidebar: 'rgb(226 226 226 / 6%)',
      'sidebar-active': 'rgb(217 217 217 / 11%)',
      'sidebar-icon': '#a5a5a5',
      'sidebar-icon-active': '#eeeeee',

      // Figma's Expenses table add row.
      'expense-add': '#a5a5a5',
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
      // The dark Month Pace frame's whites and greys.
      'month-pace': {
        grid: 'rgb(255 255 255 / 5%)',
        area: 'rgb(255 255 255 / 35%)',
        line: 'rgb(255 255 255 / 95%)',
        'line-glow': 'rgb(255 255 255 / 60%)',
        pace: 'rgb(255 255 255 / 35%)',
        projection: 'rgb(255 255 255 / 60%)',
        figure: 'rgb(187 187 187 / 80%)',
        label: 'rgb(165 165 165 / 50%)',
        marker: 'rgb(255 255 255 / 12%)',
        dot: '#ffffff',
        'dot-glow': 'rgb(255 255 255 / 80%)',
        tip: '#2a2a2a',
        'tip-text': 'rgb(165 165 165 / 80%)',
        bar: 'rgb(255 255 255 / 30%)',
        'bar-bright': 'rgb(255 255 255 / 80%)',
        'bar-glow': 'rgb(255 255 255 / 35%)',
        rest: 'rgb(255 255 255 / 6%)',
        cap: 'rgb(165 165 165 / 60%)'
      },
      // Figma's Habits / Habit Board frame.
      'habit-board': {
        today: 'rgb(165 165 165 / 70%)',
        row: 'rgb(255 255 255 / 3%)',
        name: '#d9d9d9',
        slipping: 'rgb(255 112 112 / 80%)',
        done: 'rgb(255 255 255 / 85%)',
        glow: 'rgb(255 255 255 / 35%)',
        dim: 'rgb(255 255 255 / 6%)',
        selected: 'rgb(255 255 255 / 60%)',
        streak: '#ffffff',
        best: 'rgb(187 187 187 / 60%)',
        low: '#ff7070'
      },
      // Figma's Expenses frames: By Category and
      // Insights share these.
      spend: {
        rise: 'rgb(255 112 112 / 90%)',
        value: '#bbbbbb',
        caption: 'rgb(165 165 165 / 50%)'
      },
      // Figma's Expenses / By Category frame.
      category: {
        label: 'rgb(165 165 165 / 60%)',
        bar: 'rgb(255 255 255 / 50%)',
        'bar-top': 'rgb(255 255 255 / 85%)',
        'bar-glow': 'rgb(255 255 255 / 35%)',
        note: 'rgb(165 165 165 / 30%)'
      },
      // Figma's Task Editor frame.
      tasks: {
        field: '#1f1f1f',
        text: '#d9d9d9',
        accent: '#ffffff',
        'on-accent': '#141414',
        danger: '#ff7070'
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
      // Figma's Year in Mood: flat compact pills.
      'pill-flat-empty': 'rgb(255 255 255 / 5%)',
      'pill-outline': '#fff',
      weekday: 'rgb(165 165 165 / 55%)',
      // Figma's Habits / By Weekday frame.
      'weekday-cell': '#ffffff',
      'weekday-low': 'rgb(255 112 112 / 60%)',
      // Figma's Mood / By Weekday frame.
      'weekday-best': 'rgb(165 165 165 / 80%)',
      // Figma's Expenses / Recurring frame.
      'recurring-row': 'rgb(255 255 255 / 3%)',
      'recurring-meta': 'rgb(165 165 165 / 45%)',
      'recurring-amount': 'rgb(255 112 112 / 85%)',
      'recurring-footer': 'rgb(165 165 165 / 50%)',
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
        ),
        // Figma's Sleep / Quality: one white pill, its
        // opacity showing the rating's step.
        quality: pill(
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
      // The dark grey inverted; the green and red
      // deepened, as the light Mood colours are.
      'stat-value': '#444444',
      improvement: '#4a8a3c',
      worsening: '#c24a4a',
      // The dark Sidebar's, each channel inverted.
      sidebar: 'rgb(29 29 29 / 6%)',
      'sidebar-active': 'rgb(38 38 38 / 11%)',
      'sidebar-icon': '#5a5a5a',
      'sidebar-icon-active': '#111111',
      'expense-add': '#5a5a5a',
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
      // The dark Month Pace frame's, mirrored: each
      // channel inverted, as the header's greys are.
      'month-pace': {
        grid: 'rgb(0 0 0 / 5%)',
        area: 'rgb(0 0 0 / 35%)',
        line: 'rgb(0 0 0 / 95%)',
        'line-glow': 'rgb(0 0 0 / 60%)',
        pace: 'rgb(0 0 0 / 35%)',
        projection: 'rgb(0 0 0 / 60%)',
        figure: 'rgb(68 68 68 / 80%)',
        label: 'rgb(90 90 90 / 50%)',
        marker: 'rgb(0 0 0 / 12%)',
        dot: '#000000',
        'dot-glow': 'rgb(0 0 0 / 80%)',
        tip: '#d5d5d5',
        'tip-text': 'rgb(90 90 90 / 80%)',
        bar: 'rgb(0 0 0 / 30%)',
        'bar-bright': 'rgb(0 0 0 / 80%)',
        'bar-glow': 'rgb(0 0 0 / 35%)',
        rest: 'rgb(0 0 0 / 6%)',
        cap: 'rgb(90 90 90 / 60%)'
      },
      // The dark Habit Board frame's, mirrored for light.
      'habit-board': {
        today: 'rgb(90 90 90 / 70%)',
        row: 'rgb(0 0 0 / 3%)',
        name: '#262626',
        slipping: 'rgb(196 55 59 / 80%)',
        done: 'rgb(0 0 0 / 85%)',
        glow: 'rgb(0 0 0 / 25%)',
        dim: 'rgb(0 0 0 / 6%)',
        selected: 'rgb(0 0 0 / 60%)',
        streak: '#000000',
        best: 'rgb(68 68 68 / 60%)',
        low: '#c4373b'
      },
      // The dark spend colours, mirrored for light.
      spend: {
        rise: 'rgb(196 55 59 / 90%)',
        value: '#444444',
        caption: 'rgb(90 90 90 / 50%)'
      },
      // The dark By Category frame's, mirrored.
      category: {
        label: 'rgb(90 90 90 / 60%)',
        bar: 'rgb(0 0 0 / 50%)',
        'bar-top': 'rgb(0 0 0 / 85%)',
        'bar-glow': 'rgb(0 0 0 / 35%)',
        note: 'rgb(90 90 90 / 30%)'
      },
      // The dark Task Editor frame's, mirrored for light.
      tasks: {
        field: '#ffffff',
        text: '#262626',
        accent: '#1a1a1a',
        'on-accent': '#fbfaf7',
        danger: '#c4373b'
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
      'pill-flat-empty': 'rgb(0 0 0 / 5%)',
      'pill-outline': '#1a1a1a',
      weekday: 'rgb(90 90 90 / 55%)',
      'weekday-cell': '#000000',
      'weekday-low': 'rgb(196 55 59 / 70%)',
      'weekday-best': 'rgb(90 90 90 / 90%)',
      // The dark Recurring frame's, mirrored for light.
      'recurring-row': 'rgb(0 0 0 / 3%)',
      'recurring-meta': 'rgb(90 90 90 / 45%)',
      'recurring-amount': 'rgb(196 55 59 / 85%)',
      'recurring-footer': 'rgb(90 90 90 / 50%)',
      pill: {
        happy: pill('#65b25c', '#3f9a36'),
        okay: pill('#7f86e3', '#5a62d8'),
        stressed: pill('#ec9566', '#e0763f'),
        neutral: pill('#adafb3', '#8b8e93'),
        angry: pill('#bd5f63', '#a23a3f'),
        anxious: pill('#dac74c', '#c6ae1c'),
        habit: pill(
          '#8a8a8a', '#4a4a4a', '#4a4a4a', '#3f6fa0'
        ),
        quality: pill(
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
