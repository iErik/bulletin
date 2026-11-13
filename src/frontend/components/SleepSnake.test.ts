import { afterEach, beforeEach, describe, expect, it, vi }
  from 'vitest'
import { flushPromises, mount, type VueWrapper }
  from '@vue/test-utils'
import type { SleepPeriod } from '@shared/sleep'
import {
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

const point = (time: number): { x: number; y: number } =>
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
): { x: number; y: number }[] =>
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

  it('dots every AM and PM row', async () => {
    const wrapper = await mountSnake()

    const track = wrapper.get('.track').attributes('d')!
    expect(track.match(/M /g)).toHaveLength(3 * 2)
    expect(track.startsWith('M 0 23 H 600 M 0 51.5 H 600'))
      .toBe(true)
  })

  it('draws a Period across noon as one stretch', async () => {
    const period: SleepPeriod =
      { id: 1, start: at(7, 6), end: at(7, 15) }
    const wrapper = await mountSnake({ periods: [period] })

    const line = wrapper.get('[data-period="1"] .line')
    expect(line.attributes('d')).toBe(
      stretchPath(period.start, period.end, FIRST, LAYOUT))
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

  it('shades a line left to right across its span', async () => {
    const wrapper = await mountSnake({ periods: [
      { id: 1, start: at(7, 2), end: at(7, 7) }
    ] })

    const gradient = wrapper.get('linearGradient')
    expect(Number(gradient.attributes('x1')))
      .toBe(point(at(7, 2)).x)
    expect(Number(gradient.attributes('x2')))
      .toBe(point(at(7, 7)).x)
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
      expect(wrapper.get('.-preview').classes())
        .toContain('-broken')
    })

  it('reports the time under the pointer', async () => {
    const wrapper = await mountSnake()
    const svg = wrapper.get('svg')
    const { x, y } = point(at(8, 18, 30))

    await svg.trigger('pointermove', { clientX: x, clientY: y })
    await svg.trigger('click', { clientX: x, clientY: y })
    await svg.trigger('pointerleave')

    expect(wrapper.emitted('point'))
      .toEqual([[at(8, 18, 30)], [null]])
    expect(wrapper.emitted('press')).toEqual([[at(8, 18, 30)]])
  })

  it('keeps a click on the days it draws', async () => {
    const wrapper = await mountSnake()

    await wrapper.get('svg').trigger('click', {
      clientX: LAYOUT.left,
      clientY: -500
    })

    expect(wrapper.emitted('press'))
      .toEqual([[at(7, 0)]])
  })

  it('reports a press on an end as a grab', async () => {
    const period: SleepPeriod =
      { id: 1, start: at(7, 2), end: at(7, 7) }
    const wrapper = await mountSnake({ periods: [period] })

    await wrapper.get('.handle.-end').trigger('pointerdown')

    expect(wrapper.emitted('grab'))
      .toEqual([[period, 'end']])
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
})
