<script setup lang="ts">
// The Expenses Widget's cards: the month's Income, its
// Expenses (absolute, with no minus sign) and its
// Budget. A Budget carried forward from an earlier
// month says which month it was set for. A thin bar
// under the Budget fills with Expenses ÷ Budget, full
// at most, and turns red past it. Without a Budget,
// the card shows a dash and no bar. The Budget is
// edited in place (see `BudgetValue`).
import { computed } from 'vue'
import { format } from 'date-fns'
import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  Wallet
} from '@lucide/vue'
import type { Budget, Transaction } from '@shared/expenses'
import {
  budgetProgress,
  formatAmount,
  totals
} from '@/expenses/money'
import { formatDate } from '@/locale/format'
import BudgetValue from '@/components/BudgetValue.vue'

const props = defineProps<{
  /** The month's Transactions. */
  transactions: readonly Transaction[]
  /** The month's Budget, maybe carried forward. */
  budget: Budget | null
  /** The first of the month shown. */
  month: Date
}>()

const emit = defineEmits<{
  /** The month's own Budget, once saved. */
  'budget-saved': [budget: Budget]
}>()

const sums = computed(() => totals(props.transactions))

const progress = computed(() => props.budget
  && budgetProgress(
    sums.value.expenses,
    props.budget.amount
  ))

/** The bar's fill, as a percentage up to 100. */
const fill = computed(() => Math.round(
  Math.min(progress.value?.ratio ?? 0, 1) * 100
))

/**
 * The month a carried-forward Budget was set for:
 * "August", or "August 2025" in another year.
 */
const carriedFrom = computed(() => {
  const budget = props.budget
  if (!budget
    || budget.month === format(props.month, 'yyyy-MM'))
    return null
  const [year, month] = budget.month.split('-')
    .map(Number)
  const style = year === props.month.getFullYear()
    ? 'month'
    : 'monthYear'
  return formatDate(new Date(year, month - 1), style)
})
</script>

<template>
  <div class="expense-cards">
    <section class="card -income">
      <h3 class="title">
        <BanknoteArrowUp class="icon" aria-hidden="true" />
        Income
      </h3>
      <p class="value">
        {{ formatAmount(sums.income) }}
      </p>
    </section>
    <section class="card -expenses">
      <h3 class="title">
        <BanknoteArrowDown
          class="icon"
          aria-hidden="true"
        />
        Expenses
      </h3>
      <p class="value">
        {{ formatAmount(sums.expenses) }}
      </p>
    </section>
    <section class="card -budget">
      <h3 class="title">
        <Wallet class="icon" aria-hidden="true" />
        Budget
      </h3>
      <BudgetValue
        :budget="budget"
        :month="month"
        @saved="emit('budget-saved', $event)"
      />
      <p v-if="carriedFrom" class="from">
        from {{ carriedFrom }}
      </p>
      <div
        v-if="progress"
        class="bar"
        :class="{ '-over': progress.over }"
        role="progressbar"
        aria-label="Budget spent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="fill"
      >
        <span class="fill" :style="{ width: `${fill}%` }" />
      </div>
    </section>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma's "Totals": three faint cards in a row, each
// with an icon, a title and a monospace value.
.expense-cards {
  display: flex;
  gap: rem(6px);

  > .card {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: rem(3px);
    min-width: 0;
    min-height: rem(67px);
    padding: rem(8px) rem(9px) rem(12px);
    background: color-mix(
      in sRGB,
      var(--color-text) 3%,
      transparent
    );
    border-radius: rem(5px);
  }

  > .card > .title {
    display: flex;
    gap: rem(7px);
    align-items: center;
    margin-bottom: auto;
    font-size: rem(10px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  > .card > .title > .icon {
    flex-shrink: 0;
    width: rem(11px);
    height: rem(11px);
  }

  > .card > .value {
    overflow: hidden;
    font-family: $font-family-mono;
    font-size: rem(11px);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text);
  }

  > .card > .from {
    font-size: rem(9px);
    color: var(--color-text-muted);
  }

  > .card > .bar {
    height: rem(3px);
    margin-top: rem(3px);
    overflow: hidden;
    background: color-mix(
      in sRGB,
      var(--color-text) 10%,
      transparent
    );
    border-radius: rem(2px);
  }

  > .card > .bar > .fill {
    display: block;
    height: 100%;
    background: var(--color-text-muted);
    border-radius: inherit;
  }

  > .card > .bar.-over > .fill {
    background: var(--color-danger);
  }
}
</style>
