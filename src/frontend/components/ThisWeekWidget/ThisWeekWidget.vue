<script setup lang="ts">
// This Week (Figma 3889:8141): the Locale week holding the
// Selected Date, one column per day, headed with the range
// and the legend; a Task card opens the Task in the editor.
// An Occurrence card is shown but not interactive (BLT-168).
import {
  computed,
  reactive,
  ref,
  shallowRef,
  watch
} from 'vue'
import { addDays, parseISO, startOfWeek } from 'date-fns'
import { localDate } from '@shared/dates'
import { compareForDay } from '@shared/recurring-tasks'
import type { Occurrence } from '@shared/recurring-tasks'
import type { DateRange, LocalDate } from '@shared/storage'
import type { LocalTime, Task } from '@shared/tasks'
import Icon from '@/components/Icon/Icon.vue'
import OverlayScrollbar
  from '@/components/OverlayScrollbar/OverlayScrollbar.vue'
import TaskEditor
  from '@/components/TaskEditor/TaskEditor.vue'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import { firstDayOfWeek, formatDate, locale }
  from '@/locale/format'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { timeText } from '@/tasks/day-choice'

interface Card {
  readonly kind: 'task' | 'occurrence'
  readonly key: string
  readonly title: string
  readonly day: LocalDate
  readonly time: LocalTime | null
  readonly done: boolean
  readonly overdue: boolean
  readonly reminder: boolean
  readonly created: number
  readonly task?: Task
  readonly occurrence?: Occurrence
}

interface DayColumn {
  readonly date: LocalDate
  readonly weekday: string
  readonly dayNumber: number
  readonly label: string
  readonly items: readonly Card[]
}

const store = useSelectedDateStore()
const version = useDataVersion('tasks')

const tasks = shallowRef<Task[]>([])
const occurrences = shallowRef<Occurrence[]>([])
const loaded = ref(false)
const failed = ref(false)
let generation = 0

const range = computed((): DateRange => {
  const start = startOfWeek(parseISO(localDate(store.day)), {
    weekStartsOn: firstDayOfWeek() as 0 | 1 | 2 | 3 | 4 | 5 | 6
  })
  return { from: localDate(start), to: localDate(addDays(start, 6)) }
})

// The range as "Nov 17 – 23", or "Nov 29 – Dec 5" when
// the week spans a month.
const rangeText = computed((): string =>
  new Intl.DateTimeFormat(locale(), { month: 'short', day: 'numeric' })
    .formatRange(parseISO(range.value.from), parseISO(range.value.to))
    .replace(/\s*–\s*/, ' – '))

const load = async (): Promise<void> => {
  const asked = ++generation
  const r = range.value
  const [planned, occ] = await Promise.all([
    window.bulletin.tasks.list(r),
    window.bulletin.recurringTasks.listOccurrences(r)
  ])
  if (asked !== generation) return
  if (!planned.ok || !occ.ok) {
    failed.value = true
    loaded.value = true
    return
  }
  failed.value = false
  loaded.value = true
  tasks.value = planned.value
  occurrences.value = occ.value
}

watch(
  () => [localDate(store.day), firstDayOfWeek(), version.value] as const,
  () => { void load() },
  { immediate: true }
)

// Overdue is always relative to real today, never the
// Selected Date; an Occurrence is never Overdue.
const cards = computed((): Card[] => {
  const today = localDate(new Date())
  const items = [
    ...tasks.value.map(task => ({
      kind: 'task' as const,
      key: `task-${task.id}`,
      title: task.title,
      day: task.day!,
      time: task.time,
      done: task.doneAt !== null,
      overdue: task.day! < today && task.doneAt === null,
      reminder: task.reminder !== null,
      created: task.created,
      task
    })),
    ...occurrences.value.map(occurrence => ({
      kind: 'occurrence' as const,
      key: `occurrence-${occurrence.ruleId}-${occurrence.scheduled}`,
      title: occurrence.title,
      day: occurrence.day,
      time: occurrence.time,
      done: occurrence.doneAt !== null,
      overdue: false,
      reminder: false,
      created: occurrence.created,
      occurrence
    }))
  ]
  return items.sort((a, b) => compareForDay(
    { day: a.day, time: a.time, created: a.created },
    { day: b.day, time: b.time, created: b.created }
  ))
})

