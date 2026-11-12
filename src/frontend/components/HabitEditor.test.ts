import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper }
  from '@vue/test-utils'
import type { BulletinApi } from '@shared/bridge'
import type { Habit } from '@shared/habits'
import { stubBulletin } from '@/testing/bulletin'
import HabitEditor from './HabitEditor.vue'

let editor: VueWrapper | undefined

const READING: Habit = {
  id: 4,
  name: 'Reading',
  icon: 'reading',
  created: '2026-01-01',
  archived: false
}

const mountEditor = (): {
  wrapper: VueWrapper
  api: BulletinApi
} => {
  const api = stubBulletin()
  editor = mount(HabitEditor, {
    attachTo: document.body,
    props: { habit: READING }
  })
  return { wrapper: editor, api }
}

const submit = async (
  wrapper: VueWrapper,
  name: string
): Promise<void> => {
  await wrapper.get('input').setValue(name)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

const takenBy = (habit: 'active' | 'archived') => ({
  ok: false,
  error: { code: 'name-taken', habit }
} as const)

describe('HabitEditor', () => {
  afterEach(() => {
    editor?.unmount()
    editor = undefined
  })

  it('rejects an empty name', async () => {
    const { wrapper, api } = mountEditor()

    await submit(wrapper, '   ')

    expect(wrapper.get('[role="alert"]').text())
      .toBe('Give the habit a name.')
    expect(api.habits.update).not.toHaveBeenCalled()
  })

  it('edits a trimmed name and the icon', async () => {
    const { wrapper, api } = mountEditor()

    expect(wrapper.get('input').element.value)
      .toBe('Reading')
    expect(document.activeElement)
      .toBe(wrapper.get('input').element)
    await wrapper.get('.toggle').trigger('click')
    await wrapper.get('[aria-label="water"]')
      .trigger('click')
    await submit(wrapper, '  Books ')

    expect(api.habits.update).toHaveBeenCalledWith({
      id: 4,
      name: 'Books',
      icon: 'water'
    })
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it.each([
    ['active', 'Another habit uses this name.'],
    ['archived', 'An archived habit uses this name. '
      + 'Create it to restore it.']
  ] as const)('rejects an %s Habit’s name',
    async (habit, message) => {
      const { wrapper, api } = mountEditor()
      vi.mocked(api.habits.update)
        .mockResolvedValue(takenBy(habit))

      await submit(wrapper, 'running')

      expect(wrapper.get('[role="alert"]').text())
        .toBe(message)
      expect(wrapper.emitted('saved')).toBeUndefined()
      expect(wrapper.get('input').element.value)
        .toBe('running')
    })

  it('cancels on Escape', async () => {
    const { wrapper, api } = mountEditor()

    await wrapper.get('input')
      .trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(api.habits.update).not.toHaveBeenCalled()
  })
})
