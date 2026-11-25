import { describe, expect, it, vi } from 'vitest'
import type { Task } from '@shared/tasks'
import { stubBulletin } from '@/testing/bulletin'
import {
  saveTask,
  taskStore,
  type TaskEditorStore
} from './task-store'

const TASK: Task = {
  id: 5,
  title: 'Dentist',
  day: '2026-11-10',
  time: '10:00',
  doneAt: null,
  created: 100,
  moves: 0,
  reminder: null
}

describe('taskStore', () => {
  it('creates a Task and remembers its id', async () => {
    const { tasks } = stubBulletin()
    vi.mocked(tasks.create).mockResolvedValueOnce({
      ok: true, value: { ...TASK, id: 7 }
    })
    const store = taskStore()

    const created = await store.create({
      title: 'Dentist', day: '2026-11-10', time: '10:00'
    })
    expect(created.ok).toBe(true)

    await store.setDone(true)
    expect(tasks.setDone).toHaveBeenCalledWith({
      id: 7, done: true
    })
  })

  it('forwards update, setDone and remove for a Task',
    async () => {
      const { tasks } = stubBulletin()
      const store = taskStore({ id: 4 })

      await store.update({ title: 'Book flight' })
      await store.setDone(false)
      await store.remove()

      expect(tasks.update).toHaveBeenCalledWith({
        id: 4, title: 'Book flight'
      })
      expect(tasks.setDone).toHaveBeenCalledWith({
        id: 4, done: false
      })
      expect(tasks.delete).toHaveBeenCalledWith(4)
    })

  it('returns not-found without a Task id', async () => {
    const { tasks } = stubBulletin()
    const store = taskStore()

    expect(await store.update({ title: 'X' })).toEqual({
      ok: false, error: { code: 'not-found' }
    })
    expect(await store.setDone(true)).toEqual({
      ok: false, error: { code: 'not-found' }
    })
    expect(await store.remove()).toEqual({
      ok: false, error: { code: 'not-found' }
    })
    expect(tasks.update).not.toHaveBeenCalled()
    expect(tasks.setDone).not.toHaveBeenCalled()
    expect(tasks.delete).not.toHaveBeenCalled()
  })
})

describe('saveTask', () => {
  const makeStore = (
    overrides: Partial<TaskEditorStore<Task>> = {}
  ): TaskEditorStore<Task> => ({
    create: vi.fn<TaskEditorStore<Task>['create']>(
      async value => ({
        ok: true, value: { ...TASK, ...value, doneAt: null }
      })
    ),
    update: vi.fn<TaskEditorStore<Task>['update']>(
      async changes => ({
        ok: true, value: { ...TASK, ...changes }
      })
    ),
    setDone: vi.fn<TaskEditorStore<Task>['setDone']>(
      async done => ({
        ok: true,
        value: { ...TASK, doneAt: done ? 200 : null }
      })
    ),
    remove: vi.fn<TaskEditorStore<Task>['remove']>(
      async () => ({ ok: true, value: null })
    ),
    ...overrides
  })

  it('creates an undone Task without calling setDone',
    async () => {
      const store = makeStore()
      const res = await saveTask(store, undefined, {
        title: 'Gym', day: '2026-11-10', time: null, done: false
      })

      expect(res.ok).toBe(true)
      expect(store.create).toHaveBeenCalledWith({
        title: 'Gym', day: '2026-11-10', time: null
      })
      expect(store.setDone).not.toHaveBeenCalled()
    })

  it('creates a done Task with create then setDone',
    async () => {
      const store = makeStore()
      const res = await saveTask(store, undefined, {
        title: 'Read', day: null, time: null, done: true
      })

      expect(res.ok && res.changed).toBe(true)
      expect(store.create).toHaveBeenCalledOnce()
      expect(store.setDone).toHaveBeenCalledWith(true)
    })

  it('skips storage when editing with no changes',
    async () => {
      const store = makeStore()
      const res = await saveTask(store, TASK, {
        title: TASK.title,
        day: TASK.day,
        time: TASK.time,
        done: false
      })

      expect(res).toEqual({
        ok: true, changed: false, value: TASK
      })
      expect(store.update).not.toHaveBeenCalled()
      expect(store.setDone).not.toHaveBeenCalled()
    })

  it('sends only changed fields on update', async () => {
    const store = makeStore()
    await saveTask(store, TASK, {
      title: 'Doctor', day: TASK.day, time: null, done: false
    })

    expect(store.update).toHaveBeenCalledWith({
      title: 'Doctor', time: null
    })
    expect(store.setDone).not.toHaveBeenCalled()
  })

  it('returns the updated baseline when setDone fails',
    async () => {
      const store = makeStore({
        setDone: vi.fn()
          .mockResolvedValueOnce({
            ok: false, error: { code: 'internal' }
          })
          .mockResolvedValueOnce({
            ok: true,
            value: { ...TASK, time: '11:00', doneAt: 200 }
          })
      })
      const draft = {
        title: TASK.title,
        day: TASK.day,
        time: '11:00',
        done: true
      }

      const first = await saveTask(store, TASK, draft)
      expect(first.ok).toBe(false)
      if (first.ok) return
      expect(first.message).toContain('Saved changes')
      expect(first.baseline?.time).toBe('11:00')

      const second = await saveTask(
        store, first.baseline, draft
      )
      expect(second.ok).toBe(true)
      expect(store.update).toHaveBeenCalledOnce()
      expect(store.setDone).toHaveBeenCalledTimes(2)
    })

  it('reports failure when create or update fails',
    async () => {
      const fail = {
        ok: false as const,
        error: { code: 'internal' as const }
      }
      const store = makeStore({
        create: vi.fn().mockResolvedValue(fail),
        update: vi.fn().mockResolvedValue(fail)
      })
      const draft = {
        title: 'X', day: '2026-11-10', time: null, done: false
      }

      const created = await saveTask(store, undefined, draft)
      expect(created.ok).toBe(false)
      const updated = await saveTask(store, TASK, draft)
      expect(updated.ok).toBe(false)
      expect(store.setDone).not.toHaveBeenCalled()
    })
})
