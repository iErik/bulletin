<script setup lang="ts">
// The Sleep Widget's body: the Timeline as Figma's
// snake (ADR 0003), oldest day first, with each day's
// date and times by its AM row and the rest of the
// current month dimmed below today. Months load as the
// list nears either edge, and the Selected Date's day
// scrolls to the centre whenever it changes. Scrolling
// never changes the Selected Date.
//
// Creating a Period takes two clicks on empty parts of
// the Timeline: the first sets the Head, then a preview
// follows the pointer, and the second sets the Tail.
// Escape or a click outside the Widget cancels.
//
// Dragging a Period's Head or Tail moves that end,
// snapped and clamped by the rules, and saves it on
// release. A storage error puts it back.
//
// Clicking a Period, or Enter on it, opens its edit
// tooltip; Enter on a day opens "Add period".
// Clicking away saves it, and Escape closes it and
// gives focus back to the Period or row.
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import {
  addDays,
  isAfter,
  isSameDay,
  startOfDay
} from 'date-fns'
import type {
  EpochMs,
  NewSleepPeriod,
  SleepPeriod
} from '@shared/sleep'
import { localDate } from '@shared/dates'
import SleepHours from '@/components/SleepHours.vue'
import SleepPeriodEditor
  from '@/components/SleepPeriodEditor.vue'
import SleepSnake from '@/components/SleepSnake.vue'
import { formatDate, formatTime } from '@/locale/format'
import { caption } from '@/sleep/caption'
import {
  breaks,
  drag,
  ordered,
  periodAt,
  reason,
  snap,
  type End
} from '@/sleep/selection'
import { useSleepMonths } from '@/sleep/use-sleep-months'
import { useSelectedDateStore }
  from '@/stores/selected-date'

const store = useSelectedDateStore()
const months = useSleepMonths(() => store.today)
const scroller = useTemplateRef<HTMLElement>('scroller')
const root = useTemplateRef<HTMLElement>('root')

/** The snapped time under the pointer. */
const pointer = ref<EpochMs | null>(null)
/** The first click's time, while selecting. */
const head = ref<EpochMs | null>(null)
/** Why the last click was refused, until it moves. */
const refusal = ref<string | null>(null)
const saveError = ref<string | null>(null)
const saving = ref(false)
/** Whose tooltip is open: a Period, or a day to add one. */
const editing = shallowRef<{
  /** The day focused when it closes without a Period. */
  key: string
  /** The day it reads typed times on. */
  day: Date
  period?: SleepPeriod
  /** Where on the snake it points. */
  at: EpochMs
} | null>(null)
const editor = useTemplateRef<{
  commit(): boolean
  $el: Node
}>('editor')
/**
 * The Period being dragged, which end, and the time
 * under the pointer when it was pressed.
 */
const grabbed = shallowRef<{
  saved: SleepPeriod
  end: End
  from: EpochMs | null
} | null>(null)

// The end moves by as much as the pointer has since
// the press, so pressing off its centre doesn't jump
// it, and a press without moving changes nothing.
const moved = computed(() => {
  const at = pointer.value
  if (!grabbed.value || at === null) return null
  const { saved, end, from } = grabbed.value
  if (at === from) return null
  const to = from === null ? at : saved[end] + at - from
  return drag(saved, end, to,
    months.periods.value, Date.now())
})

/** The Periods drawn, with the dragged one moved. */
const periods = computed(() => {
  const changed = moved.value
  const all = months.periods.value
  return changed
    ? all.map(p => p.id === changed.id ? changed : p)
    : all
})

/** The Period the selection would create. */
const preview = computed(() =>
  head.value !== null && pointer.value !== null
    ? ordered(head.value, pointer.value)
    : null
)

// A preview that hasn't left its Head yet breaks no
// rule. Only a second click there is refused.
const broken = computed(() =>
  preview.value
  && preview.value.end > preview.value.start
  && breaks(preview.value, months.periods.value,
    Date.now()))

// Each day's own Periods, by their Head's calendar day.
const byDay = computed(() => {
  const days = new Map<string, SleepPeriod[]>()
  for (const period of periods.value) {
    const key = localDate(new Date(period.start))
    days.set(key, [...days.get(key) ?? [], period])
  }
  return days
})

