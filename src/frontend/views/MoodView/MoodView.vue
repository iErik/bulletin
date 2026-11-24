<script setup lang="ts">
// The Mood Page. The existing Mood Widget sits in the
// bottom-left cell. Year in Mood, Overview, By Weekday
// and What moves your mood fill the other cells later.
import MoodWidget
  from '@/components/MoodWidget/MoodWidget.vue'
import PageGrid from '@/components/PageGrid/PageGrid.vue'
</script>

<template>
  <PageGrid>
    <template #left>
      <MoodWidget />
    </template>
  </PageGrid>
</template>
