<script setup lang="ts">
// The Weight Tracker's Widget: its chart covers the 11
// months centred on the Selected Date's month, and
// reloads when that month changes.
import { computed, ref, shallowRef, watch } from 'vue'
import { format } from 'date-fns'
import type { WeightEntry } from '@shared/weight'
import Widget from '@/components/Widget.vue'
import WeightChart from '@/components/WeightChart.vue'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { chartWindow, loadRange } from '@/weight/chart'

const store = useSelectedDateStore()

const entries = shallowRef<readonly WeightEntry[]>([])
const failed = ref(false)

const month = computed(() => format(store.day, 'yyyy-MM'))

const load = async (): Promise<void> => {
  const loading = month.value
  const result = await window.bulletin.weight.list(
    loadRange(chartWindow(store.day))
  )
  // A newer month's load has taken over.
  if (loading !== month.value) return
  failed.value = !result.ok
  entries.value = result.ok ? result.value : []
}

watch(month, load, { immediate: true })
</script>

<template>
  <Widget class="weight-widget" title="Weight">
    <WeightChart
      :day="store.day"
      :entries="entries"
      :failed="failed"
    />
  </Widget>
</template>