const rows = computed(() =>
  months.days.value.map(day => {
    const key = localDate(day)
    return {
      key,
      day,
      label: formatDate(day, 'short'),
      caption: caption(byDay.value.get(key) ?? []),
      future: isAfter(day, store.today),
      selected: isSameDay(day, store.day)
    }
  })
)

/** The first day after today, as a day index. */
const future = computed(() => {
  const index = rows.value.findIndex(row => row.future)
  return index === -1 ? null : index
})

/**
 * The time on the snake: the pointer's, the dragged
 * end's, or why a click was refused. None over a Period
 * unless selecting, as that's not an empty part.
 */
const hover = computed(() => {
  if (editing.value) return null
  const at = moved.value && grabbed.value
    ? moved.value[grabbed.value.end]
    : pointer.value
  if (at === null) return null
  if (head.value === null && !moved.value
    && periodAt(months.periods.value, at))
    return null
  return {
    time: at,
    text: refusal.value ?? formatTime(new Date(at))
  }
})

const onPoint = (time: EpochMs | null): void => {
  if (time === null) {
    onLeave()
    return
  }
  const snapped = snap(time)
  if (pointer.value !== snapped) refusal.value = null
  pointer.value = snapped
}

// While selecting or dragging, the Period stays where
// the pointer left it, so leaving the snake doesn't
// flicker.
const onLeave = (): void => {
  if (head.value === null && !grabbed.value)
    pointer.value = null
  refusal.value = null
}

// The click ending a drag isn't a click on the snake.
let released = false

const onPress = (
  exact: EpochMs,
  event: MouseEvent
): void => {
  if (saving.value || released || editing.value) return
  const time = snap(exact)
  if (head.value === null) {
    const over = periodAt(months.periods.value, exact)
    if (over) {
      edit(over, event)
      return
    }
    if (periodAt(months.periods.value, time)) return
    if (time > Date.now()) {
      refusal.value = reason('future-date')
      return
    }
    saveError.value = null
    head.value = time
    return
  }
  const period = ordered(head.value, time)
  const rule = breaks(period, months.periods.value,
    Date.now())
  if (rule) refusal.value = reason(rule)
  else void save(period)
}

const save = async (
  period: NewSleepPeriod
): Promise<void> => {
  cancel()
  saving.value = true
  const result = await window.bulletin.sleep.create(period)
  saving.value = false
  if (result.ok) months.add(result.value)
  else {
    saveError.value = "Couldn't save the period. "
      + `${reason(result.error.code)}.`
  }
}

const grab = (period: SleepPeriod, end: End): void => {
  if (saving.value || head.value !== null) return
  saveError.value = null
  grabbed.value = {
    saved: period,
    end,
    from: pointer.value
  }
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', drop)
}

const drop = (): void => {
  grabbed.value = null
  pointer.value = null
  window.removeEventListener('pointerup', release)
  window.removeEventListener('pointercancel', drop)
}

const release = (): void => {
  const saved = grabbed.value?.saved
  const period = moved.value
  drop()
  released = true
  setTimeout(() => {
    released = false
  })
  if (saved && period) void move(saved, period)
}

/** Saves the moved Period, or puts it back. */
const move = async (
  saved: SleepPeriod,
  period: SleepPeriod
): Promise<void> => {
  if (period.start === saved.start
    && period.end === saved.end) return
  months.add(period)
  saving.value = true
  const result = await window.bulletin.sleep.update(period)
  saving.value = false
  if (result.ok) months.add(result.value)
  else {
    months.add(saved)
    saveError.value = "Couldn't move the period. "
      + `${reason(result.error.code)}.`
  }
}

// The click that opened the tooltip isn't a click
// away from it, and neither is a click inside it.
let opening: Event | null = null
// Whether the tooltip is closing on a click away, which
// leaves focus where it went.
let closingAway = false

const open = (
  target: NonNullable<typeof editing.value>,
  event?: Event
): void => {
  if (saving.value) return
  if (editing.value && !commitAway()) return
  cancel()
  saveError.value = null
  opening = event ?? null
  editing.value = target
}

