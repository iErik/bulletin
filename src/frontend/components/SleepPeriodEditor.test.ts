import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setLocaleOverride } from '@/locale/format'
import { today, useFixedToday } from '@/testing/clock'
import SleepPeriodEditor from './SleepPeriodEditor.vue'

// happy-dom has no layout: the list spans x 100 to
// 500, less a `gutter` for its scrollbar, and the
// tooltip is WIDTH wide at `left`.
const WIDTH = 180
let left = 200
let gutter = 0

const fakeLayout = (): void => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: Element) {
      const list = this.classList.contains('rows')
      const x = list ? 100 : left
      const width = list ? 400 : WIDTH
      return {
        left: x,
        right: x + width,
        width,
        top: 100,
        bottom: 130,
        height: 30
      } as DOMRect
    })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('rows')
        ? 400 - gutter
        : WIDTH
    })
  vi.spyOn(HTMLElement.prototype, 'clientLeft', 'get')
    .mockReturnValue(0)
}

const period = {
  id: 1,
  start: new Date(today).setHours(2, 10),
  end: new Date(today).setHours(11, 10)
}

let editor: VueWrapper | undefined

const mountEditor = async (): Promise<VueWrapper> => {
  const rows = document.createElement('div')
  rows.className = 'rows'
  document.body.append(rows)
  editor = mount(SleepPeriodEditor, {
    props: { period, day: today, periods: [period] },
    attachTo: rows
  })
  await nextTick()
  return editor
}

const style = (name: string): string =>
  (editor!.element as HTMLElement).style
    .getPropertyValue(name)

describe('SleepPeriodEditor', () => {
  useFixedToday()

  beforeEach(() => {
    left = 200
    gutter = 0
    fakeLayout()
  })

  afterEach(() => {
    editor?.unmount()
    editor = undefined
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('shows 12-hour times in full', async () => {
    const wrapper = await mountEditor()
    const [start, end] = wrapper.findAll('input')

    expect(start.element.value).toBe('2:10 AM')
    expect(end.element.value).toBe('11:10 AM')
    // Its fields grow up to "10:55 PM".
    expect(style('--time-chars')).toBe('8')
  })

  it("grows up to a 24-hour clock's longest time",
    async () => {
      setLocaleOverride('pt-BR')
      await mountEditor()

      expect(style('--time-chars')).toBe('5')
    })

  it('stays where it is inside the list', async () => {
    await mountEditor()

    expect(style('--shift')).toBe('0px')
  })

  it('shifts back from the right edge', async () => {
    left = 400
    await mountEditor()

    expect(style('--shift')).toBe('-80px')
  })

  it('shifts back from the left edge', async () => {
    left = 60
    await mountEditor()

    expect(style('--shift')).toBe('40px')
  })

  it('keeps clear of the list\'s scrollbar', async () => {
    left = 400
    gutter = 15
    await mountEditor()

    expect(style('--shift')).toBe('-95px')
  })

  it('fits again when its fields change', async () => {
    const wrapper = await mountEditor()
    left = 450
    await wrapper.findAll('input')[1].setValue('11:40 AM')
    await nextTick()

    expect(style('--shift')).toBe('-130px')
  })
})
