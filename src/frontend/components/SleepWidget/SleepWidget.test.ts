import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import Icon from '@/components/Icon/Icon.vue'
import SleepWidget from './SleepWidget.vue'

const mountWidget = (
  fade?: boolean
): ReturnType<typeof mount> =>
  mount(SleepWidget, {
    props: fade === undefined ? {} : { fade },
    global: { plugins: [createPinia()] }
  })

describe('SleepWidget', () => {
  it('titles itself Sleep, with the moon icon', () => {
    const widget = mountWidget()

    expect(widget.get('.title').text()).toBe('Sleep')
    expect(widget.get('.tile').findComponent(Icon)
      .props('name')).toBe('moon')
  })

  it('fills its body with the Timeline', () => {
    expect(
      mountWidget().find('.body > .sleep-timeline').exists()
    ).toBe(true)
  })

  it('passes fade through, on by default', () => {
    expect(mountWidget().get('.sleep-timeline').classes())
      .toContain('-fade')
    expect(
      mountWidget(false).get('.sleep-timeline').classes()
    ).not.toContain('-fade')
  })
})