/** Opens `period`'s tooltip at its middle. */
const edit = (period: SleepPeriod, event?: Event): void => {
  open({
    key: localDate(new Date(period.start)),
    day: startOfDay(period.start),
    period,
    at: (period.start + period.end) / 2
  }, event)
}

/** Opens "Add period" on `day`'s AM row. */
const add = (day: Date): void => {
  open({
    key: localDate(day),
    day,
    at: new Date(day).setHours(6, 30)
  })
}

/** Saves the open tooltip; false if it can't. */
const commitAway = (): boolean => {
  closingAway = true
  const done = editor.value?.commit() ?? true
  closingAway = false
  return done
}

/** Closes the tooltip, focusing what opened it. */
const close = async (): Promise<void> => {
  const was = editing.value
  editing.value = null
  if (!was || closingAway) return
  await nextTick()
  const find = (selector: string): HTMLElement | null
    | undefined =>
    root.value?.querySelector<HTMLElement>(selector)
  const period = was.period
    && find(`[data-period="${was.period.id}"]`)
  ;(period || find(`[data-day="${was.key}"]`))?.focus()
}

const onSave = (period: NewSleepPeriod): void => {
  const saved = editing.value?.period
  void close()
  if (saved) void move(saved, { ...saved, ...period })
  else void save(period)
}

/** Deletes `period`, or puts it back. */
const remove = async (
  period: SleepPeriod
): Promise<void> => {
  months.remove(period.id)
  void close()
  saving.value = true
  const result = await window.bulletin.sleep.delete(
    period.id)
  saving.value = false
  if (!result.ok) {
    months.add(period)
    saveError.value = "Couldn't delete the period. "
      + `${reason(result.error.code)}.`
  }
}

const cancel = (): void => {
  head.value = null
  pointer.value = null
  refusal.value = null
}

const onKeydown = (event: Event): void => {
  if ((event as KeyboardEvent).key === 'Escape') cancel()
}

// The Head's own click is inside, so it never cancels.
const onDocumentClick = (event: Event): void => {
  const path = event.composedPath()
  const tooltip = editor.value?.$el
  if (editing.value && event !== opening
    && !(tooltip && path.includes(tooltip)))
    commitAway()
  const widget = root.value?.closest('.widget-frame')
    ?? root.value
  if (widget && !path.includes(widget)) cancel()
}

const listen = (on: boolean): void => {
  const method = on
    ? 'addEventListener'
    : 'removeEventListener'
  window[method]('keydown', onKeydown)
  document[method]('click', onDocumentClick)
}

watch(
  () => head.value !== null || editing.value !== null,
  listen
)
onBeforeUnmount(() => {
  listen(false)
  drop()
})

/** Scrolls the Selected Date's day to the centre. */
const centre = (): void => {
  const list = scroller.value
  const row = list?.querySelector<HTMLElement>(
    `[data-day="${localDate(store.day)}"]`
  )
  if (!list || !row) return
  list.scrollTop = row.offsetTop
    - (list.clientHeight - row.offsetHeight) / 2
}

// Loads one month when within half a view of an edge.
// Rows added above push the content down by exactly
// their height, so the scroll position follows it.
let loading = false
const loadNearEdges = async (): Promise<void> => {
  const list = scroller.value
  if (!list || loading) return
  const edge = list.clientHeight / 2
  const below = list.scrollHeight - list.scrollTop
    - list.clientHeight
  loading = true
  try {
    if (list.scrollTop < edge) {
      const height = list.scrollHeight
      if (await months.loadEarlier()) {
        await nextTick()
        list.scrollTop += list.scrollHeight - height
      }
    } else if (below < edge)
      await months.loadLater()
  } finally {
    loading = false
  }
}

const follow = async (day: Date): Promise<void> => {
  if (!months.contains(day)) await months.reset(day)
  await nextTick()
  centre()
}

onMounted(() => follow(store.day))
watch(() => store.day, follow)

// A new month at midnight: a past Selected Date stays
// put, so today's month is added here instead.
watch(() => store.today, today => {
  if (store.isToday || months.contains(today)) return
  if (months.contains(addDays(today, -1)))
    void months.loadLater()
})
</script>

