import { afterEach, beforeEach, vi } from 'vitest'
import { setLocaleOverride } from '@/locale/format'

/** Today in tests: November 9th, 2026. */
export const today = new Date(2026, 10, 9)

/**
 * Around each test of the calling suite, freezes the
 * clock on `today` at 3:30 PM and sets the en-US
 * Locale.
 */
export const useFixedToday = (): void => {
  beforeEach(() => {
    vi.useFakeTimers({
      now: new Date(today).setHours(15, 30)
    })
    setLocaleOverride('en-US')
  })

  afterEach(() => {
    setLocaleOverride(null)
    vi.useRealTimers()
  })
}
