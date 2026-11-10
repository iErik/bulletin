import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  applyPalette,
  resolveSemantic
} from '@/theme/semantic'
import { DEFAULT_THEME_ID, themes } from '@/theme/themes'
import {
  SCHEME_PREFERENCES,
  type Palette,
  type Scheme,
  type SchemePreference
} from '@/theme/types'

export const STORAGE_KEYS = {
  theme: 'bulletin.theme',
  scheme: 'bulletin.scheme'
} as const

export const DEFAULT_PREFERENCE: SchemePreference =
  'system'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const isThemeId = (value: string): boolean =>
  Object.hasOwn(themes, value)

const isPreference = (
  value: string
): value is SchemePreference =>
  (SCHEME_PREFERENCES as string[]).includes(value)

/** Reads a stored value; `null` if absent or unreadable. */
const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage is unavailable: keep the choice in memory.
  }
}

const storedTheme = (): string => {
  const value = read(STORAGE_KEYS.theme)
  return value && isThemeId(value)
    ? value
    : DEFAULT_THEME_ID
}

const storedPreference = (): SchemePreference => {
  const value = read(STORAGE_KEYS.scheme)
  return value && isPreference(value)
    ? value
    : DEFAULT_PREFERENCE
}

/**
 * Sends the Title Bar's colours to main, which paints
 * the window controls overlay with them (Linux and
 * Windows only).
 */
const pushControlColours = (
  palette: Palette,
  scheme: Scheme
): void => {
  const colours = resolveSemantic(palette, scheme)
  // The bridge is absent outside Electron, e.g. tests.
  window.bulletin?.setWindowControlsColours({
    background: colours.surface,
    symbol: colours.text
  })
}

/**
 * The active Theme and Scheme preference. Changing
 * either one, or the OS Scheme while the preference is
 * `system`, rewrites the semantic CSS custom properties
 * and recolours the window controls.
 */
export const useThemeStore = defineStore('theme', () => {
  const themeId = ref(storedTheme())
  const preference = ref(storedPreference())

  const media = window.matchMedia?.(DARK_QUERY)
  const systemScheme = ref<Scheme>(
    media?.matches === false ? 'light' : 'dark'
  )
  media?.addEventListener('change', event => {
    systemScheme.value = event.matches ? 'dark' : 'light'
  })

  const theme = computed(() => themes[themeId.value])
  const scheme = computed<Scheme>(() =>
    preference.value === 'system'
      ? systemScheme.value
      : preference.value
  )
  const palette = computed(
    () => theme.value.palettes[scheme.value]
  )

  watch(
    [palette, scheme],
    ([value, current]) => {
      applyPalette(value, current)
      pushControlColours(value, current)
    },
    { immediate: true, flush: 'sync' }
  )
  const sync = { flush: 'sync' } as const
  watch(
    themeId,
    id => write(STORAGE_KEYS.theme, id),
    sync
  )
  watch(
    preference,
    value => write(STORAGE_KEYS.scheme, value),
    sync
  )

  const setTheme = (id: string): void => {
    if (isThemeId(id)) themeId.value = id
  }
  const setPreference = (value: SchemePreference): void => {
    preference.value = value
  }

  return {
    themeId,
    preference,
    theme,
    scheme,
    setTheme,
    setPreference
  }
})
