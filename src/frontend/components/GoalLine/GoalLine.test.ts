import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import {
  mount,
  type VueWrapper
} from '@vue/test-utils'
import GoalLine from './GoalLine.vue'

const base = {
  value: 480,
  min: 240,
  max: 720,
  step: 15,
  scaleMin: 240,
  scaleMax: 720,
  label: '8h goal',
  ariaLabel: 'Sleep Goal',
  ariaValueText: '8 hours'
}

let wrapper: VueWrapper | undefined

const mountLine = (
  overrides: Partial<typeof base> & {
    labelPosition?: 'on' | 'above'
  } = {}
): VueWrapper => {
  wrapper = mount(GoalLine, {
    attachTo: document.body,
    props: { ...base, ...overrides }
  })
  return wrapper
}

const el = (w: VueWrapper): HTMLElement =>
  w.get('[role="slider"]').element as HTMLElement

const fakeRect = (node: HTMLElement): void => {
  vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
    top: 0, bottom: 480, height: 480, left: 0,
    right: 100, width: 100, x: 0, y: 0,
    toJSON: () => ({})
  })
}

describe('GoalLine', () => {
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('steps, clamps, previews, commits and cancels',
    async () => {
      const w = mountLine()
      expect(w.get('.label').text()).toBe('8h goal')
      await w.get('[role="slider"]')
        .trigger('keydown', { key: 'ArrowUp' })
      expect(w.emitted('commit')).toEqual([[495]])

      await w.setProps({ value: 720 })
      await w.get('[role="slider"]')
        .trigger('keydown', { key: 'ArrowUp' })
      expect(w.emitted('commit')!.at(-1)).toEqual([720])

      await w.setProps({ value: 240 })
      await w.get('[role="slider"]')
        .trigger('keydown', { key: 'ArrowDown' })
      expect(w.emitted('commit')!.at(-1)).toEqual([240])

      w.unmount()
      const drag = mountLine()
      fakeRect(el(drag))
      el(drag).dispatchEvent(new PointerEvent(
        'pointerdown',
        { button: 0, clientY: 120, bubbles: true }
      ))
      expect(drag.emitted('preview')!.at(-1))
        .toEqual([600])
      window.dispatchEvent(new PointerEvent(
        'pointerup', { clientY: 120, bubbles: true }
      ))
      expect(drag.emitted('commit')!.at(-1))
        .toEqual([600])

      drag.unmount()
      const cancel = mountLine()
      fakeRect(el(cancel))
      el(cancel).dispatchEvent(new PointerEvent(
        'pointerdown',
        { button: 0, clientY: 120, bubbles: true }
      ))
      await cancel.get('[role="slider"]')
        .trigger('keydown', { key: 'Escape' })
      expect(cancel.emitted('preview')!.at(-1))
        .toEqual([480])
      expect(cancel.emitted('commit')).toBeUndefined()
    })

  it('supports placing the label above the dashed line', () => {
    const w = mountLine({ labelPosition: 'above' })
    expect(w.get('[role="slider"]').classes())
      .toContain('-above')
  })
})
