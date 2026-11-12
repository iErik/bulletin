<script setup lang="ts">
// The Expenses Widget: the Selected Date's month, with
// its Income, Expenses and Budget cards. It reloads
// when the month changes; a load a newer one overtook
// is dropped, and a failed load shows inline.
import { computed, ref, shallowRef, watch } from 'vue'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import type { Budget, Transaction } from '@shared/expenses'
import { localDate } from '@shared/dates'
import ExpenseCards from '@/components/ExpenseCards.vue'
import Widget from '@/components/Widget.vue'
import { useSelectedDateStore }
  from '@/stores/selected-date'

const store = useSelectedDateStore()

/** The first of the Selected Date's month. */
const month = computed(() => startOfMonth(store.day))

const transactions =
  shallowRef<readonly Transaction[]>([])
const budget = shallowRef<Budget | null>(null)
/** The month shown; null till loaded. */
const loaded = shallowRef<Date | null>(null)
const failed = ref(false)

// Bumped by each load, so a load it overtook is dropped.
let generation = 0

const load = async (from: Date): Promise<void> => {
  const asked = ++generation
  const { expenses } = window.bulletin
  const [listed, got] = await Promise.all([
    expenses.list({
      from: localDate(from),
      to: localDate(endOfMonth(from))
    }),
    expenses.getBudget(format(from, 'yyyy-MM'))
  ])
  if (asked !== generation) return
  failed.value = !listed.ok || !got.ok
  if (!listed.ok || !got.ok) return
  transactions.value = listed.value
  budget.value = got.value
  loaded.value = from
}

watch(
  () => month.value.getTime(),
  () => void load(month.value),
  { immediate: true }
)
</script>

<template>
  <Widget class="expenses-widget" title="Expenses">
    <p v-if="failed" class="message" role="alert">
      Couldn’t load this month.
    </p>
    <ExpenseCards
      v-else-if="loaded"
      :transactions="transactions"
      :budget="budget"
      :month="loaded"
    />
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.expenses-widget .message {
  font-size: rem(11px);
  color: var(--color-text-muted);
}
</style>
