<script setup lang="ts">
// Year in Mood (Figma 3889:7442): the Selected Date's
// year as twelve compact Month Grids with each month's
// Happy share and Mood mix. It reloads when the Mood
// Data Source changes (ADR 0007). Clicking a day up to
// the Selected Date opens MoodPicker in a floating card
// next to it; Escape or a click outside closes it and
// returns focus to that Day Pill.
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
  type CSSProperties
} from 'vue'
import { isAfter } from 'date-fns'
import { localDate } from '@shared/dates'
import {
  MOODS,
  MOOD_DISPLAY_ORDER,
  type Mood,
  type MoodEntry,
  type MoodKey
} from '@shared/mood'
import type { LocalDate } from '@shared/storage'
import MonthGrid
  from '@/components/MonthGrid/MonthGrid.vue'
import MoodPicker
  from '@/components/MoodPicker/MoodPicker.vue'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import { formatDate } from '@/locale/format'
import { wholePercent } from '@/mood/overview'
import { yearInMood } from '@/mood/year'
import { useSelectedDateStore }
  from '@/stores/selected-date'
import { moodColour } from '@/theme/semantic'
import type { PillColours } from '@/theme/types'

// The Dashboard Mood card's size, and the popover's
// distance from its Day Pill and from the card's edges.
const PICKER_W = 356
const PICKER_H = 208
const PICKER_GAP = 8
const PICKER_MARGIN = 10

const store = useSelectedDateStore()
const version = useDataVersion('mood')
const entries = shallowRef<MoodEntry[]>([])
const failed = ref(false)
// Bumped by each load, so a load it overtook is dropped.
let generation = 0

const date = computed(() => localDate(store.day))
const yearStart = computed(() =>
  `${date.value.slice(0, 4)}-01-01`)

const load = async (): Promise<void> => {
  const asked = ++generation
  const result = await window.bulletin.mood.list({
    from: yearStart.value,
    to: date.value
  })
  if (asked !== generation) return
  failed.value = !result.ok
  if (result.ok) entries.value = result.value
}

const moodByKey = new Map<MoodKey, Mood>(
  MOODS.map(mood => [mood.key, mood])
)

const legend = MOOD_DISPLAY_ORDER.map(
  key => moodByKey.get(key)!
)

const byDate = computed(() => {
  const from = yearStart.value
  const to = date.value
  const map = new Map<LocalDate, MoodKey>()
  for (const entry of entries.value) {
    if (entry.date >= from && entry.date <= to)
      map.set(entry.date, entry.mood)
  }
  return map
})

const summary = computed(() =>
  yearInMood(entries.value, date.value))

const headerText = computed(() => {
  const { year, logged, elapsed } = summary.value
  return `${year} · ${logged} of ${elapsed} days logged`
})

const months = computed(() => {
  const { year, months: items } = summary.value
  const currentMonth = store.day.getMonth()
  return items.map(item => {
    const first = new Date(year, item.month, 1)
    return {
      month: item.month,
      date: first,
      name: formatDate(first, 'monthShort'),
      current: item.month === currentMonth,
      happyPercent: item.happyShare === null
        ? null
        : wholePercent(item.happyShare),
      mix: item.mix.map(seg => ({
        ...seg,
        colour: moodColour(moodByKey.get(seg.mood)!)
      }))
    }
  })
})

const moodOf = (day: Date): MoodKey | null =>
  byDate.value.get(localDate(day)) ?? null

const moodFor = (day: Date): Mood | undefined => {
  const key = moodOf(day)
  return key ? moodByKey.get(key) : undefined
}

const label = (day: Date): string =>
  moodFor(day)?.label ?? 'No mood'

const pill = (day: Date): PillColours | undefined => {
  const mood = moodFor(day)
  if (!mood) return undefined
  const colour = moodColour(mood)
  const base =
    `color-mix(in sRGB, ${colour} 85%, transparent)`
  return { base, glow: colour, shadow: colour, tint: colour }
}

const isAfterSelected = (day: Date): boolean =>
  isAfter(day, store.day)

/** The day being edited in the floating picker, if any. */
const editing = shallowRef<Date | null>(null)
const popoverStyle = ref<CSSProperties>({})
// The click that opened the picker on another Day Pill,
// which the outside-click handler must not close it on.
let ignoreClick: Event | null = null

