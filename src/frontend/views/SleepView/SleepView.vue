<script setup lang="ts">
// Sleep Page: Timeline in #wide, Schedule in #left,
// Overview in #side, Sleep & Mood in #right.
import PageGrid from '@/components/PageGrid/PageGrid.vue'
import SleepMoodWidget
  from '@/components/SleepMoodWidget/SleepMoodWidget.vue'
import SleepOverviewWidget
  from '@/components/SleepOverviewWidget/SleepOverviewWidget.vue'
import SleepScheduleWidget from
  '@/components/SleepScheduleWidget/SleepScheduleWidget.vue'
import SleepWidget
  from '@/components/SleepWidget/SleepWidget.vue'
</script>

<template>
  <PageGrid>
    <template #wide>
      <SleepWidget :fade="false" />
    </template>
    <template #left>
      <SleepScheduleWidget />
    </template>
    <template #side>
      <SleepOverviewWidget />
    </template>
    <template #right>
      <SleepMoodWidget />
    </template>
  </PageGrid>
</template>
