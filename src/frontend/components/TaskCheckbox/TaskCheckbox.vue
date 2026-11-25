<script setup lang="ts">
// Shared Task checkbox (Figma 4139:7884 & 3889:8147):
// 14px rounded box with glow when checked, wrapping a
// native checkbox so clicking the box or optional slot
// text toggles it with full keyboard support.
import Icon from '@/components/Icon/Icon.vue'

withDefaults(defineProps<{
  /** Accessible name when no slot label is rendered. */
  label?: string
  disabled?: boolean
}>(), {
  label: undefined,
  disabled: false
})

const checked = defineModel<boolean>({ required: true })
</script>

<template>
  <label
    class="task-checkbox"
    :class="{ '-disabled': disabled }"
  >
    <input
      v-model="checked"
      class="native"
      type="checkbox"
      :aria-label="label"
      :disabled="disabled"
    >
    <span
      class="box"
      :class="{ '-checked': checked }"
      aria-hidden="true"
    >
      <Icon v-if="checked" name="check" />
    </span>
    <slot />
  </label>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma 3889:8147 & 4139:7884 Task checkbox.
.task-checkbox {
  position: relative;
  display: inline-flex;
  gap: rem(10px);
  align-items: center;
  cursor: pointer;

  &.-disabled {
    cursor: default;
    opacity: 0.5;
  }

  > .native {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  > .box {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: rem(14px);
    height: rem(14px);
    color: var(--color-tasks-on-accent);
    border: 1px solid color-mix(
      in sRGB, var(--color-tasks-accent) 30%, transparent
    );
    border-radius: $radius-small;

    &.-checked {
      background: color-mix(
        in sRGB, var(--color-tasks-accent) 85%, transparent
      );
      border-color: transparent;
      box-shadow: 0 0 rem(5px) 0 color-mix(
        in sRGB, var(--color-tasks-accent) 40%, transparent
      );
    }
  }

  &:has(.native:focus-visible) > .box {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
}
</style>