const columns = computed((): DayColumn[] => {
  const start = parseISO(range.value.from)
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i)
    const date = localDate(day)
    return {
      date,
      weekday: formatDate(day, 'weekday'),
      dayNumber: day.getDate(),
      label: formatDate(day, 'long'),
      items: cards.value.filter(card => card.day === date)
    }
  })
})

const empty = computed((): boolean =>
  loaded.value && !failed.value && cards.value.length === 0)

const selected = computed((): LocalDate => localDate(store.day))

// One overlay scrollbar per column, keyed by day.
const scrollers = reactive<Record<string, HTMLElement | undefined>>({})

const setScroller = (date: LocalDate, el: unknown): void => {
  if (el instanceof HTMLElement) scrollers[date] = el
  else delete scrollers[date]
}

// The Task being edited, with its card as anchor.
const editing = ref<{ task: Task; anchor: HTMLElement } | null>(null)

const open = (card: Card, anchor: HTMLElement | null): void => {
  if (card.kind !== 'task' || !card.task || !anchor) return
  editing.value = { task: card.task, anchor }
}

const close = (): void => {
  editing.value = null
}

const onKeydown = (
  card: Card,
  anchor: HTMLElement | null,
  event: KeyboardEvent
): void => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  open(card, anchor)
}
</script>

<template>
  <Widget
    class="this-week-widget"
    title="This Week"
    icon="calendar"
  >
    <template #actions>
      <p class="range">
        {{ rangeText }}
      </p>
    </template>

    <p v-if="failed" class="message" role="alert">
      Couldn’t load This Week.
    </p>
    <p v-else-if="empty" class="message">
      No tasks this week
    </p>
    <template v-else-if="loaded">
      <div class="board">
        <section
          v-for="col in columns"
          :key="col.date"
          class="column"
          :class="{ '-selected': col.date === selected }"
          :aria-label="col.label"
          :data-day="col.date"
        >
          <header class="col-head">
            <span class="weekday">{{ col.weekday }}</span>
            <span class="day">{{ col.dayNumber }}</span>
          </header>
          <div class="view">
            <ul :ref="el => setScroller(col.date, el)" class="scroller">
              <li
                v-for="card in col.items"
                :key="card.key"
                class="card"
                :class="{
                  '-done': card.done,
                  '-overdue': card.overdue,
                  '-occurrence': card.kind === 'occurrence'
                }"
                :tabindex="card.kind === 'task' ? 0 : undefined"
                :role="card.kind === 'task' ? 'button' : undefined"
                :aria-label="card.kind === 'task' ? card.title : undefined"
                @click="open(card, $event.currentTarget as HTMLElement)"
                @keydown="onKeydown(
                  card, $event.currentTarget as HTMLElement, $event)"
              >
                <span class="title" :title="card.title">
                  {{ card.title }}
                </span>
                <span
                  class="time"
                  :class="{ '-overdue': card.overdue }"
                >{{ card.overdue
                  ? 'overdue'
                  : card.time
                    ? timeText(card.time)
                    : 'any time' }}</span>
                <Icon
                  v-if="card.kind === 'occurrence'"
                  name="repeat"
                  class="mark"
                />
                <Icon v-if="card.reminder" name="bell" class="mark" />
              </li>
            </ul>
            <OverlayScrollbar :target="scrollers[col.date]" />
          </div>
        </section>
      </div>
      <div class="legend">
        <span class="legend-label">Legend</span>
        <span class="legend-item">
          <Icon name="repeat" class="mark" />Recurring
        </span>
        <span class="legend-item">
          <Icon name="bell" class="mark" />Reminder
        </span>
        <span class="legend-item">
          <span class="bar" aria-hidden="true" />Overdue
        </span>
      </div>
    </template>

    <TaskEditor
      v-if="editing"
      :task="editing.task"
      :anchor="editing.anchor"
      @close="close"
      @saved="close"
      @deleted="close"
    />
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.this-week-widget {
  --widget-gap: #{rem(8px)};

  > .header > .actions > .range {
    margin: 0 rem(4px) 0 0;
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-widget-title);
  }
}

