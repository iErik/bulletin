/**
 * Storage seam and save flow for `TaskEditor`: wraps
 * one-off Tasks by default, and lets BLT-168 plug in
 * an Occurrence store without touching save or delete.
 */
import type { LocalDate, StorageResult }
  from '@shared/storage'
import type {
  LocalTime,
  NewTask,
  Task,
  TaskChanges
} from '@shared/tasks'

/** Fields `TaskEditor` reads and edits. */
export interface EditableTask {
  readonly title: string
  readonly day: LocalDate | null
  readonly time: LocalTime | null
  readonly doneAt: number | null
}

/** Editable field diff passed to `store.update`. */
export type TaskEditorChanges = Omit<TaskChanges, 'id'>

/** Storage operations `TaskEditor` relies on. */
export interface TaskEditorStore<
  T extends EditableTask = Task
> {
  create(task: NewTask): Promise<StorageResult<T>>
  update(
    changes: TaskEditorChanges
  ): Promise<StorageResult<T>>
  setDone(done: boolean): Promise<StorageResult<T>>
  remove(): Promise<StorageResult<null>>
}

/** Validated editor values ready to write. */
export interface TaskDraft {
  readonly title: string
  readonly day: LocalDate | null
  readonly time: LocalTime | null
  readonly done: boolean
}

/** Outcome of `saveTask`, carrying any new baseline. */
export type SaveTaskResult<T extends EditableTask> =
  | {
    readonly ok: true
    readonly changed: boolean
    readonly value: T
  }
  | {
    readonly ok: false
    readonly baseline: T | undefined
    readonly message: string
  }

const NOT_FOUND: StorageResult<never> = {
  ok: false,
  error: { code: 'not-found' }
}

/**
 * Default store for a one-off Task over
 * `window.bulletin.tasks`. Remembers the created id so
 * a follow-up `setDone` or retry targets that Task.
 */
export const taskStore = (
  task?: Pick<Task, 'id'>
): TaskEditorStore<Task> => {
  let id = task?.id
  return {
    async create(value) {
      const result =
        await window.bulletin.tasks.create(value)
      if (result.ok) id = result.value.id
      return result
    },
    async update(changes) {
      if (id === undefined) return NOT_FOUND
      return window.bulletin.tasks.update({
        id, ...changes
      })
    },
    async setDone(done) {
      if (id === undefined) return NOT_FOUND
      return window.bulletin.tasks.setDone({ id, done })
    },
    async remove() {
      if (id === undefined) return NOT_FOUND
      return window.bulletin.tasks.delete(id)
    }
  }
}

const fieldDiff = (
  current: EditableTask,
  draft: TaskDraft
): TaskEditorChanges => {
  const diff: {
    title?: string
    day?: LocalDate | null
    time?: LocalTime | null
  } = {}
  if (draft.title !== current.title) diff.title = draft.title
  if (draft.day !== current.day) diff.day = draft.day
  if (draft.time !== current.time) diff.time = draft.time
  return diff
}

/**
 * Persists `draft` against `baseline`: creates or
 * updates only changed fields, then updates `done` if
 * needed. On a partial failure, returns the updated
 * `baseline` so a retry only retries `setDone`.
 */
export const saveTask = async <T extends EditableTask>(
  store: TaskEditorStore<T>,
  baseline: T | undefined,
  draft: TaskDraft
): Promise<SaveTaskResult<T>> => {
  let current = baseline
  let changed = false
  if (!current) {
    const created = await store.create({
      title: draft.title, day: draft.day, time: draft.time
    })
    if (!created.ok) {
      return {
        ok: false,
        baseline: current,
        message: 'Couldn’t save the task. Try again.'
      }
    }
    current = created.value
    changed = true
  } else {
    const diff = fieldDiff(current, draft)
    if (Object.keys(diff).length > 0) {
      const updated = await store.update(diff)
      if (!updated.ok) {
        return {
          ok: false,
          baseline: current,
          message: 'Couldn’t save the task. Try again.'
        }
      }
      current = updated.value
      changed = true
    }
  }
  if (draft.done !== (current.doneAt !== null)) {
    const toggled = await store.setDone(draft.done)
    if (!toggled.ok) {
      return {
        ok: false,
        baseline: current,
        message: changed
          ? 'Saved changes, but couldn’t update done.'
          : 'Couldn’t update done. Try again.'
      }
    }
    current = toggled.value
    changed = true
  }
  return { ok: true, changed, value: current }
}
