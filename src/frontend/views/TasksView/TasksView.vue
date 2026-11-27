<script setup lang="ts">
// The Tasks Page. This Week fills #wide, Reminders
// fills #middle and Insights fills #right; the other
// cells wait for Today (#side) and Recurring (#left).
import PageGrid from '@/components/PageGrid/PageGrid.vue'
import RemindersWidget
  from '@/components/RemindersWidget/RemindersWidget.vue'
import TaskInsightsWidget
  from '@/components/TaskInsightsWidget/TaskInsightsWidget.vue'
import ThisWeekWidget
  from '@/components/ThisWeekWidget/ThisWeekWidget.vue'
</script>

<template>
  <PageGrid>
    <template #wide>
      <ThisWeekWidget />
    </template>
    <template #middle>
      <RemindersWidget />
    </template>
    <template #right>
      <TaskInsightsWidget />
    </template>
  </PageGrid>
</template>