.this-week-widget {
  > .body {
    display: flex;
    flex-direction: column;
  }

  > .body > .message {
    padding: space(2) rem(4px) 0;
    font-size: rem(11px);
    color: var(--color-text-muted);
  }

  .board {
    display: grid;
    flex: 1;
    min-height: 0;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: rem(6px);
  }

  .column {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    padding: rem(6px) rem(4px) rem(4px);
    background: color-mix(in sRGB, var(--color-text) 4%, transparent);
    border-radius: $radius-medium;

    &.-selected {
      background: color-mix(in sRGB, var(--color-tasks-accent) 5%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(
        in sRGB, var(--color-tasks-accent) 12%, transparent
      );
    }

    .col-head {
      display: flex;
      flex: none;
      align-items: baseline;
      justify-content: space-between;
      padding: 0 rem(2px) rem(4px);

      .weekday {
        font-size: rem(10px);
        font-weight: 700;
        line-height: rem(12px);
        text-transform: uppercase;
        color: color-mix(in sRGB, var(--color-tile-icon) 55%, transparent);
      }

      .day {
        font-family: $font-family-mono;
        font-size: rem(10px);
        font-weight: 500;
        line-height: rem(12px);
        color: color-mix(in sRGB, var(--color-tile-icon) 55%, transparent);
      }
    }

    &.-selected .day { color: var(--color-tasks-accent); }

    .view {
      position: relative;
      display: flex;
      flex: 1;
      min-height: 0;
    }

    .scroller {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: rem(4px);
      min-height: 0;
      margin: 0;
      padding: 0;
      list-style: none;
      @include scroller(y);
    }

    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: rem(2px);
      padding: rem(7px) rem(22px) rem(7px) rem(8px);
      min-height: rem(44px);
      background: var(--color-surface-raised);
      border-radius: $radius-small;
      cursor: pointer;
      @include focus-ring;

      &.-occurrence { cursor: default; }

      &.-done {
        opacity: 0.45;

        .title,
        .time { text-decoration: line-through; }
      }

      &.-overdue {
        box-shadow: inset 2px 0 0 var(--color-tasks-danger);
      }

      .title {
        overflow: hidden;
        font-size: rem(11px);
        font-weight: 500;
        line-height: rem(14px);
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--color-tasks-text);
      }

      .time {
        font-size: rem(9px);
        font-weight: 700;
        line-height: rem(12px);
        text-transform: uppercase;
        color: color-mix(in sRGB, var(--color-tile-icon) 55%, transparent);

        &.-overdue { color: var(--color-tasks-danger); }
      }

      .mark {
        position: absolute;
        right: rem(6px);
        top: 50%;
        width: rem(10px);
        height: rem(10px);
        color: var(--color-tile-icon);
        transform: translateY(-50%);
      }
    }
  }

  .legend {
    display: flex;
    flex: none;
    align-items: center;
    gap: rem(12px);
    padding-top: rem(6px);

    .legend-label {
      font-size: rem(9px);
      font-weight: 700;
      text-transform: uppercase;
      color: color-mix(in sRGB, var(--color-tile-icon) 55%, transparent);
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: rem(4px);
      font-size: rem(9px);
      font-weight: 700;
      text-transform: uppercase;
      color: color-mix(in sRGB, var(--color-tile-icon) 60%, transparent);

      .mark {
        width: rem(10px);
        height: rem(10px);
      }

      .bar {
        width: rem(2px);
        height: rem(10px);
        border-radius: 999px;
        background: var(--color-tasks-danger);
      }
    }
  }
}
</style>
