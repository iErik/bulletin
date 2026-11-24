<script setup lang="ts">
// Sleep Page: Timeline in #wide, Sleep & Mood in #right.
import { ref } from 'vue'
import PageGrid from '@/components/PageGrid/PageGrid.vue'
import SleepMoodWidget
  from '@/components/SleepMoodWidget/SleepMoodWidget.vue'
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
    <template #right>
      <SleepMoodWidget :revision="revision" />
    </template>
  </PageGrid>
</template>
