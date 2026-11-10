<script setup lang="ts">
// The Dashboard Page: one Widget per Tracker, in the
// Figma grid. Each Widget is placed by its class, so a
// Tracker's real Widget replaces its placeholder here
// without touching the grid. Its date header goes in
// the Title Bar.
import { defineAsyncComponent } from 'vue'
import DateHeader from '@/components/DateHeader.vue'
import Widget from '@/components/Widget.vue'

// Loaded lazily so production builds drop it entirely.
const DevThemeToggle = import.meta.env.DEV
  ? defineAsyncComponent(
      () => import('@/components/DevThemeToggle.vue')
    )
  : null
</script>

<template>
  <Teleport defer to="#title-bar-content">
    <DateHeader />
  </Teleport>
  <main class="dashboard-view">
    <Widget class="sleep" title="Sleep" />
    <Widget class="expenses" title="Expenses" />
    <Widget class="mood" title="Mood" />
    <Widget class="habits" title="Habits" />
    <Widget class="weight" title="Weight" />
    <DevThemeToggle v-if="DevThemeToggle" class="dev" />
  </main>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Tracks and gaps are the Figma "App Window" frame's,
// in pixels. At the minimum window size the grid
// matches it exactly; above it, columns widen and rows
// grow in proportion.
.dashboard-view {
  display: grid;
  grid-template:
    'sleep sleep expenses' 558fr
    'mood habits weight' 208fr
    / 356fr 356fr 407fr;
  gap: rem(8px);
  height: 100%;
  padding: 0 rem(15px) rem(15px) 0;

  > .sleep { grid-area: sleep; }
  > .expenses { grid-area: expenses; }
  > .mood { grid-area: mood; }
  > .habits { grid-area: habits; }
  > .weight { grid-area: weight; }

  // Floats over the grid, outside the layout.
  > .dev {
    position: fixed;
    bottom: space(2);
    left: 50%;
    z-index: 1;
    transform: translateX(-50%);
  }
}
</style>
