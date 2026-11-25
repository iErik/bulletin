<script setup lang="ts">
// The Habits Page. Habit Overview sits in the top-right
// side cell, the existing Habits Widget sits in the
// bottom-left cell, and By Weekday sits in the
// bottom-middle cell. Habit Board and Habit effects fill
// the remaining cells later.
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
    <template #side>
      <HabitOverviewWidget />
    </template>
    <template #left>
      <HabitsWidget />
    </template>
    <template #middle>
      <HabitsByWeekdayWidget />
    </template>
  </PageGrid>
</template>
