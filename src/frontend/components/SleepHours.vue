<script setup lang="ts">
// The Sleep Timeline's hour scales, under the snake and
// as wide as it: a tick on every hour, then the AM row
// from 1:00 to 12:00 and the PM row from 24:00 back to
// 13:00, left to right, each under its hour on the
// snake's rows. Hours are on the Locale's clock.
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef
} from 'vue'
import { formatHour } from '@/locale/format'
import { snakeLayout } from '@/sleep/snake'

const track = useTemplateRef<HTMLElement>('track')
const width = ref(0)

/** Each hour's x: the rows' left end to their right. */
const xs = computed(() => {
  const { left, right } = snakeLayout(width.value)
  const hour = (right - left) / 11
  return Array.from({ length: 12 }, (_, i) => left + i * hour)
})

const rows = computed(() => [
  { name: 'AM', hours: xs.value.map((_, i) => i + 1) },
  { name: 'PM', hours: xs.value.map((_, i) => 24 - i) }
].map(row => ({
  name: row.name,
  labels: row.hours.map((hour, i) => ({
    x: xs.value[i],
    text: formatHour(hour)
  }))
})))

/** Midway between each pair of hours. */
const between = computed(() => xs.value.slice(1)
  .map((x, i) => (x + xs.value[i]) / 2))

const px = (n: number): string => `${n}px`

let observer: ResizeObserver | undefined

onMounted(() => {
  const el = track.value
  if (!el) return
  const measure = (): void => {
    width.value = el.getBoundingClientRect().width
  }
  measure()
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(measure)
  observer.observe(el)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="sleep-hours" aria-hidden="true">
    <div ref="track" class="track -ticks">
      <span
        v-for="x in xs"
        :key="x"
        class="tick"
        :style="{ left: px(x) }"
      />
    </div>
    <template v-for="row in rows" :key="row.name">
      <span class="half">{{ row.name }}</span>
      <div class="track">
        <span
          v-for="label in row.labels"
          :key="label.x"
          class="hour"
          :style="{ left: px(label.x) }"
        >
          {{ label.text }}
        </span>
        <span
          v-for="x in between"
          :key="x"
          class="dots"
          :style="{ left: px(x) }"
        />
      </div>
    </template>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// The label column's width comes from the Timeline, so
// the scales line up with the snake above them.
.sleep-hours {
  display: grid;
  grid-template-columns: var(--sleep-labels, rem(74px)) 1fr;
  row-gap: rem(7px);
  align-items: center;

  // The PM row sits 10px under the AM row.
  > :nth-child(n + 4) { margin-top: rem(3px); }

  > .track {
    position: relative;
    grid-column: 2;
    height: rem(13px);
  }

  > .track.-ticks { height: rem(8px); }

  > .track > .tick {
    position: absolute;
    top: 0;
    width: 1px;
    height: 100%;
    background: var(--color-sleep-tick);
  }

  // Against the scale, as in Figma.
  > .half {
    justify-self: end;
    padding-right: rem(8px);
    font-size: rem(10px);
    font-weight: 600;
    color: var(--color-sleep-half);
  }

  > .track > .hour {
    position: absolute;
    top: 0;
    font-size: rem(11px);
    font-weight: 500;
    line-height: rem(13px);
    white-space: nowrap;
    color: var(--color-sleep-hour);
    transform: translateX(-50%);
  }

  // Three 2px dots, 7px apart.
  > .track > .dots {
    position: absolute;
    top: 50%;
    width: rem(16px);
    height: rem(2px);
    background:
      radial-gradient(
        circle,
        var(--color-sleep-dot) 1px,
        transparent 1px
      )
      -2.5px 0 / 7px 2px repeat-x;
    opacity: 0.32;
    transform: translate(-50%, -50%);
  }
}
</style>
