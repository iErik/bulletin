import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flushPromises,
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import type { MoodKey } from '@shared/mood'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import MoodPicker from './MoodPicker.vue'

let picker: VueWrapper | undefined

const DAY = new Date(2026, 7, 12)

const mountPicker = (
  current: MoodKey | null = 'happy'
): VueWrapper =>
  picker = mount(MoodPicker, {
    attachTo: document.body,
    props: { date: DAY, current }
  })

const button = (
  wrapper: VueWrapper,
  name: string
): DOMWrapper<HTMLButtonElement> =>
  wrapper.find<HTMLButtonElement>(
    `button[aria-label="${name}"]`
  )

const mood = (
  wrapper: VueWrapper,
  label: string
): DOMWrapper<HTMLButtonElement> =>
  wrapper.findAll<HTMLButtonElement>('[role="radio"]')
    .find(option => option.text() === label)!

const checked = (wrapper: VueWrapper): string[] =>
  wrapper.findAll('[aria-checked="true"]')
    .map(option => option.text())

// Months are 0-based.
describe('MoodPicker', () => {
  useFixedToday()

  afterEach(() => {
    picker?.unmount()
    picker = undefined
    document.body.innerHTML = ''
  })

  it('names the day in its title', () => {
    expect(mountPicker().get('.title').text())
      .toBe('Mood · August 12th, 2026')
  })

  it('preselects and focuses the day’s Mood', () => {
    const wrapper = mountPicker('stressed')

    expect(checked(wrapper)).toEqual(['Stressed'])
    expect(document.activeElement)
      .toBe(mood(wrapper, 'Stressed').element)
  })

  it('selects without saving', async () => {
    const api = stubBulletin()
    const wrapper = mountPicker()

    await mood(wrapper, 'Okay').trigger('click')

    expect(checked(wrapper)).toEqual(['Okay'])
    expect(api.mood.create).not.toHaveBeenCalled()
  })

  it('saves a changed Mood with ✓', async () => {
    const api = stubBulletin()
    const wrapper = mountPicker()

    await mood(wrapper, 'Okay').trigger('click')
    await button(wrapper, 'Save mood').trigger('click')
    await flushPromises()

    expect(api.mood.create).toHaveBeenCalledWith({
      date: '2026-08-12',
      mood: 'okay'
    })
    expect(wrapper.emitted('saved')).toEqual([['okay']])
  })

  it.each([
    ['the same Mood', 'happy' as const],
    ['no Mood', null]
  ])(
    'closes without storage on ✓ with %s',
    async (_, current) => {
      const api = stubBulletin()
      const wrapper = mountPicker(current)

      await button(wrapper, 'Save mood').trigger('click')

      expect(api.mood.create).not.toHaveBeenCalled()
      expect(wrapper.emitted('close')).toHaveLength(1)
    }
  )

  it('clears the day’s Mood with the eraser', async () => {
    const api = stubBulletin()
    const wrapper = mountPicker()

    await button(wrapper, 'Clear mood').trigger('click')
    await flushPromises()

    expect(api.mood.delete)
      .toHaveBeenCalledWith('2026-08-12')
    expect(wrapper.emitted('saved')).toEqual([[null]])
  })

  it('disables the eraser without a Mood', () => {
    expect(button(mountPicker(null), 'Clear mood')
      .element.disabled).toBe(true)
  })

  it.each([
    ['internal', 'Couldn’t save the Mood. Try again.'],
    ['future-date', 'A future day can’t have a Mood.']
  ] as const)(
    'shows a %s error inline and stays open',
    async (code, message) => {
      const api = stubBulletin()
      vi.mocked(api.mood.create).mockResolvedValue({
        ok: false,
        error: { code }
      })
      const wrapper = mountPicker()

      await mood(wrapper, 'Angry').trigger('click')
      await button(wrapper, 'Save mood').trigger('click')
      await flushPromises()

      expect(wrapper.get('[role="alert"]').text())
        .toBe(message)
      expect(wrapper.emitted('saved')).toBeUndefined()
      expect(wrapper.emitted('close')).toBeUndefined()
    }
  )

  it('shows a clearing error inline', async () => {
    const api = stubBulletin()
    vi.mocked(api.mood.delete).mockResolvedValue({
      ok: false,
      error: { code: 'not-found' }
    })
    const wrapper = mountPicker()

    await button(wrapper, 'Clear mood').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text())
      .toBe('Couldn’t clear the Mood. Try again.')
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('keeps ✓ and the eraser enabled while writing',
    async () => {
      const api = stubBulletin()
      vi.mocked(api.mood.create)
        .mockReturnValue(new Promise(() => {}))
      const wrapper = mountPicker()

      await mood(wrapper, 'Angry').trigger('click')
      await button(wrapper, 'Save mood').trigger('click')
      await button(wrapper, 'Save mood').trigger('click')

      expect(button(wrapper, 'Save mood')
        .element.disabled).toBe(false)
      expect(button(wrapper, 'Clear mood')
        .element.disabled).toBe(false)
      expect(api.mood.create).toHaveBeenCalledTimes(1)
    })

  describe('keyboard', () => {
    it('closes on Escape without saving', async () => {
      const api = stubBulletin()
      const wrapper = mountPicker()

      await mood(wrapper, 'Okay').trigger('click')
      await mood(wrapper, 'Okay')
        .trigger('keydown', { key: 'Escape' })

      expect(wrapper.emitted('close')).toHaveLength(1)
      expect(api.mood.create).not.toHaveBeenCalled()
    })

    it.each([{ metaKey: true }, { ctrlKey: true }])(
      'saves on %o + Enter',
      async modifier => {
        const api = stubBulletin()
        const wrapper = mountPicker()

        await mood(wrapper, 'Neutral').trigger('click')
        await mood(wrapper, 'Neutral').trigger(
          'keydown',
          { key: 'Enter', ...modifier }
        )
        await flushPromises()

        expect(api.mood.create).toHaveBeenCalledWith({
          date: '2026-08-12',
          mood: 'neutral'
        })
      }
    )

    it('moves between Moods with the arrows', async () => {
      const wrapper = mountPicker('happy')

      await mood(wrapper, 'Happy')
        .trigger('keydown', { key: 'ArrowRight' })
      expect(document.activeElement)
        .toBe(mood(wrapper, 'Okay').element)

      await mood(wrapper, 'Okay')
        .trigger('keydown', { key: 'ArrowDown' })
      expect(document.activeElement)
        .toBe(mood(wrapper, 'Neutral').element)
      expect(checked(wrapper)).toEqual(['Happy'])
    })

    it.each(['Enter', ' '])(
      'selects the focused Mood with %j',
      async key => {
        const wrapper = mountPicker()

        await mood(wrapper, 'Anxious')
          .trigger('keydown', { key })

        expect(checked(wrapper)).toEqual(['Anxious'])
      }
    )

    it('keeps the arrows from the window', async () => {
      const onKey = vi.fn()
      window.addEventListener('keydown', onKey)
      const wrapper = mountPicker()

      await mood(wrapper, 'Happy')
        .trigger('keydown', { key: 'ArrowLeft' })
      window.removeEventListener('keydown', onKey)

      expect(onKey).not.toHaveBeenCalled()
    })
  })
})
