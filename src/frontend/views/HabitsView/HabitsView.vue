<script setup lang="ts">
// The Habits Page. Habit Board sits in the top-left
// wide cell, Habit Overview in the top-right side cell,
// the existing Habits Widget in the bottom-left cell,
// By Weekday in the bottom-middle cell, and Habit
// effects in the bottom-right cell.
import HabitBoardWidget
  from '@/components/HabitBoardWidget/HabitBoardWidget.vue'
import HabitEffectsWidget
  from '@/components/HabitEffectsWidget/HabitEffectsWidget.vue'
import HabitOverviewWidget
  from '@/components/HabitOverviewWidget/HabitOverviewWidget.vue'
import HabitsByWeekdayWidget
  from '@/components/HabitsByWeekdayWidget/HabitsByWeekdayWidget.vue'
import HabitsWidget
  from '@/components/HabitsWidget/HabitsWidget.vue'
import PageGrid from '@/components/PageGrid/PageGrid.vue'
</script>

<template>
  <PageGrid>
    <template #wide>
      <HabitBoardWidget />
    </template>
    <template #side>
      <HabitOverviewWidget />
    </template>
    <template #left>
      <HabitsWidget />
    </template>
    <template #middle>
      <HabitsByWeekdayWidget />
    </template>
    <template #right>
      <HabitEffectsWidget />
    </template>
  </PageGrid>
</template>
