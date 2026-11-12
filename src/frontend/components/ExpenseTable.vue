<script setup lang="ts">
// The Expenses Widget's table of the month's
// Transactions, oldest first: #, description, Category
// chip, short date and value, coloured by its sign.
// The header stays put while the rows scroll, and cut
// off text shows in full on hover or focus. Hovering
// or focusing a row turns its # into "−", which asks
// "Delete?"; ✓ deletes the Transaction through storage
// and emits `deleted`, while ×, Escape, a click or
// focus elsewhere cancels. One row asks at a time.
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import { parseISO } from 'date-fns'
import { Check, Minus, X } from '@lucide/vue'
import type {
  Category,
  Transaction
} from '@shared/expenses'
import Tooltip from '@/components/Tooltip.vue'
import { formatAmount } from '@/expenses/money'
import { amountTone, orderRows } from '@/expenses/rows'
import { formatDate } from '@/locale/format'

const props = defineProps<{
  /** The month's Transactions, in any order. */
  transactions: readonly Transaction[]
  categories: readonly Category[]
}>()

const emit = defineEmits<{
  /** Storage has deleted it. */
  deleted: [transaction: Transaction]
}>()

const rows = computed(() => orderRows(props.transactions))

const names = computed(() => new Map(
  props.categories.map(({ id, name }) => [id, name])
))

const root = useTemplateRef<HTMLElement>('root')

/** The first element in DOM order matching `selector`. */
const find = (selector: string): HTMLElement | null =>
  root.value?.querySelector(selector) ?? null

/** The id of the row asking "Delete?", if any. */
const asking = ref<number | null>(null)
/** Deleting. */
const busy = ref(false)
const error = ref<string | null>(null)

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

const cancel = async (refocus: boolean): Promise<void> => {
  if (busy.value || asking.value === null) return
  const id = asking.value
  asking.value = null
  error.value = null
  if (!refocus) return
  await nextTick()
  find(`[data-id="${id}"] .delete`)?.focus()
}

const remove = async (
  transaction: Transaction
): Promise<void> => {
  if (busy.value) return
  const index = rows.value.indexOf(transaction)
  busy.value = true
  const result = await window.bulletin.expenses
    .delete(transaction.id)
  busy.value = false
  if (!result.ok) {
    error.value =
      'Couldn’t delete the Transaction. Try again.'
    // Disabling ✓ dropped focus; give it back to retry.
    await nextTick()
    if (document.activeElement === document.body)
      focusConfirm()
    return
  }
  asking.value = null
  error.value = null
  emit('deleted', transaction)
  await nextTick()
  const next = Math.min(index, rows.value.length - 1)
  find(`.row:nth-child(${next + 1}) .delete`)?.focus()
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

const EVENTS = ['pointerdown', 'focusin'] as const

watch(() => asking.value !== null, on => {
  const method = on
    ? 'addEventListener'
    : 'removeEventListener'
  for (const name of EVENTS)
    document[method](name, onOutside)
})

// A reload without the asking row stops it asking.
watch(rows, now => {
  if (!now.some(({ id }) => id === asking.value))
    asking.value = null
})

onBeforeUnmount(() => {
  for (const name of EVENTS)
    document.removeEventListener(name, onOutside)
})
</script>

<template>
  <div ref="root" class="expense-table" @keydown="onKeydown">
    <div class="scroller">
      <table class="table">
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
                  <Check class="icon" aria-hidden="true" />
                </button>
                <button
                  class="control"
                  type="button"
                  aria-label="Don’t delete"
                  :disabled="busy"
                  @click="cancel(true)"
                >
                  <X class="icon" aria-hidden="true" />
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
                  <Minus class="icon" aria-hidden="true" />
                </button>
              </td>
              <td>
                <Tooltip
                  :text="transaction.description"
                  placement="above"
                  truncated-only
                >
                  <span class="text" tabindex="0">
                    {{ transaction.description }}
                  </span>
                </Tooltip>
              </td>
              <td>
                <Tooltip
                  :text="names.get(transaction.categoryId) ?? ''"
                  placement="above"
                  truncated-only
                >
                  <span class="chip" tabindex="0">
                    {{ names.get(transaction.categoryId) }}
                  </span>
                </Tooltip>
              </td>
              <td class="date">
                <time :datetime="transaction.date">
                  {{
                    formatDate(
                      parseISO(transaction.date),
                      'short'
                    )
                  }}
                </time>
              </td>
              <td
                class="value"
                :class="`-${amountTone(transaction.amount)}`"
              >
                {{ formatAmount(transaction.amount) }}
              </td>
            </template>
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

  .text,
  .chip {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    border-radius: rem(4px);
    @include focus-ring;
  }

  .chip {
    max-width: rem(95px);
    padding: rem(6px) rem(11px);
    font-size: rem(10px);
    font-weight: 700;
    text-transform: uppercase;
    background: $tint;
    border-radius: rem(12px);
  }

  td.index {
    position: relative;
    padding-left: rem(12px);
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

  .icon {
    width: rem(16px);
    height: rem(16px);
  }

  > .error {
    margin-top: space(1);
    font-size: rem(11px);
    color: var(--color-text);
  }
}
</style>
