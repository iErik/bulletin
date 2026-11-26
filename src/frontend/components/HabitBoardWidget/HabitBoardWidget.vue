<script setup lang="ts">
// Habit Board (Figma 3889:9395, minus the Pattern card):
// month-so-far daily cells per Habit, Streak, Best,
// Rate, the Slipping tag, and inline "+ Add habit".
import {
  computed,
  nextTick,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import { parseISO } from 'date-fns'
import { localDate } from '@shared/dates'
import {
  HABIT_GOAL,
  type Habit,
  type HabitEntry
} from '@shared/habits'
import type { LocalDate } from '@shared/storage'
import HabitEditor
  from '@/components/HabitEditor/HabitEditor.vue'
import OverlayScrollbar
  from '@/components/OverlayScrollbar/OverlayScrollbar.vue'
import Widget from '@/components/Widget/Widget.vue'
import {
  useDataVersion
} from '@/composables/use-data-version'
import {
  formatBoardRange,
  habitBoard,
  type BoardCell
} from '@/habits/board'
import { HABIT_ICON_COMPONENTS } from '@/habits/icons'
import { formatDate } from '@/locale/format'
import {
  useSelectedDateStore
} from '@/stores/selected-date'

const store = useSelectedDateStore()
const version = useDataVersion(
  'habits', 'habitEntries', 'habitGoal'
)
const date = computed(() => localDate(store.day))

const habits = shallowRef<Habit[]>([])
const entries = shallowRef<HabitEntry[]>([])
const goal = ref<number>(HABIT_GOAL.default)
const loaded = ref(false)
const failed = ref(false)
const actionError = ref<string | null>(null)
const adding = ref(false)
const editorBusy = ref(false)

const scroller = useTemplateRef<HTMLElement>('scroller')
const addButton = useTemplateRef<HTMLButtonElement>(
  'addButton'
)

let generation = 0

/** Desired done state for cells currently saving. */
const writing = new Map<string, boolean>()

const entryKey = (
  habitId: number,
  day: LocalDate
): string => `${habitId} ${day}`

/** Keeps in-flight optimistic toggles over a reload. */
const mergeWriting = (
  list: HabitEntry[]
): HabitEntry[] => {
  if (!writing.size) return list
  const kept = list.filter(entry => {
    const pending = writing.get(
      entryKey(entry.habitId, entry.date)
    )
    return pending === undefined || pending
  })
  const seen = new Set(
    kept.map(e => entryKey(e.habitId, e.date))
  )
  for (const [key, done] of writing) {
    if (!done || seen.has(key)) continue
    const [id, day] = key.split(' ')
    kept.push({ habitId: Number(id), date: day })
  }
  return kept
}

const load = async (): Promise<void> => {
  const asked = ++generation
  const [hs, es, g] = await Promise.all([
    window.bulletin.habits.list('all'),
    window.bulletin.habits.listEntries({
      from: '1970-01-01',
      to: date.value
    }),
    window.bulletin.habits.getGoal()
  ])
  if (asked !== generation) return
  if (!hs.ok || !es.ok || !g.ok) {
    failed.value = true
    loaded.value = true
    return
  }
  failed.value = false
  habits.value = hs.value
  entries.value = mergeWriting(es.value)
  goal.value = g.value
  loaded.value = true
}

watch([date, version], () => {
  actionError.value = null
  void load()
}, { immediate: true })

const board = computed(() => habitBoard(
  habits.value,
  entries.value,
  date.value,
  { goal: goal.value, isToday: store.isToday }
))
const headerRange = computed(() =>
  formatBoardRange(board.value.range)
)
const dense = computed(() => board.value.days.length > 30)
const dayLabels = computed(() => new Map(
  board.value.days.map(day => [
    day,
    formatDate(parseISO(day), 'short')
  ])
))

const cellLabel = (
  habit: Habit,
  cell: BoardCell
): string => {
  const day = dayLabels.value.get(cell.date) ?? cell.date
  const state = cell.state === 'done' ? 'Done' : 'Not done'
  return `${habit.name} · ${day} · ${state}`
}

const setEntry = (
  habitId: number,
  day: LocalDate,
  done: boolean
): void => {
  const rest = entries.value.filter(
    e => e.habitId !== habitId || e.date !== day
  )
  entries.value = done
    ? [...rest, { habitId, date: day }]
    : rest
}

const toggle = async (
  habit: Habit,
  cell: BoardCell
): Promise<void> => {
  if (!cell.interactive) return
  const key = entryKey(habit.id, cell.date)
  if (writing.has(key)) return
  const was = cell.state === 'done'
  writing.set(key, !was)
  setEntry(habit.id, cell.date, !was)
  actionError.value = null
  const entry = { habitId: habit.id, date: cell.date }
  const { habits: api } = window.bulletin
  const result = was
    ? await api.deleteEntry(entry)
    : await api.createEntry(entry)
  writing.delete(key)
  if (result.ok) return
  setEntry(habit.id, cell.date, was)
  actionError.value = 'Couldn’t save that day. Try again.'
}

const closeEditor = async (): Promise<void> => {
  if (editorBusy.value) return
  adding.value = false
  await nextTick()
  addButton.value?.focus()
}

const onCreated = async (habit: Habit): Promise<void> => {
  const exists = habits.value.some(h => h.id === habit.id)
  habits.value = exists
    ? habits.value.map(h => h.id === habit.id ? habit : h)
    : [...habits.value, habit]
  await closeEditor()
}
</script>

<template>
  <Widget
    class="habit-board"
    :class="{ '-dense': dense }"
    title="Habit Board"
    icon="checklist"
  >
    <template #actions>
      <p class="range">
        {{ headerRange }}
      </p>
    </template>
    <p v-if="failed" class="message" role="alert">
      Couldn’t load the Habit Board.
    </p>
    <div v-else-if="loaded" class="content">
      <template v-if="board.rows.length">
        <div class="col-head" aria-hidden="true">
          <span class="col-habit">Habit</span>
          <div class="axis">
            <span
              v-for="tick in board.ticks"
              :key="tick.date"
              class="tick"
              :class="{
                '-last': tick.isLast,
                '-end': tick.isLast && tick.index > 0
              }"
              :style="{ '--tick': tick.index }"
            >{{ tick.label }}</span>
          </div>
          <span class="col-stat">Streak</span>
          <span class="col-stat">Best</span>
          <span class="col-stat">Rate</span>
        </div>
        <div class="view">
          <div ref="scroller" class="scroller">
            <div
              v-for="row in board.rows"
              :key="row.habit.id"
              class="row"
              :class="{ '-archived': row.habit.archived }"
            >
              <div class="habit">
                <span class="tile">
                  <component
                    :is="HABIT_ICON_COMPONENTS[
                      row.habit.icon
                    ]"
                    class="icon"
                    aria-hidden="true"
                  />
                </span>
                <div class="info">
                  <span class="name" :title="row.habit.name">
                    {{ row.habit.name }}
                  </span>
                  <span v-if="row.slipping" class="slipping">
                    Slipping
                  </span>
                </div>
              </div>
              <div class="cells">
                <template
                  v-for="cell in row.cells"
                  :key="cell.date"
                >
                  <button
                    v-if="cell.interactive"
                    class="cell"
                    :class="[`-${cell.state}`, {
                      '-streak': cell.inCurrentStreak,
                      '-selected': cell.isSelected
                    }]"
                    type="button"
                    :aria-pressed="cell.state === 'done'"
                    :aria-label="cellLabel(row.habit, cell)"
                    @click="toggle(row.habit, cell)"
                  />
                  <span
                    v-else
                    class="cell"
                    :class="[`-${cell.state}`, {
                      '-streak': cell.inCurrentStreak,
                      '-selected': cell.isSelected
                    }]"
                    aria-hidden="true"
                  />
                </template>
              </div>
              <span
                class="stat -streak"
                :class="{ '-high': row.highlightStreak }"
              >{{ row.streak }}</span>
              <span class="stat -best">{{ row.best }}</span>
              <span class="stat" :class="`-${row.rateTone}`">
                {{ row.rate === null ? '—' : `${row.rate}%` }}
              </span>
            </div>
          </div>
          <OverlayScrollbar :target="scroller" />
        </div>
      </template>
      <p v-else class="empty">
        No habits yet
      </p>
      <div class="add-row" :class="{ '-editing': adding }">
        <HabitEditor
          v-if="adding"
          v-model:busy="editorBusy"
          @saved="onCreated"
          @cancel="closeEditor"
        />
        <button
          v-else
          ref="addButton"
          class="add-button"
          type="button"
          @click="adding = true"
        >
          <span class="plus" aria-hidden="true">+</span>
          Add habit
        </button>
      </div>
      <p v-if="actionError" class="message" role="alert">
        {{ actionError }}
      </p>
    </div>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.habit-board {
  --widget-gap: #{rem(14px)};
  --cell-gap: #{rem(2.6px)};
  --cell-step: #{rem(12.6px)};

  &.-dense {
    --cell-gap: #{rem(2px)};
    --cell-step: #{rem(12px)};
  }

  > .header > .actions > .range {
    margin: 0 rem(4px) 0 0;
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-widget-title);
  }
}

