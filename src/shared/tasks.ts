import type {
  DateRange,
  LocalDate,
  StorageResult
} from './storage'

/** A local time of day, as `HH:MM` (24-hour). */
export type LocalTime = string

/** A one-off Task. */
export interface Task {
  readonly id: number
  /** Trimmed, not empty. */
  readonly title: string
  /** Planned day, or `null` for Someday. */
  readonly day: LocalDate | null
  /** Optional; independent of Someday. */
  readonly time: LocalTime | null
  /** Epoch ms when marked done, or `null`. */
  readonly doneAt: number | null
  /** Epoch ms when created. */
  readonly created: number
  /** Later-day moves; Someday does not count. */
  readonly moves: number
}

/** A Task to create. */
export interface NewTask {
  readonly title: string
  readonly day: LocalDate | null
  readonly time: LocalTime | null
}

/** Changes to a Task's title, day, time, or any mix. */
export interface TaskChanges {
  readonly id: number
  readonly title?: string
  readonly day?: LocalDate | null
  readonly time?: LocalTime | null
}

/** Mark a Task done or not. */
export interface TaskDone {
  readonly id: number
  readonly done: boolean
}

/**
 * 1 when both sides are days and `to` is later; else 0.
 * Pure so Occurrences can reuse it.
 */
export const moveIncrement = (
  from: LocalDate | null,
  to: LocalDate | null
): 0 | 1 => {
  if (from === null || to === null) return 0
  return to > from ? 1 : 0
}

/** `window.bulletin.tasks`. */
export interface TasksApi {
  /** Range's Tasks: by day, timed time, then id. */
  list(range: DateRange): Promise<StorageResult<Task[]>>
  /** Someday Tasks, oldest first. */
  listSomeday(): Promise<StorageResult<Task[]>>
  /** Creates a Task; `created` is now, not done. */
  create(task: NewTask): Promise<StorageResult<Task>>
  /** Changes fields; a later day raises `moves`. */
  update(changes: TaskChanges): Promise<
    StorageResult<Task>
  >
  /** Sets or clears `doneAt`; redone keeps the first. */
  setDone(change: TaskDone): Promise<StorageResult<Task>>
  /** Deletes a Task by its `id`. */
  delete(id: number): Promise<StorageResult<null>>
}

/** IPC channel per `TasksApi` method. */
export const TASKS_CHANNELS = {
  list: 'tasks:list',
  listSomeday: 'tasks:list-someday',
  create: 'tasks:create',
  update: 'tasks:update',
  setDone: 'tasks:set-done',
  delete: 'tasks:delete'
} as const satisfies Record<keyof TasksApi, string>
