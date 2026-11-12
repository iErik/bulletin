import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock
} from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { MOODS } from '@shared/mood'
import { defaultTheme } from '@/theme/themes'
import type { Palette, Theme } from '@/theme/types'
import { STORAGE_KEYS, useThemeStore } from './theme'
import { stubBulletin } from '@/testing/bulletin'

// A second Theme, so switching Themes can be tested.
vi.mock('@/theme/themes', async original => {
  const mod =
    await original<typeof import('@/theme/themes')>()
  const flat = (colour: string): Palette => {
    const shades = mod.scale(Array(9).fill(colour))
    return {
      background: shades,
      foreground: shades,
      accent: shades,
      danger: colour,
      income: colour,
      expense: colour,
      mood: Object.fromEntries(
        MOODS.map(mood => [mood.key, colour])
      ) as Palette['mood']
    }
  }
  const other: Theme = {
    id: 'other',
    name: 'Other',
    palettes: {
      dark: flat('#000001'),
      light: flat('#fffffe')
    }
  }
  return {
    ...mod,
    themes: { ...mod.themes, other }
  }
})

type Listener = (event: { matches: boolean }) => void

/** Fakes `prefers-color-scheme`; returns a setter. */
const mockSystemScheme = (dark: boolean) => {
  const listeners: Listener[] = []
  const query = {
    matches: dark,
    addEventListener: (_: string, fn: Listener) =>
      listeners.push(fn)
  }
  vi.stubGlobal('matchMedia', vi.fn(() => query))
  return (next: boolean) => {
    query.matches = next
    listeners.forEach(fn => fn({ matches: next }))
  }
}

const surface = (): string =>
  document.documentElement.style
    .getPropertyValue('--color-surface')

const { dark, light } = defaultTheme.palettes

/** Fakes the preload API; returns the colours spy. */
const mockBridge = (): Mock => {
  const setWindowControlsColours = vi.fn()
  stubBulletin({
    platform: 'linux',
    setWindowControlsColours
  })
  return setWindowControlsColours
}

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('style')
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('defaults to the default Theme on system', () => {
    mockSystemScheme(true)

    const store = useThemeStore()

    expect(store.themeId).toBe('default')
    expect(store.preference).toBe('system')
    expect(surface()).toBe(dark.background[900])
  })

  it('rewrites the CSS variables on Scheme change', () => {
    mockSystemScheme(true)
    const store = useThemeStore()

    store.setPreference('light')

    expect(surface()).toBe(light.background[100])
    expect(document.documentElement.style.colorScheme)
      .toBe('light')
  })

  it('writes every Mood colour for the Scheme', () => {
    mockSystemScheme(true)
    const store = useThemeStore()
    const moods = (): string[] => MOODS.map(mood =>
      document.documentElement.style
        .getPropertyValue(`--color-${mood.colour}`))

    expect(moods()).toEqual(
      MOODS.map(mood => dark.mood[mood.key])
    )

    store.setPreference('light')

    expect(moods()).toEqual(
      MOODS.map(mood => light.mood[mood.key])
    )
  })

  it('writes the Income and Expense colours', () => {
    mockSystemScheme(true)
    useThemeStore()
    const colour = (name: string): string =>
      document.documentElement.style
        .getPropertyValue(`--color-${name}`)

    expect([colour('income'), colour('expense')])
      .toEqual([dark.income, dark.expense])
  })

  it('rewrites the CSS variables on Theme change', () => {
    mockSystemScheme(false)
    const store = useThemeStore()

    store.setTheme('other')

    expect(surface()).toBe('#fffffe')
  })

  it('ignores unknown Theme ids', () => {
    mockSystemScheme(true)
    const store = useThemeStore()

    store.setTheme('missing')

    expect(store.themeId).toBe('default')
  })

  it('resolves system through the OS Scheme', () => {
    mockSystemScheme(false)

    const store = useThemeStore()

    expect(store.scheme).toBe('light')
    expect(surface()).toBe(light.background[100])
  })

  it('follows OS Scheme changes live on system', () => {
    const setSystemDark = mockSystemScheme(false)
    const store = useThemeStore()

    setSystemDark(true)

    expect(store.scheme).toBe('dark')
    expect(surface()).toBe(dark.background[900])
  })

  it('ignores OS Scheme changes when explicit', () => {
    const setSystemDark = mockSystemScheme(false)
    const store = useThemeStore()
    store.setPreference('light')

    setSystemDark(true)

    expect(store.scheme).toBe('light')
  })

  it('persists the Theme and Scheme choice', () => {
    mockSystemScheme(true)
    const store = useThemeStore()

    store.setTheme('other')
    store.setPreference('light')

    expect(localStorage.getItem(STORAGE_KEYS.theme))
      .toBe('other')
    expect(localStorage.getItem(STORAGE_KEYS.scheme))
      .toBe('light')
  })

  it('restores the stored choice', () => {
    mockSystemScheme(true)
    localStorage.setItem(STORAGE_KEYS.theme, 'other')
    localStorage.setItem(STORAGE_KEYS.scheme, 'light')

    const store = useThemeStore()

    expect(store.themeId).toBe('other')
    expect(store.scheme).toBe('light')
    expect(surface()).toBe('#fffffe')
  })

  it('falls back to defaults on invalid values', () => {
    mockSystemScheme(true)
    localStorage.setItem(STORAGE_KEYS.theme, 'gone')
    localStorage.setItem(STORAGE_KEYS.scheme, 'sepia')

    const store = useThemeStore()

    expect(store.themeId).toBe('default')
    expect(store.preference).toBe('system')
  })

  it('falls back to defaults when storage fails', () => {
    mockSystemScheme(true)
    const fail = (): never => {
      throw new Error('denied')
    }
    vi.spyOn(Storage.prototype, 'getItem')
      .mockImplementation(fail)
    vi.spyOn(Storage.prototype, 'setItem')
      .mockImplementation(fail)

    const store = useThemeStore()
    store.setPreference('light')

    expect(store.themeId).toBe('default')
    expect(store.scheme).toBe('light')
  })

  it('sends the window controls colours', () => {
    mockSystemScheme(true)
    const send = mockBridge()

    useThemeStore()

    expect(send).toHaveBeenLastCalledWith({
      background: dark.background[900],
      symbol: dark.foreground[100]
    })
  })

  it('resends them on Scheme change', () => {
    mockSystemScheme(true)
    const send = mockBridge()
    const store = useThemeStore()

    store.setPreference('light')

    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenLastCalledWith({
      background: light.background[100],
      symbol: light.foreground[900]
    })
  })

  it('resends them on OS Scheme change', () => {
    const setSystemDark = mockSystemScheme(true)
    const send = mockBridge()
    useThemeStore()

    setSystemDark(false)

    expect(send).toHaveBeenLastCalledWith({
      background: light.background[100],
      symbol: light.foreground[900]
    })
  })
})