<template>
  <div ref="root" class="sleep-timeline">
    <p v-if="months.failed.value" class="error" role="alert">
      Couldn't load sleep.
    </p>
    <p v-if="saveError" class="error" role="alert">
      {{ saveError }}
    </p>
    <div class="view">
      <div
        ref="scroller"
        class="rows"
        @scroll.passive="loadNearEdges"
      >
        <ol class="days">
          <li
            v-for="row in rows"
            :key="row.key"
            class="day-row"
            :class="{
              '-future': row.future,
              '-selected': row.selected
            }"
            :data-day="row.key"
            :aria-disabled="row.future || undefined"
            :tabindex="row.future ? undefined : 0"
            @keydown.enter.self="add(row.day)"
          >
            <span class="date">{{ row.label }}</span>
            <span v-if="row.caption" class="caption">
              {{ row.caption }}
            </span>
          </li>
        </ol>
        <SleepSnake
          v-if="rows.length > 0"
          class="snake"
          :first="rows[0].day"
          :days="rows.length"
          :periods="periods"
          :preview="preview"
          :broken="!!broken"
          :editing="editing?.period?.id ?? null"
          :future="future"
          :hover="hover"
          @point="onPoint"
          @press="onPress"
          @grab="grab"
          @open="edit"
        >
          <template #default="{ place }">
            <span
              v-if="editing"
              class="anchor"
              :style="place(editing.at)"
            >
              <SleepPeriodEditor
                ref="editor"
                :key="editing.period?.id ?? 'add'"
                :period="editing.period"
                :day="editing.day"
                :periods="months.periods.value"
                @save="onSave"
                @remove="
                  editing.period && remove(editing.period)"
                @close="close"
              />
            </span>
          </template>
        </SleepSnake>
      </div>
    </div>
    <SleepHours class="hours" />
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma's Sleep frame, from the Widget's 7px padding:
// dates at x 21, and the labels' column up to its
// separator at x 81. The separator is the Widget's
// colour, so it shows as the gap before the dotted
// rows, which start 10px on at x 91. The first AM row
// is 23px from the top; a date's top sits a pixel
// above it.
$labels: rem(74px);
$label-inset: rem(14px);
$first-row: 22px;

// A day is two of the snake's rows, 28.5px apart.
$day: 57px;

.sleep-timeline {
  --sleep-labels: #{$labels};

  display: flex;
  flex-direction: column;
  height: 100%;

  > .error {
    font-size: rem(12px);
    color: var(--color-text-muted);
  }

  > .view {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  // Figma's transparency mask, as the Widget's colour
  // over the days: the same on its solid background,
  // and the tooltip can sit over it.
  > .view::after {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    content: '';
    background: linear-gradient(
      transparent,
      color-mix(
        in sRGB,
        var(--color-surface-raised) 44%,
        transparent
      ) 80%,
      var(--color-surface-raised)
    );
  }

  .rows {
    position: relative; // Days' offsetTop is from here
    height: 100%;
    overflow-y: auto;
    overflow-anchor: none; // We keep the position
    scrollbar-gutter: stable;
  }

  .rows > .days {
    width: $labels;
    padding: $first-row 0 0;
    margin: 0;
    list-style: none;
  }

  .rows > .snake {
    position: absolute;
    top: 0;
    right: 0;
    left: $labels;
  }

  // The tooltip sits above this point on the snake, as
  // wide as it needs: the point has no width to fill.
  .rows > .snake > .anchor {
    position: absolute;
    z-index: 2;
  }

  .rows > .snake > .anchor > .sleep-period-editor {
    width: max-content;
  }

  // The same gutter as the days' scrollbar, so the
  // hours line up where scrollbars take up space.
  > .hours {
    padding-top: space(2);
    overflow-y: hidden;
    scrollbar-gutter: stable;
  }
}

.day-row {
  display: flex;
  flex-direction: column;
  height: $day;
  padding-left: $label-inset;
  color: var(--color-sleep-date);

  > .date {
    font-size: rem(14px);
    font-weight: 300;
    line-height: 1.2;
  }

  > .caption {
    font-size: rem(9px);
    font-weight: 500;
    color: var(--color-sleep-caption);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }

  &.-selected > .date { font-weight: 400; }

  // The rest of the month: shown, but not usable.
  &.-future {
    pointer-events: none;
    opacity: 0.35;
  }
}
</style>
