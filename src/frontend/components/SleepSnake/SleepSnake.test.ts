import { afterEach, beforeEach, describe, expect, it, vi }
  from 'vitest'
import { flushPromises, mount, type VueWrapper }
  from '@vue/test-utils'
import type { SleepPeriod } from '@shared/sleep'
import { setLocaleOverride } from '@/locale/format'
import {
  type Point,
  pointAt,
  snakeLayout,
  stretchPath
} from '@/sleep/snake'
import SleepSnake from './SleepSnake.vue'

/** November `day`, 2026, at `h:m` local time. */
const at = (day: number, h: number, m = 0): number =>
  new Date(2026, 10, day, h, m).getTime()

const FIRST = new Date(2026, 10, 7)
// happy-dom has no layout: the snake is 600 px wide.
const WIDTH = 600
const LAYOUT = snakeLayout(WIDTH)

const point = (time: number): Point =>
  pointAt(time, FIRST, LAYOUT)

let snake: VueWrapper | undefined

// It measures its width once mounted.
const mountSnake = async (
  props: Partial<InstanceType<typeof SleepSnake>['$props']>
    = {}
): Promise<VueWrapper> => {
  snake = mount(SleepSnake, {
    attachTo: document.body,
    props: { first: FIRST, days: 3, periods: [], ...props }
  })
  await flushPromises()
  return snake
}

const ends = (
  wrapper: VueWrapper,
  period: number
): Point[] =>
  wrapper.findAll(`[data-period="${period}"] .end`)
    .map(end => ({
      x: Number(end.attributes('cx')),
      y: Number(end.attributes('cy'))
    }))

