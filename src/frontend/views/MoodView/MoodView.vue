<script setup lang="ts">
// The Mood Page. Year in Mood fills the wide cell,
// the Overview sits in the side cell, and the Mood
// Widget sits in the bottom-left cell, By Weekday in
// the middle one and What moves your mood in the
// right one.
import MoodByWeekdayWidget
  from '@/components/MoodByWeekdayWidget/MoodByWeekdayWidget.vue'
import MoodOverviewWidget
  from '@/components/MoodOverviewWidget/MoodOverviewWidget.vue'
import MoodWidget
  from '@/components/MoodWidget/MoodWidget.vue'
import PageGrid from '@/components/PageGrid/PageGrid.vue'
import WhatMovesWidget
  from '@/components/WhatMovesWidget/WhatMovesWidget.vue'
import YearInMoodWidget
  from '@/components/YearInMoodWidget/YearInMoodWidget.vue'
</script>

<template>
  <PageGrid>
    <template #wide>
      <YearInMoodWidget />
    </template>
    <template #side>
      <MoodOverviewWidget />
    </template>
    <template #left>
      <MoodWidget />
    </template>
    <template #middle>
      <MoodByWeekdayWidget />
    </template>
    <template #right>
      <WhatMovesWidget />
    </template>
  </PageGrid>
</template>
