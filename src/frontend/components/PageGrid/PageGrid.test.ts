import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PageGrid from './PageGrid.vue'

let grid: VueWrapper | undefined

const mountGrid = (
  slots: Record<string, string> = {}
): VueWrapper => {
  const bar = document.createElement('div')
  bar.id = 'title-bar-content'
  document.body.append(bar)
  return grid = mount(PageGrid, {
    slots,
    attachTo: document.body,
    global: { plugins: [createPinia()] }
  })
}

describe('PageGrid', () => {
  afterEach(() => {
    grid?.unmount()
    grid = undefined
    document.body.innerHTML = ''
  })

  it('puts each slot in its cell', () => {
    const page = mountGrid({
      wide: '<p class="mark">Wide</p>',
      side: '<p class="mark">Side</p>',
      left: '<p class="mark">Left</p>',
      middle: '<p class="mark">Middle</p>',
      right: '<p class="mark">Right</p>',
      default: '<p class="mark">Outside</p>'
    })

    expect(page.get('.wide > .mark').text()).toBe('Wide')
    expect(page.get('.side > .mark').text()).toBe('Side')
    expect(page.get('.left > .mark').text()).toBe('Left')
    expect(page.get('.middle > .mark').text())
      .toBe('Middle')
    expect(page.get('.right > .mark').text()).toBe('Right')
    expect(page.get('.page-grid > .mark').text())
      .toBe('Outside')
  })

  it('puts the date header in the Title Bar', () => {
    mountGrid()

    expect(
      document.querySelector(
        '#title-bar-content > .date-header'
      )
    ).not.toBeNull()
  })
})
