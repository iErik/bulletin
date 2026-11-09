import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { stubBulletin } from '@/testing/bulletin'
import TitleBar from './TitleBar.vue'

const mountOn = (platform: string) => {
  stubBulletin({ platform })
  return mount(TitleBar, {
    slots: { default: '<h1 class="date">Today</h1>' }
  })
}

const inset = (bar: ReturnType<typeof mountOn>) =>
  (bar.element as HTMLElement).style
    .getPropertyValue('--title-bar-controls')

describe('TitleBar', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is as tall as the overlay', () => {
    const bar = mountOn('linux')

    expect(
      (bar.element as HTMLElement).style
        .getPropertyValue('--title-bar-height')
    ).toBe('44px')
  })

  it('keeps the traffic lights clear on macOS', () => {
    const bar = mountOn('darwin')

    expect(bar.attributes('data-controls')).toBe('left')
    expect(inset(bar)).toBe('88px')
  })

  it.each(['linux', 'win32'])(
    'keeps the overlay clear on %s',
    platform => {
      const bar = mountOn(platform)

      expect(bar.attributes('data-controls'))
        .toBe('right')
      expect(inset(bar)).toContain('titlebar-area-width')
    }
  )

  it('renders its slot in the content area', () => {
    const bar = mountOn('darwin')

    expect(bar.get('#title-bar-content .date').text())
      .toBe('Today')
  })
})
