<script setup lang="ts">
// The Weight Tracker's Widget: its chart covers the 11
// months centred on the Selected Date's month, and
// reloads when that month changes. "+" swaps the chart
// for the add form, and the chart reloads after a save.
import {
  computed,
  nextTick,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import { format } from 'date-fns'
import type { WeightEntry } from '@shared/weight'
import Widget from '@/components/Widget.vue'
import Icon from '@/components/Icon.vue'
import WeightChart from '@/components/WeightChart.vue'
import WeightForm from '@/components/WeightForm.vue'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { chartWindow, loadRange } from '@/weight/chart'

const store = useSelectedDateStore()

const entries = shallowRef<readonly WeightEntry[]>([])
const failed = ref(false)

const month = computed(() => format(store.day, 'yyyy-MM'))

const load = async (): Promise<void> => {
  const requestedMonth = month.value
  const result = await window.bulletin.weight.list(
    loadRange(chartWindow(store.day))
  )
  // A newer month's load has taken over.
  if (requestedMonth !== month.value) return
  failed.value = !result.ok
  entries.value = result.ok ? result.value : []
}

watch(month, load, { immediate: true })

const adding = ref(false)
const add = useTemplateRef<HTMLButtonElement>('add')

const close = async (): Promise<void> => {
  adding.value = false
  // "+" is back once Vue has rendered.
  await nextTick()
  add.value?.focus()
}

const onSaved = (): void => {
  void load()
  void close()
}
</script>

<template>
  <WeightForm
    v-if="adding"
    class="weight-widget"
    :day="store.day"
    :today="store.today"
    @saved="onSaved"
    @close="close"
  />
  <Widget v-else class="weight-widget" title="Weight">
    <template #actions>
      <button
        ref="add"
        class="action"
        type="button"
        aria-label="Add weight"
        @click="adding = true"
      >
        <Icon name="plus" />
      </button>
    </template>
    <WeightChart
      :day="store.day"
      :entries="entries"
      :failed="failed"
    />
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.weight-widget .action {
  display: grid;
  place-items: center;
  width: rem(28px);
  height: rem(28px);
  font-size: rem(13px);
  color: var(--color-text-muted);
  background: color-mix(
    in sRGB,
    var(--color-text) 8%,
    transparent
  );
  border-radius: rem(6px);
  @include colour-transition;
  @include focus-ring;

  &:disabled {
    cursor: default;
    opacity: 0.4;
  }
}
</style>
