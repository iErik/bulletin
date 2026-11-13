import { afterEach, beforeEach, describe, expect, it, vi }
  from 'vitest'
import { flushPromises, mount, type VueWrapper }
  from '@vue/test-utils'
import { setLocaleOverride } from '@/locale/format'
import { useFixedToday } from '@/testing/clock'
import SleepHours from './SleepHours.vue'

let hours: VueWrapper | undefined

// It measures its width once mounted.
const mountHours = async (): Promise<VueWrapper> => {
  hours = mount(SleepHours)
  await flushPromises()
  return hours
}

/** Each row's labels, AM then PM. */
const labels = (wrapper: VueWrapper): string[][] =>
  wrapper.findAll('.track:not(.-ticks)').map(track =>
    track.findAll('.hour').map(hour => hour.text()))

describe('SleepHours', () => {
  useFixedToday()

  beforeEach(() => {
    // happy-dom has no layout: the scales are 600 px wide.
    vi.spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 600 } as DOMRect)
  })

  afterEach(() => {
    hours?.unmount()
    hours = undefined
    vi.restoreAllMocks()
  })

  it('reads AM left to right and PM right to left', async () => {
    const [am, pm] = labels(await mountHours())

    expect(am).toEqual(Array.from({ length: 12 },
      (_, i) => `${i + 1}:00`))
    expect(pm).toEqual(['12:00',
      ...Array.from({ length: 11 }, (_, i) => `${11 - i}:00`)])
  })

  it("puts the hours under the snake's, dots between",
    async () => {
      const wrapper = await mountHours()
      const lefts = wrapper.findAll('.-ticks .tick')
        .map(tick => tick.attributes('style'))

      // The snake's rows run from 24.25 to 575.75 px.
      expect(lefts).toHaveLength(12)
      expect(lefts[0]).toBe('left: 24.25px;')
      expect(lefts[11]).toBe('left: 575.75px;')
      expect(wrapper.findAll('.dots')).toHaveLength(2 * 11)
    })

  it("follows a 24-hour Locale's clock", async () => {
    setLocaleOverride('pt-BR')

    const [am, pm] = labels(await mountHours())

    expect(am[0]).toBe('1:00')
    expect(pm[0]).toBe('24:00')
    expect(pm[11]).toBe('13:00')
  })
})
