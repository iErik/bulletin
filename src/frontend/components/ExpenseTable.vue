<script setup lang="ts">
// The Expenses Widget's table of the month's
// Transactions, oldest first: #, description, Category
// chip, short date and value, coloured by its sign.
// The header stays put while the rows scroll, and cut
// off text shows in full on hover or focus.
import { computed } from 'vue'
import { parseISO } from 'date-fns'
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

const rows = computed(() => orderRows(props.transactions))

const names = computed(() => new Map(
  props.categories.map(({ id, name }) => [id, name])
))
</script>

<template>
  <div class="expense-table">
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
          >
            <td class="index">
              {{ i + 1 }}
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
          </tr>
        </tbody>
      </table>
    </div>
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

  td.index { padding-left: rem(12px); }

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
}
</style>
