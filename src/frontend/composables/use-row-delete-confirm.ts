/**
 * A list's inline "Delete?" confirm: one row at a time
 * asks, with ✓ deleting it through storage and ×,
 * Escape, a click or focus outside the row cancelling.
 * Asking focuses ✓; a failed delete keeps asking, shows
 * an error and gives focus back to ✓. A row storage no
 * longer has counts as deleted, and a reload without
 * the asking row stops it asking.
 *
 * The list marks each row with `data-id` and ✓ as
 * `.controls > .-confirm`, and binds `onKeydown` on its
 * root.
 */
import {
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type Ref
} from 'vue'
import type { StorageResult } from '@shared/storage'

export interface RowDeleteConfirmOptions<Row> {
  /** The rows, in order. */
  rows: () => readonly Row[]
  /** The first element in the list matching `selector`. */
  find: (selector: string) => HTMLElement | null
  /** Deletes `row` through storage. */
  remove: (row: Row) => Promise<StorageResult<unknown>>
  /** Storage has deleted `row`. */
  deleted: (row: Row) => void
  /** The error to show when deleting fails. */
  failure: string
  /**
   * Focuses `row` after cancelling or deleting; with no
   * row left, `undefined`.
   */
  refocus: (row: Row | undefined) => void
  /** The asking row's id, if the list keeps it. */
  asking?: Ref<number | null>
  /** Busy, if the list shares it with other writes. */
  busy?: Ref<boolean>
  /** The error, if the list shows others too. */
  error?: Ref<string | null>
}

export interface RowDeleteConfirm<Row> {
  /** The id of the row asking "Delete?", if any. */
  readonly asking: Ref<number | null>
  /** Deleting. */
  readonly busy: Ref<boolean>
  readonly error: Ref<string | null>
  /** Asks about `id`, focusing ✓. */
  readonly ask: (id: number) => Promise<void>
  /** Stops asking, focusing the row if `refocus`. */
  readonly cancel: (refocus: boolean) => Promise<void>
  /** Deletes `row`, the asking one. */
  readonly confirm: (row: Row) => Promise<void>
  /** Escape cancels. */
  readonly onKeydown: (event: KeyboardEvent) => void
}

const EVENTS = ['pointerdown', 'focusin'] as const

export const useRowDeleteConfirm = <
  Row extends { readonly id: number }
>(
  options: RowDeleteConfirmOptions<Row>
): RowDeleteConfirm<Row> => {
  const { rows, find, refocus } = options
  const asking = options.asking ?? ref<number | null>(null)
  const busy = options.busy ?? ref(false)
  const error = options.error ?? ref<string | null>(null)

  const focusConfirm = (): void => {
    find('.controls > .-confirm')?.focus()
  }

  const ask = async (id: number): Promise<void> => {
    if (busy.value) return
    asking.value = id
    error.value = null
    await nextTick()
    focusConfirm()
  }

  const cancel = async (again: boolean): Promise<void> => {
    if (busy.value || asking.value === null) return
    const id = asking.value
    asking.value = null
    error.value = null
    if (!again) return
    await nextTick()
    refocus(rows().find(row => row.id === id))
  }

  const confirm = async (row: Row): Promise<void> => {
    if (busy.value) return
    const index = rows()
      .findIndex(({ id }) => id === row.id)
    busy.value = true
    const result = await options.remove(row)
    busy.value = false
    // Already gone, e.g. deleted by another window:
    // retrying can't help, so treat it as deleted.
    if (!result.ok && result.error.code !== 'not-found') {
      error.value = options.failure
      // Disabling ✓ dropped focus; give it back to retry.
      await nextTick()
      if (document.activeElement === document.body)
        focusConfirm()
      return
    }
    asking.value = null
    error.value = null
    options.deleted(row)
    await nextTick()
    const now = rows()
    refocus(now[Math.min(index, now.length - 1)])
  }

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || asking.value === null)
      return
    event.preventDefault()
    event.stopPropagation()
    void cancel(true)
  }

  // A click or focus outside the asking row cancels.
  const onOutside = (event: Event): void => {
    const row = find(`[data-id="${asking.value}"]`)
    if (row && event.composedPath().includes(row)) return
    void cancel(false)
  }

  watch(() => asking.value !== null, on => {
    const method = on
      ? 'addEventListener'
      : 'removeEventListener'
    for (const name of EVENTS)
      document[method](name, onOutside)
  })

  // A reload without the asking row stops it asking,
  // dropping any error about it.
  watch(rows, now => {
    if (asking.value === null
      || now.some(({ id }) => id === asking.value))
      return
    asking.value = null
    error.value = null
  })

  onBeforeUnmount(() => {
    for (const name of EVENTS)
      document.removeEventListener(name, onOutside)
  })

  return {
    asking, busy, error, ask, cancel, confirm, onKeydown
  }
}