describe('SleepSnake', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue(
        { left: 0, top: 0, width: WIDTH } as DOMRect
      )
  })

  afterEach(() => {
    snake?.unmount()
    snake = undefined
    vi.restoreAllMocks()
  })

  it("dots every row, out to the curves' edges",
    async () => {
      const wrapper = await mountSnake()

      const track = wrapper.get('.track').attributes('d')!
      // Three days and the day after's AM and PM rows.
      expect(track.match(/M /g)).toHaveLength(4 * 2)
      expect(track)
        .toMatch(/^M 10 23 H 590 M 10 51\.5 H 590 /)
      expect(track.endsWith('M 10 222.5 H 590')).toBe(true)
    })

  it("holds the day after's PM row, where a Period can end",
    async () => {
      const wrapper = await mountSnake({ periods: [
        { id: 1, start: at(9, 15), end: at(10, 14) }
      ] })

      const [, tail] = ends(wrapper, 1)
      const height =
        Number(wrapper.get('svg').attributes('height'))
      expect(tail.y).toBe(222.5)
      expect(height - tail.y).toBe(23)
    })

  it('draws a Period across noon as one stretch',
    async () => {
      const period: SleepPeriod =
        { id: 1, start: at(7, 6), end: at(7, 15) }
      const wrapper =
        await mountSnake({ periods: [period] })

      const line = wrapper.get('[data-period="1"] .line')
      expect(line.attributes('d')).toBe(
        stretchPath(
          period.start, period.end, FIRST, LAYOUT
        ))
      expect(line.attributes('d')).toContain(' A ')
      expect(ends(wrapper, 1))
        .toEqual([point(period.start), point(period.end)])
    })

  it("runs a Period past midnight into the next day's rows",
    async () => {
      const wrapper = await mountSnake({ periods: [
        { id: 1, start: at(7, 23), end: at(8, 7) }
      ] })

      const [head, tail] = ends(wrapper, 1)
      expect(head.y).toBe(LAYOUT.top + LAYOUT.gap)
      expect(tail.y).toBe(LAYOUT.top + 2 * LAYOUT.gap)
      // Round the left curve, which turns anticlockwise.
      expect(wrapper.get('[data-period="1"] .line')
        .attributes('d')).toContain(' 0 0 0 ')
    })

  it('shades a line from its Head\'s side to its Tail\'s',
    async () => {
      const wrapper = await mountSnake({ periods: [
        { id: 1, start: at(7, 2), end: at(7, 7) },
        // On a PM row, right to left.
        { id: 2, start: at(7, 14), end: at(7, 20) }
      ] })

      const [am, pm] = wrapper.findAll('linearGradient')
        .map(g => [g.attributes('x1'), g.attributes('x2')]
          .map(Number))
      expect(am)
        .toEqual([point(at(7, 2)).x, point(at(7, 7)).x])
      expect(pm)
        .toEqual([point(at(7, 14)).x, point(at(7, 20)).x])
    })

  it('marks the Period being edited', async () => {
    const wrapper = await mountSnake({
      periods: [{ id: 4, start: at(7, 2), end: at(7, 7) }],
      editing: 4
    })

    expect(wrapper.get('[data-period="4"]').classes())
      .toContain('-editing')
  })

  it('draws the preview, red while it breaks a rule',
    async () => {
      const wrapper = await mountSnake({
        preview: { start: at(7, 2), end: at(7, 7) }
      })

      expect(wrapper.get('.-preview').classes())
        .not.toContain('-broken')

      await wrapper.setProps({ broken: true })
      const preview = wrapper.get('.-preview')
      expect(preview.classes()).toContain('-broken')
      // Its stops and halo take the red from a scope
      // around them, not from what uses them.
      expect(preview.find('linearGradient stop').exists())
        .toBe(true)
      const halo = preview.get('.end').attributes('filter')!
        .match(/#(.+)\)/)![1]
      expect(wrapper.get(`.-broken > [id="${halo}"]`)
        .element.tagName).toBe('filter')
    })

  it('reports the time under the pointer', async () => {
    const wrapper = await mountSnake()
    const svg = wrapper.get('svg')
    const { x, y } = point(at(8, 18, 30))

    const where = { clientX: x, clientY: y }
    await svg.trigger('pointermove', where)
    await svg.trigger('click', where)
    await svg.trigger('pointerleave')

    expect(wrapper.emitted('point'))
      .toEqual([[at(8, 18, 30)], [null]])
    expect(wrapper.emitted('press')?.map(([time]) => time))
      .toEqual([at(8, 18, 30)])
  })

  it('keeps a click on the days it draws', async () => {
    const wrapper = await mountSnake()

    await wrapper.get('svg').trigger('click', {
      clientX: LAYOUT.left,
      clientY: -500
    })

    expect(wrapper.emitted('press')?.[0][0])
      .toBe(at(7, 0))
  })

  it('reports a press on an end as a grab', async () => {
    const period: SleepPeriod =
      { id: 1, start: at(7, 2), end: at(7, 7) }
    const wrapper = await mountSnake({ periods: [period] })

    const handle = wrapper.get('.handle.-end')
    await handle.trigger('pointerdown')
    await handle.trigger('click')

    expect(wrapper.emitted('grab'))
      .toEqual([[period, 'end']])
    expect(wrapper.emitted('press')).toBeUndefined()
  })

  it('shows a time on the snake', async () => {
    const wrapper = await mountSnake({
      hover: { time: at(7, 4), text: '4:00 AM' }
    })

    const chip = wrapper.get<HTMLElement>('.hover')
    expect(chip.text()).toBe('4:00 AM')
    const { x, y } = point(at(7, 4))
    const style = chip.element.style
    expect(parseFloat(style.left)).toBeCloseTo(x)
    expect(parseFloat(style.top)).toBeCloseTo(y)
  })

  it('opens a Period on Enter, and labels it', async () => {
    setLocaleOverride('en-US')
    const period: SleepPeriod =
      { id: 1, start: at(7, 2), end: at(7, 7) }
    const wrapper = await mountSnake({ periods: [period] })
    const stop = wrapper.get('[data-period="1"]')

    expect(stop.attributes('tabindex')).toBe('0')
    expect(stop.attributes('aria-label'))
      .toMatch(/^Period, 2:00\sAM to 7:00\sAM$/)
    await stop.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('open')).toEqual([[period]])
    setLocaleOverride(null)
  })

  it('dims the days to come, and takes their input',
    async () => {
      const wrapper = await mountSnake({ future: 2 })
      const future = wrapper.get('.future')

      // From the middle of the third day's first curve.
      expect(Number(future.attributes('y')))
        .toBe(LAYOUT.top + 4 * LAYOUT.gap - LAYOUT.gap / 2)
      await future.trigger('pointermove')
      await future.trigger('click')

      expect(wrapper.emitted('point')).toEqual([[null]])
      expect(wrapper.emitted('press')).toBeUndefined()
    })
})
