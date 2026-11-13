<script setup lang="ts">
// The Expenses Widget's table of the month's
// Transactions, oldest first: #, description, Category
// chip, short date and value, coloured by its sign.
// The header stays put while the rows scroll, and cut
// off text shows in full on hover or focus. Hovering
// or focusing a row turns its # into "−", which asks
// "Delete?"; ✓ deletes the Transaction through storage
// and emits `deleted`, while ×, Escape, a click or
// focus elsewhere cancels. One row asks at a time. A
// Transaction storage no longer has counts as deleted.
// The description, value and date edit in place and
// save through storage, emitting `updated`; the edit
// shows while it saves, and a storage error reverts it
// and shows inline. Clicking a Category chip picks
// another, or creates one, emitting `category-created`,
// and saves it the same way. "+ Add new entry", always
// last, adds a draft row on the Selected Date, saved
// through storage and emitted as `created` once it has
// a description and a Category. Escape, or focus
// leaving it with no description, discards it.
import {
  computed,
  nextTick,
  ref,
  shallowRef,
  useTemplateRef
} from 'vue'
import { localDate } from '@shared/dates'
import type {
  Category,
  NewTransaction,
  Transaction
} from '@shared/expenses'
import type { LocalDate } from '@shared/storage'
import CellInput from '@/components/CellInput.vue'
import CategoryCell from '@/components/CategoryCell.vue'
import DateCell from '@/components/DateCell.vue'
import Icon from '@/components/Icon.vue'
import { amountText, parseAmount } from '@/expenses/amount'
import type { CategoryChoice } from '@/expenses/categories'
import { formatAmount } from '@/expenses/money'
import { amountTone, orderRows } from '@/expenses/rows'
import { useRowDeleteConfirm }
  from '@/composables/use-row-delete-confirm'

const props = defineProps<{
  /** The month's Transactions, in any order. */
  transactions: readonly Transaction[]
  categories: readonly Category[]
  /** The latest day a Transaction can have. */
  today: Date
  /** The Selected Date, which a new one starts on. */
  day: Date
}>()

const emit = defineEmits<{
  /** Storage has deleted it. */
  deleted: [transaction: Transaction]
  /** Storage has saved an edit to it. */
  updated: [transaction: Transaction]
  /** Storage has added it. */
  created: [transaction: Transaction]
  /** Storage has it, maybe from before. */
  'category-created': [category: Category]
}>()

/** Edits on their way to storage, by id. */
const saving = shallowRef(new Map<number, Transaction>())

const rows = computed(() => orderRows(
  props.transactions.map(transaction =>
    saving.value.get(transaction.id) ?? transaction)
))

const byId = computed(() => new Map(
  props.categories.map(category => [category.id, category])
))

const checkDescription = (text: string): string | null =>
  text.trim() === '' ? 'Enter a description.' : null

const checkAmount = (text: string): string | null =>
  parseAmount(text) === null
    ? `Enter an amount like ${amountText(-123_456)}.`
    : null

/** Saves `change` to `transaction`, if it changes it. */
const save = async (
  transaction: Transaction,
  change: Partial<NewTransaction>
): Promise<void> => {
  const edited = { ...transaction, ...change }
  const keys = Object.keys(change) as (keyof NewTransaction)[]
  if (keys.every(key => edited[key] === transaction[key]))
    return
  error.value = null
  saving.value = new Map(saving.value)
    .set(edited.id, edited)
  const result = await window.bulletin.expenses
    .update(edited)
  // A later edit to the row keeps showing.
  if (saving.value.get(edited.id) === edited) {
    const left = new Map(saving.value)
    left.delete(edited.id)
    saving.value = left
  }
  if (result.ok) emit('updated', result.value)
  else error.value = 'Couldn’t save the change. Try again.'
}

/** The chosen Category, created if it's new. */
const resolve = async (
  choice: CategoryChoice
): Promise<Category | null> => {
  if (choice.kind === 'pick') return choice.category
  error.value = null
  const created = await window.bulletin.expenses
    .createCategory(choice.name)
  if (!created.ok) {
    error.value = 'Couldn’t create the Category. Try again.'
    return null
  }
  emit('category-created', created.value)
  return created.value
}

/** Gives `transaction` the chosen Category. */
const assign = async (
  transaction: Transaction,
  choice: CategoryChoice
): Promise<void> => {
  const category = await resolve(choice)
  if (category)
    await save(transaction, { categoryId: category.id })
}

/** A Transaction being added, until storage has it. */
interface Draft {
  description: string
  categoryId: number | null
  date: LocalDate
  amount: number
}

const draft = ref<Draft | null>(null)
/** Adding the draft. */
let adding = false

const startDraft = async (): Promise<void> => {
  draft.value ??= {
    description: '',
    categoryId: null,
    date: localDate(props.day),
    amount: 0
  }
  await nextTick()
  find('.draft .description')?.focus()
}

