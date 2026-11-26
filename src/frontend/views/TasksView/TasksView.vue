<script setup lang="ts">
// The Tasks Page. Insights fills #right; the other cells
// wait for This Week (#wide), Today (#side), Recurring
// (#left) and Reminders (#middle).
import PageGrid from '@/components/PageGrid/PageGrid.vue'
import TaskInsightsWidget
  from '@/components/TaskInsightsWidget/TaskInsightsWidget.vue'
</script>

<template>
  <PageGrid>
    <template #right>
      <TaskInsightsWidget />
    </template>
  </PageGrid>
</template>
