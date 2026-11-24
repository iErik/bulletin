<script setup lang="ts">
// Sleep Page: Timeline in #wide, Schedule in #left,
// Overview in #side, Sleep & Mood in #right.
// Timeline edits bump revision for the widgets.
import { ref } from 'vue'
import PageGrid from '@/components/PageGrid/PageGrid.vue'
import SleepMoodWidget
  from '@/components/SleepMoodWidget/SleepMoodWidget.vue'
import SleepOverviewWidget
  from '@/components/SleepOverviewWidget/SleepOverviewWidget.vue'
import SleepScheduleWidget from
  '@/components/SleepScheduleWidget/SleepScheduleWidget.vue'
import SleepWidget
  from '@/components/SleepWidget/SleepWidget.vue'

const revision = ref(0)
</script>

<template>
  <PageGrid>
    <template #wide>
      <SleepWidget
        :fade="false"
        @change="revision += 1"
      />
    </template>
    <template #left>
      <SleepScheduleWidget :revision="revision" />
    </template>
    <template #side>
      <SleepOverviewWidget :revision="revision" />
    </template>
    <template #right>
      <SleepMoodWidget :revision="revision" />
    </template>
  </PageGrid>
</template>
