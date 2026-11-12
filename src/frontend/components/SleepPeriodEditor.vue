<script setup lang="ts">
// The Sleep Timeline's tooltip for one Period: its
// start and end as time fields on the Locale's clock,
// any minute, and a trash button that asks "Delete?"
// first. Without a Period it's "Add period" on `day`,
// with empty fields. Enter, or `commit()` when the
// Timeline is clicked away from, emits `save` with
// valid times; invalid or rule-breaking ones show an
// inline error instead. Escape cancels "Delete?", then
// closes. It sits above its point, or below when
// there's no room.
import {
  nextTick,
  onMounted,
  ref,
  useTemplateRef
} from 'vue'
import type {
  NewSleepPeriod,
  SleepPeriod
} from '@shared/sleep'
import Icon from '@/components/Icon.vue'
import { formatTime } from '@/locale/format'
import { endFrom, parseClock, startIn } from '@/sleep/clock'
import { breaks, reason } from '@/sleep/selection'

const props = defineProps<{
  /** The Period edited; none to add one. */
  period?: SleepPeriod
  /** The row whose window the start is typed in. */
  day: Date
  /** The loaded Periods, for the rules. */
  periods: readonly SleepPeriod[]
}>()

const emit = defineEmits<{
  save: [period: NewSleepPeriod]
  remove: []
  close: []
}>()

const text = (time?: number): string =>
  time === undefined ? '' : formatTime(new Date(time))

const start = ref(text(props.period?.start))
const end = ref(text(props.period?.end))
const error = ref<string | null>(null)
const confirming = ref(false)
const below = ref(false)
const example = formatTime(new Date(2000, 0, 1, 2, 15))

/** The fields' Period, or why they don't make one. */
const fromFields = (): NewSleepPeriod | string => {
  const from = parseClock(start.value)
  const to = parseClock(end.value)
  if (!from || !to) return `Enter times like ${example}`
  const begin = startIn(props.day, from)
  const period = { start: begin, end: endFrom(begin, to) }
  const others = props.periods
    .filter(p => p.id !== props.period?.id)
  const rule = breaks(period, others, Date.now())
  return rule ? reason(rule) : period
}

/** Saves valid times; false, with an error, if not. */
const commit = (): boolean => {
  const { period } = props
  if (!period && !start.value.trim() && !end.value.trim()) {
    emit('close')
    return true
  }
  const result = fromFields()
  if (typeof result === 'string') {
    error.value = `${result}.`
    return false
  }
  if (period?.start === result.start
    && period.end === result.end) emit('close')
  else emit('save', result)
  return true
}

defineExpose({ commit })

const root = useTemplateRef<HTMLElement>('root')
const first = useTemplateRef<HTMLInputElement>('first')
const trash = useTemplateRef<HTMLButtonElement>('trash')
const no = useTemplateRef<HTMLButtonElement>('no')
const confirm = useTemplateRef<HTMLElement>('confirm')

const ask = async (): Promise<void> => {
  confirming.value = true
  await nextTick()
  no.value?.focus()
}

const keep = async (): Promise<void> => {
  confirming.value = false
  await nextTick()
  trash.value?.focus()
}

// Focus leaving ✓ and × cancels "Delete?".
const onFocusout = (event: FocusEvent): void => {
  const to = event.relatedTarget as Node | null
  if (confirming.value && !confirm.value?.contains(to))
    confirming.value = false
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    if (confirming.value) void keep()
    else emit('close')
  } else if (event.key === 'Enter') {
    // A focused button handles Enter itself.
    if (event.target instanceof HTMLButtonElement) return
    commit()
  } else return
  event.preventDefault()
  // Keeps the row and the Timeline out of it.
  event.stopPropagation()
}

onMounted(() => {
  const box = root.value?.getBoundingClientRect()
  const list = root.value?.closest('.rows')
    ?.getBoundingClientRect()
  below.value = !!box && !!list && box.top < list.top
  first.value?.focus()
  first.value?.select()
})
</script>

<template>
  <div
    ref="root"
    class="sleep-period-editor"
    :class="{ '-below': below }"
    role="dialog"
    :aria-label="period ? 'Edit period' : 'Add period'"
    @keydown="onKeydown"
    @focusout="onFocusout"
    @pointerleave="confirming = false"
  >
    <span v-if="!period" class="part -title">
      Add period
    </span>
    <input
      ref="first"
      v-model="start"
      class="part -time"
      type="text"
      aria-label="Start"
      autocomplete="off"
      :placeholder="example"
      :aria-invalid="!!error"
      @input="error = null"
    >
    <input
      v-model="end"
      class="part -time"
      type="text"
      aria-label="End"
      autocomplete="off"
      :placeholder="example"
      :aria-invalid="!!error"
      @input="error = null"
    >
    <span v-if="confirming" ref="confirm" class="part">
      Delete?
      <button
        class="action"
        type="button"
        aria-label="Delete period"
        @click="emit('remove')"
      >
        <Icon name="check" />
      </button>
      <button
        ref="no"
        class="action"
        type="button"
        aria-label="Keep period"
        @click="keep"
      >
        <Icon name="close" />
      </button>
    </span>
    <span v-else-if="period" class="part">
      <button
        ref="trash"
        class="action"
        type="button"
        aria-label="Delete"
        @click="ask"
      >
        <Icon name="trash" />
      </button>
    </span>
    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma's "2:15 · 11:05 · 🗑": a pill of parts split
// by thin lines, raised over the Widget.
.sleep-period-editor {
  position: absolute;
  bottom: space(3);
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  font-size: rem(12px);
  white-space: nowrap;
  cursor: auto;
  background: color-mix(
    in sRGB,
    var(--color-text) 10%,
    var(--color-surface-raised)
  );
  border-radius: $radius-small;
  box-shadow: 0 rem(2px) rem(8px) rgb(0 0 0 / 30%);
  transform: translateX(-50%);

  &.-below {
    top: space(3);
    bottom: auto;
  }

  > .part {
    display: inline-flex;
    align-items: center;
    gap: space(1);
    padding: space(1) space(2);
    color: var(--color-text);
  }

  > .part.-title {
    color: var(--color-text-muted);
  }

  > .part.-time {
    width: rem(64px);
    font: inherit;
    text-align: center;
    background: transparent;
    border: 0;
    outline: none;

    &:focus-visible {
      background: var(--color-surface);
    }
  }

  // After the fields' reset, so they get it too.
  > .part + .part {
    border-left: 1px solid var(--color-border);
  }

  > .part > .action {
    display: inline-flex;
    padding: space(1);
    color: inherit;
    cursor: pointer;
    background: none;
    border: 0;
    @include focus-ring;
  }

  > .error {
    flex-basis: 100%;
    padding: 0 space(2) space(1);
    color: var(--color-danger);
  }
}
</style>
