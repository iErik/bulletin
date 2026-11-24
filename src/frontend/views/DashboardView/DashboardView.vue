<script setup lang="ts">
// The Dashboard Page: one Widget per Tracker, in the
// shared Page grid. The date header goes in the Title
// Bar through that grid.
import { defineAsyncComponent } from 'vue'
import ExpensesWidget
  from '@/components/ExpensesWidget/ExpensesWidget.vue'
import HabitsWidget
  from '@/components/HabitsWidget/HabitsWidget.vue'
import MoodWidget
  from '@/components/MoodWidget/MoodWidget.vue'
import PageGrid from '@/components/PageGrid/PageGrid.vue'
import SleepWidget
  from '@/components/SleepWidget/SleepWidget.vue'
import WeightWidget
  from '@/components/WeightWidget/WeightWidget.vue'

// Loaded lazily so production builds drop it entirely.
const DevThemeToggle = import.meta.env.DEV
  ? defineAsyncComponent(
      () => import(
        '@/components/DevThemeToggle/DevThemeToggle.vue'
      )
    )
  : null
</script>

<template>
  <PageGrid>
    <template #wide>
      <SleepWidget />
    </template>
    <template #side>
      <ExpensesWidget />
    </template>
    <template #left>
      <MoodWidget />
    </template>
    <template #middle>
      <HabitsWidget />
    </template>
    <template #right>
      <WeightWidget />
    </template>
    <DevThemeToggle v-if="DevThemeToggle" class="dev" />
  </PageGrid>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Floats over the grid, outside the layout.
.page-grid > .dev {
  position: fixed;
  bottom: space(2);
  left: 50%;
  z-index: 1;
  transform: translateX(-50%);
}
</style>