const widget = useTemplateRef<
  InstanceType<typeof Widget>
>('widget')
const popover = useTemplateRef<HTMLElement>('popover')
const picker = useTemplateRef<
  InstanceType<typeof MoodPicker>
>('picker')
const grids = new Map<
  number,
  InstanceType<typeof MonthGrid>
>()

const registerGrid = (month: number, el: unknown): void => {
  if (el && typeof el === 'object' && 'focusDay' in el)
    grids.set(month, el as InstanceType<typeof MonthGrid>)
  else grids.delete(month)
}

const clamp = (
  value: number,
  min: number,
  max: number
): number => Math.min(Math.max(value, min), Math.max(min, max))

const px = (left: number, top: number): CSSProperties => ({
  left: `${Math.round(left)}px`,
  top: `${Math.round(top)}px`
})

// Beside the Day Pill, right if it fits, else left,
// else centred below or above it, kept inside the card.
const placePopover = (day: Date): CSSProperties => {
  const cardEl = widget.value?.$el as HTMLElement | undefined
  const gridEl = grids.get(day.getMonth())?.$el as
    HTMLElement | undefined
  const pillEl = gridEl?.querySelectorAll<HTMLElement>(
    '.pill'
  )[day.getDate() - 1]
  const card = cardEl?.getBoundingClientRect()
  if (!pillEl || !card || card.width === 0)
    return px(PICKER_MARGIN, PICKER_MARGIN)
  const rect = pillEl.getBoundingClientRect()

  const pLeft = rect.left - card.left
  const pRight = rect.right - card.left
  const pTop = rect.top - card.top
  const pBottom = rect.bottom - card.top
  const maxLeft = card.width - PICKER_W - PICKER_MARGIN
  const maxTop = card.height - PICKER_H - PICKER_MARGIN
  const sideTop = clamp(pTop - 16, PICKER_MARGIN, maxTop)

  if (pRight + PICKER_GAP + PICKER_W <= maxLeft + PICKER_W)
    return px(pRight + PICKER_GAP, sideTop)
  if (pLeft - PICKER_GAP - PICKER_W >= PICKER_MARGIN)
    return px(pLeft - PICKER_GAP - PICKER_W, sideTop)
  const left = clamp(
    (pLeft + pRight - PICKER_W) / 2,
    PICKER_MARGIN,
    maxLeft
  )
  const top = pBottom + PICKER_GAP <= maxTop
    ? pBottom + PICKER_GAP
    : clamp(pTop - PICKER_GAP - PICKER_H, PICKER_MARGIN, maxTop)
  return px(left, top)
}

const open = (day: Date): void => {
  if (picker.value?.busy) return
  popoverStyle.value = placePopover(day)
  editing.value = day
}

const close = async (): Promise<void> => {
  const day = editing.value
  editing.value = null
  await nextTick()
  if (day) await grids.get(day.getMonth())?.focusDay(day)
}

const onMonthsClick = (event: MouseEvent): void => {
  if (!editing.value) return
  const target = event.target instanceof Element
    ? event.target.closest('.pill:not(.-disabled)')
    : null
  if (target) ignoreClick = event
}

const onDocumentClick = (event: Event): void => {
  if (event === ignoreClick) {
    ignoreClick = null
    return
  }
  if (!editing.value || picker.value?.busy) return
  if (popover.value
    && event.composedPath().includes(popover.value))
    return
  void close()
}

