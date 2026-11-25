<script setup lang="ts">
// The Expenses Page. Month Pace fills the wide cell and
// the Expenses Widget sits in the side cell; By Category,
// Recurring and Insights fill the bottom row's left,
// middle and right cells.
import ExpensesByCategoryWidget
  from '@/components/ExpensesByCategoryWidget/ExpensesByCategoryWidget.vue'
import ExpensesInsightsWidget
  from '@/components/ExpensesInsightsWidget/ExpensesInsightsWidget.vue'
import ExpensesWidget
  from '@/components/ExpensesWidget/ExpensesWidget.vue'
import MonthPaceWidget
  from '@/components/MonthPaceWidget/MonthPaceWidget.vue'
import PageGrid from '@/components/PageGrid/PageGrid.vue'
import RecurringWidget
  from '@/components/RecurringWidget/RecurringWidget.vue'
</script>

<template>
  <PageGrid>
    <template #wide>
      <MonthPaceWidget />
    </template>
    <template #side>
      <ExpensesWidget />
    </template>
    <template #left>
      <ExpensesByCategoryWidget />
    </template>
    <template #middle>
      <RecurringWidget />
    </template>
    <template #right>
      <ExpensesInsightsWidget />
    </template>
  </PageGrid>
</template>
