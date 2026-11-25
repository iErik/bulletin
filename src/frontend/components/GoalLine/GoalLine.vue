<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  ref,
  useTemplateRef,
  watch
} from 'vue'

const props = defineProps<{
  value: number
  min: number
  max: number
  step: number
  scaleMin: number
  scaleMax: number
  label: string
  ariaLabel: string
  ariaValueText: string
  labelPosition?: 'on' | 'above'
}>()

const emit = defineEmits<{
  preview: [value: number]
  commit: [value: number]
}>()

const root = useTemplateRef<HTMLElement>('root')
const draft = ref(props.value)
const start = ref(props.value)
const dragging = ref(false)

watch(() => props.value, next => {
  if (!dragging.value) draft.value = next
})

const snap = (n: number): number => {
  const stepped = Math.round((n - props.min) / props.step)
    * props.step + props.min
  return Math.min(props.max, Math.max(props.min, stepped))
}

const topPercent = computed(() => {
  const span = props.scaleMax - props.scaleMin
  if (span === 0) return 0
  return ((props.scaleMax - draft.value) / span) * 100
})

const setDraft = (next: number): void => {
  const value = snap(next)
  if (value === draft.value) return
  draft.value = value
  emit('preview', value)
}

const valueAt = (clientY: number): number => {
  const box = root.value?.getBoundingClientRect()
  if (!box || box.height === 0) return draft.value
  return props.scaleMax
    - ((clientY - box.top) / box.height)
      * (props.scaleMax - props.scaleMin)
}

const onMove = (e: PointerEvent): void => {
  setDraft(valueAt(e.clientY))
}

const release = (): void => {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
}

const onUp = (): void => {
  dragging.value = false
  release()
  emit('commit', draft.value)
}

const onDown = (e: PointerEvent): void => {
  if (e.button !== 0) return
  e.preventDefault()
  start.value = props.value
  dragging.value = true
  root.value?.setPointerCapture?.(e.pointerId)
  setDraft(valueAt(e.clientY))
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

const onKey = (e: KeyboardEvent): void => {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    setDraft(
      draft.value + (e.key === 'ArrowUp' ? props.step : -props.step)
    )
    emit('commit', draft.value)
  } else if (e.key === 'Escape' && dragging.value) {
    e.preventDefault()
    draft.value = start.value
    emit('preview', start.value)
    dragging.value = false
    release()
  }
}

onBeforeUnmount(release)
</script>

<template>
  <div
    ref="root"
    class="goal-line"
    :class="{ '-above': labelPosition === 'above' }"
    role="slider"
    tabindex="0"
    :aria-label="ariaLabel"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="draft"
    :aria-valuetext="ariaValueText"
    :style="{ '--goal-top': `${topPercent}%` }"
    @pointerdown="onDown"
    @keydown="onKey"
  >
    <div class="rule" aria-hidden="true">
      <span class="label">{{ label }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/utils' as *;

.goal-line {
  position: absolute;
  inset: 0;
  cursor: ns-resize;
  outline: none;

  @include focus-ring;
}

.rule {
  position: absolute;
  top: var(--goal-top);
  right: 0;
  left: 0;
  display: flex;
  justify-content: flex-end;
  height: 0;
  border-top: 1px dashed var(--color-text-muted);
  transform: translateY(-50%);
  pointer-events: none;
}

.label {
  padding-left: space(2);
  font-family: $font-family-mono;
  font-size: rem(10px);
  color: var(--color-text-muted);
  text-transform: uppercase;
  background: var(--color-surface-raised);
  transform: translateY(-50%);
}

.goal-line.-above > .rule {
  border-top-color: color-mix(
    in sRGB, var(--color-text) 45%, transparent
  );

  > .label {
    position: absolute;
    right: 0;
    bottom: rem(4px);
    padding: 0;
    font-family: inherit;
    font-size: rem(9px);
    font-weight: 700;
    line-height: 1;
    color: color-mix(
      in sRGB, var(--color-tile-icon) 60%, transparent
    );
    background: none;
    transform: none;
  }
}
</style>
