<script setup lang="ts">
// The Habits Page. The existing Habits Widget sits in
// the bottom-left cell, unchanged. Habit Board,
// Overview, By Weekday and Habit effects fill the
// other cells later.
import HabitsWidget
  from '@/components/HabitsWidget/HabitsWidget.vue'
import PageGrid from '@/components/PageGrid/PageGrid.vue'
</script>

<template>
  <PageGrid>
    <template #left>
      <HabitsWidget />
    </template>
  </PageGrid>
</template>
