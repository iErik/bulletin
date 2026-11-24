<script setup lang="ts">
// The Sleep Page. The Timeline fills the wide cell,
// without the bottom fade. Overview, Schedule, Quality
// and Sleep & Mood fill the other cells later.
import PageGrid from '@/components/PageGrid/PageGrid.vue'
import SleepWidget
  from '@/components/SleepWidget/SleepWidget.vue'
</script>

<template>
  <PageGrid>
    <template #wide>
      <SleepWidget :fade="false" />
    </template>
  </PageGrid>
</template>
