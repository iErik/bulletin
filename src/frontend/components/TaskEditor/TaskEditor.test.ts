import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import { nextTick } from 'vue'
import type { Task } from '@shared/tasks'
import type { TaskEditorStore } from '@/tasks/task-store'
import { stubBulletin } from '@/testing/bulletin'
import { useFixedToday } from '@/testing/clock'
import TaskEditor from './TaskEditor.vue'

// Today is 2026-11-09 (Monday); tomorrow is 2026-11-10.
const TASK: Task = {
  id: 5, title: 'Dentist', day: '2026-11-10',
  time: '10:00', reminder: null, doneAt: null,
  created: 100, moves: 0
}

const makeAnchor = (rect: Partial<DOMRect> = {}): HTMLElement => {
  const el = document.createElement('button')
  document.body.append(el)
  el.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 100, right: 200, top: 80, bottom: 114,
    width: 100, height: 34, x: 100, y: 80,
    toJSON: () => ({}), ...rect
  })
  return el
}

const dialog = (): HTMLElement =>
  document.body.querySelector<HTMLElement>('.task-editor')!
const btn = (text: string): HTMLButtonElement =>
  Array.from(dialog().querySelectorAll('button'))
    .find(b => b.textContent?.trim() === text)!
const byLabel = (label: string): HTMLButtonElement =>
  dialog().querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`
  )!
const type = async (sel: string, val: string): Promise<void> => {
  const el = dialog().querySelector<HTMLInputElement>(sel)!
  el.value = val
  el.dispatchEvent(new Event('input'))
  await nextTick()
}
const press = (target: Element, key: string): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', {
    key, bubbles: true
  }))
}
const mountEditor = (
  props: Partial<InstanceType<typeof TaskEditor>['$props']> = {}
): VueWrapper => mount(TaskEditor, {
  attachTo: document.body,
  props: {
    ...props,
    anchor: props.anchor === undefined ? makeAnchor() : props.anchor
  }
})

describe('TaskEditor', () => {
  useFixedToday()
  enableAutoUnmount(afterEach)
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('creates a Task with trimmed title, day and time', async () => {
    const { tasks } = stubBulletin()
    const wrapper = mountEditor()

    expect(dialog().textContent).toContain('New task')
    expect(byLabel('Save task').disabled).toBe(true)
    expect(dialog().textContent).not.toContain('Delete')
    expect(document.activeElement).toBe(
      dialog().querySelector('input[aria-label="Task title"]')
    )

    await type('input[aria-label="Task title"]', '  Gym  ')
    btn('Tomorrow').click()
    await nextTick()
    await type('input[placeholder="any time"]', '14:30')
    byLabel('Save task').click()
    await flushPromises()

    expect(tasks.create).toHaveBeenCalledWith({
      title: 'Gym', day: '2026-11-10', time: '14:30'
    })
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('edits on Enter, clears time and closes if unchanged',
    async () => {
      const { tasks } = stubBulletin()
      const unchanged = mountEditor({ task: TASK })
      byLabel('Save task').click()
      await flushPromises()
      expect(tasks.update).not.toHaveBeenCalled()
      expect(unchanged.emitted('close')).toHaveLength(1)
      unchanged.unmount()

      const edited = mountEditor({ task: TASK })
      await type('input[aria-label="Task title"]', 'Doctor')
      byLabel('Clear time').click()
      await nextTick()
      press(
        dialog().querySelector('input[aria-label="Task title"]')!,
        'Enter'
      )
      await flushPromises()
      expect(tasks.update).toHaveBeenCalledWith({
        id: 5, title: 'Doctor', time: null
      })
      expect(edited.emitted('saved')).toHaveLength(1)
    })

  it('validates time, toggles done and hides Someday', async () => {
    const { tasks } = stubBulletin()
    mountEditor({ task: TASK, someday: false })

    expect(dialog().textContent).not.toContain('Someday')
    await type('input[placeholder="any time"]', '99:00')
    byLabel('Save task').click()
    await nextTick()
    expect(dialog().querySelector('[role="alert"]')?.textContent)
      .toContain('Enter a time like')
    expect(tasks.update).not.toHaveBeenCalled()

    await type('input[placeholder="any time"]', '10:00')
    const box = dialog().querySelector<HTMLInputElement>(
      'input[type="checkbox"]'
    )!
    box.checked = true
    box.dispatchEvent(new Event('change'))
    await nextTick()
    byLabel('Save task').click()
    await flushPromises()
    expect(tasks.update).not.toHaveBeenCalled()
    expect(tasks.setDone).toHaveBeenCalledWith({ id: 5, done: true })
  })

  it('confirms delete, Escape cancels and surfaces errors',
    async () => {
      const { tasks } = stubBulletin()
      vi.mocked(tasks.delete).mockResolvedValueOnce({
        ok: false, error: { code: 'internal' }
      })
      const wrapper = mountEditor({ task: TASK })

      btn('Delete').click()
      await nextTick()
      expect(dialog().textContent).toContain('Delete?')
      expect(document.activeElement).toBe(btn('Cancel'))

      press(dialog(), 'Escape')
      await nextTick()
      expect(dialog().textContent).not.toContain('Delete?')
      expect(wrapper.emitted('close')).toBeUndefined()

      btn('Delete').click()
      await nextTick()
      btn('Delete').click()
      await flushPromises()
      expect(dialog().querySelector('[role="alert"]')?.textContent)
        .toContain('Couldn’t delete')

      btn('Delete').click()
      await flushPromises()
      expect(tasks.delete).toHaveBeenCalledWith(5)
      expect(wrapper.emitted('deleted')).toHaveLength(1)
    })

  it('uses custom store, places beside anchor and backdrop closes',
    async () => {
      const store: TaskEditorStore = {
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({
          ok: true, value: { ...TASK, title: 'Custom' }
        }),
        setDone: vi.fn(),
        remove: vi.fn().mockResolvedValue({ ok: true, value: null })
      }
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(600)
      vi.spyOn(Element.prototype, 'getBoundingClientRect')
        .mockReturnValue({
          left: 0, right: 316, top: 0, bottom: 260,
          width: 316, height: 260, x: 0, y: 0, toJSON: () => ({})
        })
      const anchor = makeAnchor({ left: 420, right: 580 })
      const wrapper = mountEditor({ task: TASK, anchor, store })
      await nextTick()

      // Flipped left of anchor: 420 - 8 - 316 = 96px.
      expect(dialog().style.left).toBe('96px')
      await type('input[aria-label="Task title"]', 'Custom')
      byLabel('Save task').click()
      await flushPromises()
      expect(store.update).toHaveBeenCalledWith({ title: 'Custom' })

      document.body.querySelector('.task-editor-backdrop')!
        .dispatchEvent(new Event('pointerdown'))
      expect(wrapper.emitted('close')).toHaveLength(1)
    })
})
