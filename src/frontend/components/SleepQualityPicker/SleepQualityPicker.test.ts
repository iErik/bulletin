import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import type {
  SleepQualityRating
} from '@shared/sleep-quality'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import SleepQualityPicker from './SleepQualityPicker.vue'

let picker: VueWrapper | undefined
const DAY = new Date(2026, 7, 12)

const mountPicker = (current: SleepQualityRating | null = 4): VueWrapper =>
  picker = mount(SleepQualityPicker, {
    attachTo: document.body,
    props: { date: DAY, current }
  })

const button = (
  wrapper: VueWrapper,
  name: string
): DOMWrapper<HTMLButtonElement> =>
  wrapper.find<HTMLButtonElement>(`button[aria-label="${name}"]`)

const step = (
  wrapper: VueWrapper,
  label: string
): DOMWrapper<HTMLButtonElement> =>
  wrapper.findAll<HTMLButtonElement>('[role="radio"]')
    .find(option => option.text() === label)!

const checked = (wrapper: VueWrapper): string[] =>
  wrapper.findAll('[aria-checked="true"]').map(option => option.text())

// Months are 0-based.
describe('SleepQualityPicker', () => {
  useFixedToday()

  afterEach(() => {
    picker?.unmount()
    picker = undefined
    document.body.innerHTML = ''
  })

  it('names the day in its title', () => {
    expect(mountPicker().get('.title').text())
      .toBe('Quality · August 12th, 2026')
  })

  it('lists the five steps, Poor to Great', () => {
    expect(mountPicker().findAll('[role="radio"]').map(o => o.text()))
      .toEqual(['Poor', 'Fair', 'Okay', 'Good', 'Great'])
  })

  it('shades each swatch at its step', () => {
    expect(mountPicker().findAll('.swatch').map(s => s.attributes('style')))
      .toEqual(['0.18', '0.35', '0.55', '0.78', '1'].map(
        opacity => 'background: var(--color-pill-quality-'
          + `glow); opacity: ${opacity};`))
  })

  it('preselects and focuses the day’s rating', () => {
    const wrapper = mountPicker(2)
    expect(checked(wrapper)).toEqual(['Fair'])
    expect(document.activeElement).toBe(step(wrapper, 'Fair').element)
  })

  it('focuses Poor without a rating', () => {
    const wrapper = mountPicker(null)
    expect(checked(wrapper)).toEqual([])
    expect(document.activeElement).toBe(step(wrapper, 'Poor').element)
  })

  it('selects without saving', async () => {
    const api = stubBulletin()
    const wrapper = mountPicker()
    await step(wrapper, 'Great').trigger('click')
    expect(checked(wrapper)).toEqual(['Great'])
    expect(api.sleepQuality.create).not.toHaveBeenCalled()
  })

  it('saves a changed rating with ✓', async () => {
    const api = stubBulletin()
    const wrapper = mountPicker()
    await step(wrapper, 'Great').trigger('click')
    await button(wrapper, 'Save quality').trigger('click')
    await flushPromises()
    expect(api.sleepQuality.create)
      .toHaveBeenCalledWith({ date: '2026-08-12', rating: 5 })
    expect(wrapper.emitted('saved')).toEqual([[5]])
  })

  it.each([
    ['the same rating', 4 as const],
    ['no rating', null]
  ])('closes without storage on ✓ with %s', async (_, current) => {
    const api = stubBulletin()
    const wrapper = mountPicker(current)
    await button(wrapper, 'Save quality').trigger('click')
    expect(api.sleepQuality.create).not.toHaveBeenCalled()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('clears the day’s rating with the broom', async () => {
    const api = stubBulletin()
    const wrapper = mountPicker()
    await button(wrapper, 'Clear quality').trigger('click')
    await flushPromises()
    expect(api.sleepQuality.delete).toHaveBeenCalledWith('2026-08-12')
    expect(wrapper.emitted('saved')).toEqual([[null]])
  })

  it('disables the broom without a rating', () => {
    expect(button(mountPicker(null), 'Clear quality').element.disabled)
      .toBe(true)
  })

  it.each([
    ['internal', 'Couldn’t save the rating. Try again.'],
    ['future-date', 'A future day can’t have a rating.']
  ] as const)(
    'shows a %s error inline and stays open',
    async (code, message) => {
      const api = stubBulletin()
      vi.mocked(api.sleepQuality.create)
        .mockResolvedValue({ ok: false, error: { code } })
      const wrapper = mountPicker()
      await step(wrapper, 'Poor').trigger('click')
      await button(wrapper, 'Save quality').trigger('click')
      await flushPromises()
      expect(wrapper.get('[role="alert"]').text()).toBe(message)
      expect(wrapper.emitted('saved')).toBeUndefined()
      expect(wrapper.emitted('close')).toBeUndefined()
    }
  )

  it('shows a clearing error inline', async () => {
    const api = stubBulletin()
    vi.mocked(api.sleepQuality.delete)
      .mockResolvedValue({ ok: false, error: { code: 'not-found' } })
    const wrapper = mountPicker()
    await button(wrapper, 'Clear quality').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text())
      .toBe('Couldn’t clear the rating. Try again.')
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('ignores ✓, Escape and the broom while writing', async () => {
    const api = stubBulletin()
    vi.mocked(api.sleepQuality.delete)
      .mockReturnValue(new Promise(() => {}))
    const wrapper = mountPicker()
    await button(wrapper, 'Clear quality').trigger('click')
    await button(wrapper, 'Clear quality').trigger('click')
    await button(wrapper, 'Save quality').trigger('click')
    await step(wrapper, 'Okay').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(api.sleepQuality.delete).toHaveBeenCalledTimes(1)
    expect((wrapper.vm as unknown as { busy: boolean }).busy).toBe(true)
  })

  describe('keyboard', () => {
    it('closes on Escape without saving', async () => {
      const api = stubBulletin()
      const wrapper = mountPicker()
      await step(wrapper, 'Great').trigger('click')
      await step(wrapper, 'Great').trigger('keydown', { key: 'Escape' })
      expect(wrapper.emitted('close')).toHaveLength(1)
      expect(api.sleepQuality.create).not.toHaveBeenCalled()
    })

    it.each([{ metaKey: true }, { ctrlKey: true }])(
      'saves on %o + Enter',
      async modifier => {
        const api = stubBulletin()
        const wrapper = mountPicker()
        await step(wrapper, 'Okay').trigger('click')
        await step(wrapper, 'Okay')
          .trigger('keydown', { key: 'Enter', ...modifier })
        await flushPromises()
        expect(api.sleepQuality.create)
          .toHaveBeenCalledWith({ date: '2026-08-12', rating: 3 })
      }
    )

    it('moves between steps with the arrows', async () => {
      const wrapper = mountPicker(1)
      await step(wrapper, 'Poor').trigger('keydown', { key: 'ArrowRight' })
      expect(document.activeElement).toBe(step(wrapper, 'Fair').element)
      await step(wrapper, 'Fair').trigger('keydown', { key: 'ArrowDown' })
      expect(document.activeElement).toBe(step(wrapper, 'Good').element)
      await step(wrapper, 'Good').trigger('keydown', { key: 'ArrowDown' })
      expect(document.activeElement).toBe(step(wrapper, 'Good').element)
      expect(checked(wrapper)).toEqual(['Poor'])
    })

    it.each(['Enter', ' '])(
      'selects the focused step with %j',
      async key => {
        const wrapper = mountPicker()
        await step(wrapper, 'Great').trigger('keydown', { key })
        expect(checked(wrapper)).toEqual(['Great'])
      }
    )

    it('keeps the arrows from the window', async () => {
      const onKey = vi.fn()
      window.addEventListener('keydown', onKey)
      const wrapper = mountPicker()
      await step(wrapper, 'Good').trigger('keydown', { key: 'ArrowLeft' })
      window.removeEventListener('keydown', onKey)
      expect(onKey).not.toHaveBeenCalled()
    })
  })
})
