<script setup lang="ts">
// The Expenses Page. The existing Expenses Widget sits
// in the side cell, unchanged. Month Pace, By Category,
// Recurring and Insights fill the other cells later.
import ExpensesWidget
  from '@/components/ExpensesWidget/ExpensesWidget.vue'
import PageGrid from '@/components/PageGrid/PageGrid.vue'
</script>

<template>
  <PageGrid>
    <template #side>
      <ExpensesWidget />
    </template>
  </PageGrid>
</template>