watch(editing, day => {
  const method = day
    ? 'addEventListener'
    : 'removeEventListener'
  document[method]('click', onDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
})

watch(date, () => {
  editing.value = null
})

watch(
  [date, version],
  () => { void load() },
  { immediate: true }
)
</script>

<template>
  <Widget
    ref="widget"
    class="year-in-mood"
    title="Year in Mood"
    icon="mood"
  >
    <template v-if="!failed" #actions>
      <p class="summary">
        {{ headerText }}
      </p>
    </template>
    <p v-if="failed" class="error" role="alert">
      Couldn’t load Year in Mood.
    </p>
    <div v-else class="content">
      <div class="months" @click="onMonthsClick">
        <section
          v-for="m in months"
          :key="m.month"
          class="month"
          :data-month="m.month"
        >
          <div class="head">
            <h3
              class="name"
              :class="{ '-current': m.current }"
            >
              {{ m.name }}
            </h3>
            <span
              v-if="m.happyPercent !== null"
              class="happy"
            >
              {{ m.happyPercent }}% happy
            </span>
          </div>
          <MonthGrid
            :ref="el => registerGrid(m.month, el)"
            :month="m.date"
            :label="label"
            :pill="pill"
            :disabled="isAfterSelected"
            compact
            @activate="open"
          />
          <div
            v-if="m.mix.length"
            class="mix"
            aria-hidden="true"
          >
            <span
              v-for="seg in m.mix"
              :key="seg.mood"
              class="segment"
              :data-mood="seg.mood"
              :style="{
                flexGrow: seg.share,
                '--mood': seg.colour
              }"
            />
          </div>
        </section>
      </div>
      <footer class="footer">
        <ul class="legend" aria-label="Mood legend">
          <li
            v-for="item in legend"
            :key="item.key"
            class="item"
          >
            <span
              class="dot"
              :style="{ background: moodColour(item) }"
            />
            <span class="label">{{ item.label }}</span>
          </li>
        </ul>
        <p class="hint">
          Click a day to set its Mood
        </p>
      </footer>
    </div>
    <div
      v-if="editing"
      ref="popover"
      class="picker-popover"
      :style="popoverStyle"
    >
      <MoodPicker
        :key="localDate(editing)"
        ref="picker"
        :date="editing"
        :current="moodOf(editing)"
        @saved="close"
        @close="close"
      />
    </div>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.year-in-mood {
  --widget-gap: #{rem(12px)};

  position: relative;

  > .header > .actions > .summary {
    margin: 0 rem(4px) 0 0;
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-widget-title);
  }
}

.year-in-mood {
  > .body > .error {
    padding: 0 rem(4px);
    font-size: rem(11px);
    color: var(--color-text-muted);
  }

  .content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0 rem(4px);
  }

  .months {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-template-rows: repeat(3, minmax(0, 1fr));
    column-gap: rem(19px);
    min-height: 0;
    padding-bottom: rem(14px);
  }

  .month {
    display: flex;
    flex-direction: column;
    min-width: 0;

    > .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      height: rem(12px);
      margin-bottom: rem(6px);
    }

    > .head > .name {
      font-size: rem(10px);
      font-weight: 700;
      line-height: rem(12px);
      text-transform: uppercase;
      color: color-mix(
        in sRGB, var(--color-tile-icon) 50%, transparent
      );

      &.-current {
        color: color-mix(
          in sRGB, var(--color-tile-icon) 90%, transparent
        );
      }
    }

    > .head > .happy {
      font-size: rem(9px);
      font-weight: 700;
      line-height: rem(11px);
      text-transform: uppercase;
      color: var(--color-widget-title);
    }

    > .month-grid {
      flex: none;
      height: rem(85px);
    }

    > .mix {
      display: flex;
      flex: none;
      gap: rem(1px);
      height: rem(4px);
      margin-top: rem(9px);
    }

    > .mix > .segment {
      flex-basis: 0;
      min-width: 0;
      height: 100%;
      background: color-mix(
        in sRGB, var(--mood) 85%, transparent
      );
      border-radius: rem(2px);
    }
  }

  .footer {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    padding-bottom: rem(2px);
  }

  .legend {
    display: flex;
    gap: rem(16px);
    align-items: center;
    margin: 0;
    padding: 0;
    list-style: none;

    > .item {
      display: flex;
      gap: rem(4px);
      align-items: center;
    }

    .dot {
      flex: none;
      width: rem(6px);
      height: rem(6px);
      border-radius: 50%;
    }

    .label {
      font-size: rem(9px);
      font-weight: 700;
      line-height: rem(11px);
      text-transform: uppercase;
      color: color-mix(
        in sRGB, var(--color-tile-icon) 50%, transparent
      );
    }
  }

  .hint {
    font-size: rem(9px);
    font-weight: 700;
    line-height: rem(11px);
    text-transform: uppercase;
    color: var(--color-widget-title);
  }

  .picker-popover {
    position: absolute;
    z-index: 10;
    display: grid;
    grid-template: minmax(0, 1fr) / minmax(0, 1fr);
    width: rem(356px);
    height: rem(208px);
    border: 1px solid var(--color-border);
    border-radius: $radius-large;
    box-shadow: 0 rem(8px) rem(24px) rgb(0 0 0 / 45%);
  }
}
</style>
