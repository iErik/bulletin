<script setup lang="ts">
// The Dashboard Page: one Widget per Tracker, in the
// Figma grid. Each Widget is placed by its class, so a
// Tracker's real Widget replaces its placeholder here
// without touching the grid. Its date header goes in
// the Title Bar.
import { defineAsyncComponent } from 'vue'
import DateHeader
  from '@/components/DateHeader/DateHeader.vue'
import ExpensesWidget
  from '@/components/ExpensesWidget/ExpensesWidget.vue'
import HabitsWidget
  from '@/components/HabitsWidget/HabitsWidget.vue'
import MoodWidget
  from '@/components/MoodWidget/MoodWidget.vue'
import SleepTimeline
  from '@/components/SleepTimeline/SleepTimeline.vue'
import Widget from '@/components/Widget/Widget.vue'
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
  <Teleport defer to="#title-bar-content">
    <DateHeader />
  </Teleport>
  <main class="dashboard-view">
    <Widget class="sleep" title="Sleep" icon="moon">
      <SleepTimeline />
    </Widget>
    <ExpensesWidget class="expenses" />
    <MoodWidget class="mood" />
    <HabitsWidget class="habits" />
    <WeightWidget class="weight" />
    <DevThemeToggle v-if="DevThemeToggle" class="dev" />
  </main>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma's Sleep frame sits closer to its edges, with
// its rows 9px below the header.
.widget-frame.sleep {
  --widget-inset: #{rem(7px)};
  --widget-gap: #{rem(9px)};
}

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