/** Adds the draft once it has a description and a Category. */
const add = async (): Promise<void> => {
  const current = draft.value
  const description = current?.description.trim()
  if (!current || adding || !description
    || current.categoryId === null)
    return
  adding = true
  error.value = null
  const result = await window.bulletin.expenses.create(
    { ...current, description, categoryId: current.categoryId }
  )
  adding = false
  if (!result.ok) {
    error.value = 'Couldn’t add the Transaction. Try again.'
    return
  }
  draft.value = null
  emit('created', result.value)
  await nextTick()
  find(`[data-id="${result.value.id}"] .cell-input > .value`)
    ?.focus()
}

const chooseForDraft = async (
  choice: CategoryChoice
): Promise<void> => {
  const category = await resolve(choice)
  if (!category || !draft.value) return
  draft.value.categoryId = category.id
  await add()
}

const discard = async (): Promise<void> => {
  draft.value = null
  await nextTick()
  find('.add-entry')?.focus()
}

const onDraftKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') void discard()
  else if (event.key === 'Enter'
    && (event.target as Element).matches('.description'))
    void add()
  else return
  event.preventDefault()
  event.stopPropagation()
}

// Focus moving out of the draft with no description
// discards it. Focus going nowhere, as when a popover
// closes on a click outside, doesn't count.
const onDraftFocusout = (event: FocusEvent): void => {
  const next = event.relatedTarget
  if (!(next instanceof Node)
    || find('.draft')?.contains(next))
    return
  if (draft.value?.description.trim() === '')
    draft.value = null
}

const root = useTemplateRef<HTMLElement>('root')

/** The first element in DOM order matching `selector`. */
const find = (selector: string): HTMLElement | null =>
  root.value?.querySelector(selector) ?? null

const error = ref<string | null>(null)

const {
  asking,
  busy,
  ask,
  cancel,
  confirm: remove,
  onKeydown
} = useRowDeleteConfirm({
  rows: () => rows.value,
  find,
  remove: transaction => window.bulletin.expenses
    .delete(transaction.id),
  deleted: transaction => emit('deleted', transaction),
  failure: 'Couldn’t delete the Transaction. Try again.',
  // With no row left, the table holds focus.
  refocus: transaction => (transaction
    ? find(`[data-id="${transaction.id}"] .delete`)
    : find('.table'))?.focus(),
  error
})
</script>

