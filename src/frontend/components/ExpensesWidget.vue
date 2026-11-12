<script setup lang="ts">
// The Expenses Widget: the Selected Date's month, with
// its Income, Expenses and Budget cards over the table
// of its Transactions. It reloads
// when the month changes; a load a newer one overtook
// is dropped, and a failed load shows inline.
import { computed, ref, shallowRef, watch } from 'vue'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import type {
  Budget,
  Category,
  Transaction
} from '@shared/expenses'
import { localDate } from '@shared/dates'
import ExpenseCards from '@/components/ExpenseCards.vue'
import ExpenseTable from '@/components/ExpenseTable.vue'
import Widget from '@/components/Widget.vue'
import { useSelectedDateStore }
  from '@/stores/selected-date'

const store = useSelectedDateStore()

/** The first of the Selected Date's month. */
const month = computed(() => startOfMonth(store.day))

const transactions =
  shallowRef<readonly Transaction[]>([])
const budget = shallowRef<Budget | null>(null)
const categories = shallowRef<readonly Category[]>([])
/** The month shown; null till loaded. */
const loaded = shallowRef<Date | null>(null)
const failed = ref(false)

// Bumped by each load, so a load it overtook is dropped.
let generation = 0

const load = async (from: Date): Promise<void> => {
  const asked = ++generation
  const { expenses } = window.bulletin
  const [listed, got, named] = await Promise.all([
    expenses.list({
      from: localDate(from),
      to: localDate(endOfMonth(from))
    }),
    expenses.getBudget(format(from, 'yyyy-MM')),
    expenses.listCategories()
  ])
  if (asked !== generation) return
  failed.value = !listed.ok || !got.ok || !named.ok
  if (!listed.ok || !got.ok || !named.ok) return
  categories.value = named.value
  transactions.value = listed.value
  budget.value = got.value
  loaded.value = from
}

/**
 * A saved Budget replaces the shown one, unless the
 * month changed while it was saving.
 */
const onBudgetSaved = (saved: Budget): void => {
  if (loaded.value
    && saved.month === format(loaded.value, 'yyyy-MM'))
    budget.value = saved
}

/**
 * A saved Transaction joins the month or replaces its
 * old self, or leaves if its date isn't in the month.
 */
const onSaved = (saved: Transaction): void => {
  const others = transactions.value
    .filter(({ id }) => id !== saved.id)
  const inMonth = loaded.value !== null
    && saved.date.startsWith(format(loaded.value, 'yyyy-MM'))
  transactions.value = inMonth ? [...others, saved] : others
}

/** A new Category joins the list, once. */
const onCategoryCreated = (category: Category): void => {
  if (categories.value.some(({ id }) => id === category.id))
    return
  categories.value = [...categories.value, category]
}

const onDeleted = ({ id }: Transaction): void => {
  transactions.value = transactions.value
    .filter(transaction => transaction.id !== id)
}

watch(
  () => month.value.getTime(),
  () => void load(month.value),
  { immediate: true }
)
</script>

<template>
  <Widget
    class="expenses-widget"
    title="Expenses"
    icon="dollar-sign"
  >
    <p v-if="failed" class="message" role="alert">
      Couldn’t load this month.
    </p>
    <template v-else-if="loaded">
      <ExpenseCards
        :transactions="transactions"
        :budget="budget"
        :month="loaded"
        @budget-saved="onBudgetSaved"
      />
      <ExpenseTable
        :transactions="transactions"
        :categories="categories"
        :today="store.today"
        :day="store.day"
        @deleted="onDeleted"
        @updated="onSaved"
        @created="onSaved"
        @category-created="onCategoryCreated"
      />
    </template>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma's Expenses frame sits closer to its edges,
// with its cards 25px below the header, and its "$"
// is larger than the other icons.
.widget-frame.expenses-widget {
  --widget-inset: #{rem(7px)};
  --widget-gap: #{rem(25px)};
  --widget-icon-size: #{rem(16px)};
}

.expenses-widget > .body {
  display: flex;
  flex-direction: column;
  gap: rem(6px);
}

.expenses-widget .message {
  font-size: rem(11px);
  color: var(--color-text-muted);
}
</style>