.habit-board {
  .message,
  .empty {
    font-size: rem(11px);
    color: var(--color-text-muted);
  }

  .empty { padding: space(2) rem(4px) space(1); }
  .message { padding: space(1) rem(4px) 0; }

  .content,
  .view,
  .scroller {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .content { height: 100%; }

  .view {
    position: relative;
    flex: 0 1 auto;
  }

  .scroller {
    gap: rem(8px);
    @include scroller(y);
  }

  .col-head,
  .row {
    display: grid;
    flex: none;
    grid-template-columns:
      rem(150px) minmax(rem(376px), 1fr)
      rem(46px) rem(34px) rem(34px);
    column-gap: rem(10px);
    align-items: center;
    padding: 0 rem(10px);
  }

  .col-head {
    margin-bottom: rem(8px);
    font-size: rem(10px);
    font-weight: 700;
    line-height: rem(12px);
    text-transform: uppercase;
    color: var(--color-widget-title);

    > .col-habit { margin-left: rem(-6px); }
    > .col-stat { text-align: right; }
  }

  .axis {
    position: relative;
    height: rem(12px);

    > .tick {
      position: absolute;
      top: 0;
      left: calc(var(--tick) * var(--cell-step) + #{rem(5px)});
      font-size: rem(9px);
      line-height: rem(12px);
      white-space: nowrap;
      transform: translateX(-50%);

      &.-last { color: var(--color-habit-board-today); }

      &.-end {
        left: calc(
          var(--tick) * var(--cell-step) + #{rem(10px)}
        );
        transform: translateX(-100%);
      }
    }
  }

  .row {
    height: rem(46px);
    background: var(--color-habit-board-row);
    border-radius: rem(8px);
    @include colour-transition;

    &.-archived { opacity: 0.55; }
  }

  .habit {
    display: flex;
    gap: rem(10px);
    align-items: center;
    min-width: 0;

    > .tile {
      display: grid;
      flex: none;
      place-items: center;
      width: rem(28px);
      height: rem(28px);
      color: var(--color-tile-icon);
      background: var(--color-tile);
      border-radius: rem(6px);
    }

    > .tile > .icon {
      width: rem(12px);
      height: rem(12px);
    }

    > .info {
      position: relative;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    > .info > .name {
      overflow: hidden;
      font-size: rem(13px);
      font-weight: 500;
      line-height: rem(16px);
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--color-habit-board-name);
    }

    > .info > .slipping {
      position: absolute;
      top: 100%;
      left: 0;
      font-size: rem(8px);
      font-weight: 700;
      line-height: rem(10px);
      text-transform: uppercase;
      color: var(--color-habit-board-slipping);
    }
  }

  .cells {
    display: flex;
    gap: var(--cell-gap);
    align-items: center;
  }

  .cell {
    flex: none;
    width: rem(10px);
    height: rem(22px);
    padding: 0;
    border: 0;
    border-radius: rem(3px);
    @include colour-transition;

    &.-done { background: var(--color-habit-board-done); }

    &.-streak {
      box-shadow: 0 0 4px 0 var(--color-habit-board-glow);
    }

    &.-dim { background: var(--color-habit-board-dim); }
    &.-blank { background: transparent; }

    &.-selected {
      border: 1px solid var(--color-habit-board-selected);
    }
  }

  button.cell {
    cursor: pointer;
    @include focus-ring;
  }

  .stat {
    font-family: $font-family-mono;
    font-size: rem(11px);
    font-weight: 500;
    text-align: right;
    color: var(--color-stat-value);

    &.-high { color: var(--color-habit-board-streak); }
    &.-best { color: var(--color-habit-board-best); }
    &.-good { color: var(--color-improvement); }
    &.-low { color: var(--color-habit-board-low); }
  }

  .add-row {
    flex: none;
    margin-top: rem(8px);
    background: var(--color-habit-board-add-bg);
    border: 1px dashed var(--color-habit-board-add-border);
    border-radius: rem(8px);
    @include colour-transition;

    &.-editing {
      padding: rem(2px) rem(8px) rem(2px) rem(4px);
    }
  }

  .add-button {
    display: flex;
    gap: rem(6px);
    align-items: center;
    justify-content: center;
    width: 100%;
    height: rem(38px);
    font-size: rem(11px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-habit-board-add-text);
    border-radius: rem(8px);
    @include colour-transition;
    @include focus-ring;

    &:hover { color: var(--color-text); }
  }

  .control {
    display: grid;
    place-items: center;
    width: rem(22px);
    height: rem(22px);
    color: var(--color-text-muted);
    border-radius: rem(6px);
    @include focus-ring;

    &:hover { background: var(--color-tile); }

    &:disabled {
      cursor: default;
      opacity: 0.4;
    }
  }
}
</style>