<template>
  <div ref="root" class="expense-table" @keydown="onKeydown">
    <div class="scroller">
      <table class="table" tabindex="-1">
        <thead>
          <tr>
            <th scope="col" aria-label="Number" />
            <th scope="col">
              Desc
            </th>
            <th scope="col">
              Category
            </th>
            <th scope="col">
              Date
            </th>
            <th scope="col">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(transaction, i) in rows"
            :key="transaction.id"
            class="row"
            :data-id="transaction.id"
          >
            <td v-if="asking === transaction.id" colspan="5">
              <div
                class="controls"
                role="group"
                :aria-label="`Delete ${transaction.description}?`"
              >
                <span class="question">Delete?</span>
                <span class="subject">
                  {{ transaction.description }}
                </span>
                <button
                  class="control -confirm"
                  type="button"
                  aria-label="Delete"
                  :disabled="busy"
                  @click="remove(transaction)"
                >
                  <Icon name="check" />
                </button>
                <button
                  class="control"
                  type="button"
                  aria-label="Don’t delete"
                  :disabled="busy"
                  @click="cancel(true)"
                >
                  <Icon name="close" />
                </button>
              </div>
            </td>
            <template v-else>
              <td class="index">
                <span class="number">{{ i + 1 }}</span>
                <button
                  class="delete"
                  type="button"
                  :aria-label="`Delete ${transaction.description}`"
                  @click="ask(transaction.id)"
                >
                  <Icon name="minus" />
                </button>
              </td>
              <td>
                <CellInput
                  :text="transaction.description"
                  :start="transaction.description"
                  label="Description"
                  :check="checkDescription"
                  @commit="save(transaction, {
                    description: $event.trim()
                  })"
                  @invalid="error = $event"
                />
              </td>
              <td>
                <CategoryCell
                  :category="byId.get(transaction.categoryId)
                    ?? null"
                  :categories="categories"
                  @choose="assign(transaction, $event)"
                />
              </td>
              <td class="date">
                <DateCell
                  :date="transaction.date"
                  :max="today"
                  @commit="save(transaction, { date: $event })"
                />
              </td>
              <td
                class="value"
                :class="`-${amountTone(transaction.amount)}`"
              >
                <CellInput
                  :text="formatAmount(transaction.amount)"
                  :start="amountText(transaction.amount)"
                  label="Value"
                  inputmode="decimal"
                  :check="checkAmount"
                  @commit="save(transaction, {
                    amount: parseAmount($event) ?? 0
                  })"
                  @invalid="error = $event"
                />
              </td>
            </template>
          </tr>
          <tr
            v-if="draft"
            class="draft"
            @keydown="onDraftKeydown"
            @focusout="onDraftFocusout"
          >
            <td class="index" />
            <td>
              <input
                v-model="draft.description"
                class="cell-input -field description"
                type="text"
                autocomplete="off"
                aria-label="Description"
                placeholder="Description"
                @blur="add"
              >
            </td>
            <td>
              <CategoryCell
                :category="byId.get(draft.categoryId ?? -1)
                  ?? null"
                :categories="categories"
                @choose="chooseForDraft"
              />
            </td>
            <td class="date">
              <DateCell
                :date="draft.date"
                :max="today"
                @commit="draft.date = $event"
              />
            </td>
            <td
              class="value"
              :class="`-${amountTone(draft.amount)}`"
            >
              <CellInput
                :text="formatAmount(draft.amount)"
                :start="amountText(draft.amount)"
                label="Value"
                inputmode="decimal"
                :check="checkAmount"
                @commit="draft.amount = parseAmount($event) ?? 0"
                @invalid="error = $event"
              />
            </td>
          </tr>
          <tr class="add">
            <td colspan="5">
              <button
                class="add-entry"
                type="button"
                @click="startDraft"
              >
                + Add new entry
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma's Variant9 table: a faint block with a fixed
// header, rows of muted text and values that glow in
// their Income or Expense colour.
.expense-table {
  $tint: color-mix(
    in sRGB,
    var(--color-text) 8%,
    transparent
  );

  // Opaque, so rows pass under the sticky header.
  $block: color-mix(
    in sRGB,
    var(--color-text) 3%,
    var(--color-surface-raised)
  );

  display: flex;
  flex-direction: column;
  min-height: 0;

  > .scroller {
    min-height: 0;
    overflow-y: auto;
    background: $block;
    border-radius: rem(8px);
  }

  .table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    @include focus-ring;

    // Inside, so the scroller doesn't clip it.
    &:focus-visible { outline-offset: -2px; }
  }

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    height: rem(40px);
    font-size: rem(11px);
    font-weight: 600;
    text-align: left;
    text-transform: uppercase;
    color: var(--color-text-muted);
    background: $block;
  }

  th:nth-child(1) { width: 9%; }
  th:nth-child(2) { width: 22%; }
  th:nth-child(3) { width: 29%; }
  th:nth-child(4) { width: 17%; }
  th:nth-child(5) { width: 23%; }

  th:nth-child(n + 4),
  td.date,
  td.value {
    text-align: center;
  }

  td {
    height: rem(40px);
    padding-right: rem(6px);
    overflow: hidden;
    font-size: rem(13px);
    font-weight: 500;
    white-space: nowrap;
    color: var(--color-text-muted);
  }

  .app-tooltip { max-width: 100%; }

  td.index {
    position: relative;
    padding-left: rem(12px);
  }

  .add-entry {
    padding: rem(4px) rem(6px);
    margin-left: rem(6px);
    font: inherit;
    color: var(--color-text-muted);
    border-radius: rem(4px);
    @include focus-ring;

    &:hover { color: var(--color-text); }
  }

  td.index > .delete {
    position: absolute;
    top: 50%;
    left: rem(6px);
    display: grid;
    place-items: center;
    width: rem(22px);
    height: rem(22px);
    border-radius: rem(6px);
    opacity: 0;
    transform: translateY(-50%);
    @include focus-ring;

    &:hover { background: $tint; }
  }

  .row:hover > .index,
  .row:focus-within > .index {
    > .number { visibility: hidden; }
    > .delete { opacity: 1; }
  }

  td.value {
    text-shadow: 0 0 rem(8px) color-mix(
      in sRGB,
      currentColor 50%,
      transparent
    );
  }

  td.value.-income { color: var(--color-income); }
  td.value.-expense { color: var(--color-expense); }

  td.value.-zero {
    color: var(--color-text);
    text-shadow: none;
  }

  .controls {
    display: flex;
    gap: rem(6px);
    align-items: center;
    padding: 0 rem(10px) 0 rem(12px);
  }

  .question {
    font-size: rem(11px);
    font-weight: 700;
    text-transform: uppercase;
  }

  .subject {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .control {
    display: grid;
    place-items: center;
    width: rem(22px);
    height: rem(22px);
    border-radius: rem(6px);
    @include focus-ring;

    &:hover { background: $tint; }

    &:disabled {
      cursor: default;
      opacity: 0.4;
    }
  }

  > .error {
    margin-top: space(1);
    font-size: rem(11px);
    color: var(--color-danger);
  }
}
</style>
