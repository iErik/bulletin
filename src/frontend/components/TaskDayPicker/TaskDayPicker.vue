<script setup lang="ts">
// Task editor DAY section (Figma 4139:7884): Today,
// Tomorrow, optional Someday, and a Date chip that
// opens the recessed DatePicker for any other date.
import { computed, ref, useId } from 'vue'
import { localDate } from '@shared/dates'
import type { LocalDate } from '@shared/storage'
import DatePicker
  from '@/components/DatePicker/DatePicker.vue'
import Icon from '@/components/Icon/Icon.vue'
import { formatDate } from '@/locale/format'
import {
  choiceOf,
  dateOf,
  dayOf,
  type QuickChoice
} from '@/tasks/day-choice'

const props = withDefaults(defineProps<{
  /** The real date, used for Today and Tomorrow. */
  today: Date
  /** Show the Someday choice (`false` for Occurrences). */
  someday?: boolean
}>(), { someday: true })

const model = defineModel<LocalDate | null>({
  required: true
})

const emit = defineEmits<{
  /** Fired when DatePicker opens or closes. */
  layout: []
}>()

const labelId = useId()
const todayDay = computed(() => localDate(props.today))
const choice = computed(() =>
  choiceOf(model.value, props.today)
)
const dateOpen = ref(choice.value === 'date')

const quickChoices = computed((): QuickChoice[] =>
  props.someday
    ? ['today', 'tomorrow', 'someday']
    : ['today', 'tomorrow']
)

const LABELS: Record<QuickChoice, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  someday: 'Someday'
}

const dateModel = computed(() =>
  dateOf(model.value ?? todayDay.value)
)

const customDate = computed(() =>
  choice.value === 'date' && model.value
    ? formatDate(dateOf(model.value), 'weekdayDay')
    : null
)

const pickQuick = (next: QuickChoice): void => {
  model.value = dayOf(next, props.today)
  if (dateOpen.value) {
    dateOpen.value = false
    emit('layout')
  }
}

const toggleDate = (): void => {
  if (model.value === null) model.value = todayDay.value
  dateOpen.value = !dateOpen.value
  emit('layout')
}
</script>

<template>
  <div
    class="task-day-picker"
    role="group"
    :aria-labelledby="labelId"
  >
    <span :id="labelId" class="label">Day</span>
    <div class="choices">
      <button
        v-for="item in quickChoices"
        :key="item"
        class="chip"
        :class="{ '-active': choice === item }"
        type="button"
        :aria-pressed="choice === item"
        @click="pickQuick(item)"
      >
        {{ LABELS[item] }}
      </button>
      <button
        class="chip -date"
        :class="{
          '-active': choice === 'date',
          '-named': customDate !== null
        }"
        type="button"
        :aria-label="customDate
          ? `Date: ${customDate}`
          : 'Pick a date'"
        :aria-expanded="dateOpen"
        @click="toggleDate"
      >
        <template v-if="customDate">
          {{ customDate }}
        </template>
        <Icon v-else name="calendar" />
      </button>
    </div>
    <DatePicker
      v-if="dateOpen"
      :model-value="dateModel"
      @update:model-value="model = localDate($event)"
    />
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma 4139:7884 Day chips + recessed Date Field.
.task-day-picker {
  display: flex;
  flex-direction: column;
  gap: rem(6px);

  > .label {
    font-size: rem(10px);
    font-weight: 700;
    line-height: normal;
    text-transform: uppercase;
    color: color-mix(
      in sRGB, var(--color-tile-icon) 50%, transparent
    );
  }

  > .choices {
    display: flex;
    gap: rem(6px);
  }

  .chip {
    display: inline-flex;
    flex: 1 0 0;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: rem(26px);
    padding: 0 rem(6px);
    font-family: inherit;
    font-size: rem(10px);
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
    color: color-mix(
      in sRGB, var(--color-tile-icon) 80%, transparent
    );
    background: color-mix(
      in sRGB, var(--color-tasks-accent) 5%, transparent
    );
    border-radius: rem(6px);
    @include focus-ring;

    &.-date {
      flex: 0 0 auto;
      min-width: rem(30px);
    }

    &.-named {
      font-family: $font-family-mono;
      font-weight: 500;
      text-transform: none;
    }

    &.-active {
      color: var(--color-tasks-on-accent);
      background: color-mix(
        in sRGB, var(--color-tasks-accent) 85%, transparent
      );
      box-shadow: 0 0 rem(6px) 0 color-mix(
        in sRGB, var(--color-tasks-accent) 35%, transparent
      );
    }
  }

  > .date-picker {
    align-self: flex-start;
    max-width: 100%;
    gap: rem(2px);
    padding: rem(2px);
    background: var(--color-surface-raised);
    border-radius: $radius-large;

    > .field {
      height: rem(36px);
      padding: 0 rem(10px);
      font-size: rem(13px);
      font-weight: 500;
      letter-spacing: 0.08em;
      color: var(--color-stat-value);
      background: var(--color-tasks-field);
      border: 0;
      border-radius: 0;

      &:first-child { border-radius: rem(10px) 0 0 rem(10px); }
      &:last-child { border-radius: 0 rem(10px) rem(10px) 0; }
    }
  }
}
</style>
