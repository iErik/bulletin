import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defineComponent,
  h,
  ref,
  shallowRef,
  type Ref
} from 'vue'
import {
  flushPromises,
  mount,
  type VueWrapper
} from '@vue/test-utils'
import type { StorageResult } from '@shared/storage'
import {
  useRowDeleteConfirm,
  type RowDeleteConfirm
} from './use-row-delete-confirm'

interface Row { readonly id: number }

const ROWS: Row[] = [{ id: 1 }, { id: 2 }, { id: 3 }]

let wrapper: VueWrapper | undefined

interface Setup {
  confirm: RowDeleteConfirm<Row>
  rows: Ref<Row[]>
  remove: ReturnType<typeof vi.fn>
  deleted: ReturnType<typeof vi.fn>
  refocus: ReturnType<typeof vi.fn>
}

/**
 * A list of rows, each a `data-id` item with a button,
 * and ✓ in the asking one. Deleting drops the row.
 */
const setup = (
  result: StorageResult<unknown> = { ok: true, value: null },
  busy?: Ref<boolean>
): Setup => {
  const rows = shallowRef<Row[]>([...ROWS])
  const remove = vi.fn(() => Promise.resolve(result))
  const deleted = vi.fn((row: Row) => {
    rows.value = rows.value
      .filter(({ id }) => id !== row.id)
  })
  const refocus = vi.fn()
  let confirm!: RowDeleteConfirm<Row>
  const List = defineComponent(() => {
    const root = ref<HTMLElement | null>(null)
    confirm = useRowDeleteConfirm({
      rows: () => rows.value,
      find: selector =>
        root.value?.querySelector(selector) ?? null,
      remove,
      deleted,
      failure: 'Failed.',
      refocus,
      busy
    })
    return () => h(
      'ul',
      { ref: root, onKeydown: confirm.onKeydown },
      rows.value.map(row => h('li', { 'data-id': row.id }, [
        h('button', { class: 'choose' }),
        confirm.asking.value === row.id
          ? h('div', { class: 'controls' }, [
              h('button', {
                class: '-confirm',
                disabled: confirm.busy.value
              })
            ])
          : null
      ]))
    )
  })
  wrapper = mount(List, { attachTo: document.body })
  return { confirm, rows, remove, deleted, refocus }
}

const confirmButton = (): Element | null =>
  document.querySelector('.-confirm')

describe('useRowDeleteConfirm', () => {
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('asks about one row, focusing ✓', async () => {
    const { confirm } = setup()

    await confirm.ask(1)
    await confirm.ask(2)

    expect(confirm.asking.value).toBe(2)
    expect(document.querySelectorAll('.-confirm'))
      .toHaveLength(1)
    expect(document.activeElement).toBe(confirmButton())
  })

  it('deletes, focusing the row that took its place',
    async () => {
      const { confirm, remove, deleted, refocus } = setup()

      await confirm.ask(2)
      await confirm.confirm(ROWS[1])

      expect(remove).toHaveBeenCalledWith(ROWS[1])
      expect(deleted).toHaveBeenCalledWith(ROWS[1])
      expect(confirm.asking.value).toBeNull()
      expect(refocus).toHaveBeenCalledWith(ROWS[2])
    })

  it('focuses nothing in particular after the last row',
    async () => {
      const { confirm, rows, refocus } = setup()
      rows.value = [ROWS[0]]

      await confirm.ask(1)
      await confirm.confirm(ROWS[0])

      expect(refocus).toHaveBeenCalledWith(undefined)
    })

  it('treats a row already gone as deleted', async () => {
    const { confirm, deleted } = setup(
      { ok: false, error: { code: 'not-found' } }
    )

    await confirm.ask(1)
    await confirm.confirm(ROWS[0])

    expect(deleted).toHaveBeenCalledWith(ROWS[0])
    expect(confirm.error.value).toBeNull()
  })

  it('keeps asking, refocusing ✓, if it fails',
    async () => {
      const { confirm, deleted } = setup(
        { ok: false, error: { code: 'internal' } }
      )

      await confirm.ask(1)
      // As when disabling ✓ drops focus.
      ;(document.activeElement as HTMLElement).blur()
      await confirm.confirm(ROWS[0])

      expect(deleted).not.toHaveBeenCalled()
      expect(confirm.asking.value).toBe(1)
      expect(confirm.error.value).toBe('Failed.')
      expect(document.activeElement).toBe(confirmButton())
    })

  it('cancels on Escape, refocusing the row', async () => {
    const { confirm, refocus } = setup()

    await confirm.ask(2)
    confirmButton()!.dispatchEvent(new KeyboardEvent(
      'keydown', { key: 'Escape', bubbles: true }
    ))
    await flushPromises()

    expect(confirm.asking.value).toBeNull()
    expect(refocus).toHaveBeenCalledWith(ROWS[1])
  })

  it.each(['pointerdown', 'focusin'])(
    'cancels on %s outside the row, not in it',
    async name => {
      const { confirm, refocus } = setup()

      await confirm.ask(1)
      confirmButton()!.dispatchEvent(
        new Event(name, { bubbles: true }))
      await flushPromises()
      expect(confirm.asking.value).toBe(1)

      document.querySelector('[data-id="2"] > button')!
        .dispatchEvent(new Event(name, { bubbles: true }))
      await flushPromises()
      expect(confirm.asking.value).toBeNull()
      expect(refocus).not.toHaveBeenCalled()
    }
  )

  it('stops asking when a reload drops the row',
    async () => {
      const { confirm, rows } = setup(
        { ok: false, error: { code: 'internal' } }
      )

      await confirm.ask(1)
      await confirm.confirm(ROWS[0])
      rows.value = ROWS.slice(1)
      await flushPromises()

      expect(confirm.asking.value).toBeNull()
      expect(confirm.error.value).toBeNull()
    })

  it('holds still while busy', async () => {
    const busy = ref(true)
    const { confirm } = setup(undefined, busy)

    await confirm.ask(1)
    expect(confirm.asking.value).toBeNull()

    busy.value = false
    await confirm.ask(1)
    busy.value = true
    await confirm.cancel(true)
    expect(confirm.asking.value).toBe(1)
  })

  it('stops listening once unmounted', async () => {
    const remove = vi.spyOn(
      document, 'removeEventListener')
    const { confirm } = setup()

    await confirm.ask(1)
    wrapper!.unmount()
    wrapper = undefined

    for (const name of ['pointerdown', 'focusin']) {
      expect(remove).toHaveBeenCalledWith(
        name, expect.any(Function))
    }
    document.body.dispatchEvent(
      new Event('pointerdown', { bubbles: true }))
    expect(confirm.asking.value).toBe(1)
  })
})
