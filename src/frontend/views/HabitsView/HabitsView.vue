<script setup lang="ts">
// The Habits Page. Habit Overview sits in the top-right
// side cell and the existing Habits Widget sits in the
// bottom-left cell, unchanged. Habit Board, By Weekday
// and Habit effects fill the other cells later.
import HabitOverviewWidget
  from '@/components/HabitOverviewWidget/HabitOverviewWidget.vue'
import HabitsWidget
  from '@/components/HabitsWidget/HabitsWidget.vue'
import PageGrid from '@/components/PageGrid/PageGrid.vue'
</script>

<template>
  <PageGrid>
    <template #side>
      <HabitOverviewWidget />
    </template>
    <template #left>
      <HabitsWidget />
    </template>
  </PageGrid>
</template>
