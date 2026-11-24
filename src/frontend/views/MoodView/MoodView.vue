<script setup lang="ts">
// The Mood Page. The existing Mood Widget sits in the
// bottom-left cell and the Overview in the side cell.
// Year in Mood, By Weekday and What moves your mood
// fill the other cells later.
import MoodOverviewWidget
  from '@/components/MoodOverviewWidget/MoodOverviewWidget.vue'
import MoodWidget
  from '@/components/MoodWidget/MoodWidget.vue'
import PageGrid from '@/components/PageGrid/PageGrid.vue'
</script>

<template>
  <PageGrid>
    <template #side>
      <MoodOverviewWidget />
    </template>
    <template #left>
      <MoodWidget />
    </template>
  </PageGrid>
</template>
