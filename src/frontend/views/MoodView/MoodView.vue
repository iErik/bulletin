<script setup lang="ts">
// The Mood Page. Year in Mood fills the wide cell,
// the Overview sits in the side cell, and the Mood
// Widget sits in the bottom-left cell and What moves
// your mood in the right one. By Weekday fills the
// middle cell later.
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
    <template #right>
      <WhatMovesWidget />
    </template>
  </PageGrid>
</template>
