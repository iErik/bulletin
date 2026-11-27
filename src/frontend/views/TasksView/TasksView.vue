<script setup lang="ts">
// The Tasks Page. Insights fills #right, Reminders
// fills #middle; the other cells wait for This Week
// (#wide), Today (#side) and Recurring (#left).
import PageGrid from '@/components/PageGrid/PageGrid.vue'
import RemindersWidget
  from '@/components/RemindersWidget/RemindersWidget.vue'
import TaskInsightsWidget
  from '@/components/TaskInsightsWidget/TaskInsightsWidget.vue'
</script>

<template>
  <PageGrid>
    <template #middle>
      <RemindersWidget />
    </template>
    <template #right>
      <TaskInsightsWidget />
    </template>
  </PageGrid>
</template>
