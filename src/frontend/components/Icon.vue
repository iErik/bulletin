<script setup lang="ts">
import { computed, type Component } from 'vue'

const props = defineProps<{
  /** The file name in `icons/`, without `.svg`. */
  name: string
  /**
   * Accessible name. Without one the icon is
   * decorative and hidden from screen readers.
   */
  title?: string
}>()

const files = import.meta.glob<Component>(
  '../icons/*.svg',
  { eager: true, import: 'default', query: '?component' }
)

const icons: Record<string, Component> =
  Object.fromEntries(
    Object.entries(files).map(([path, icon]) => [
      path.slice(path.lastIndexOf('/') + 1, -4),
      icon
    ])
  )

const icon = computed(() => icons[props.name])

const a11y = computed(() =>
  props.title
    ? { role: 'img', 'aria-label': props.title }
    : { 'aria-hidden': 'true' }
)
</script>

<template>
  <component
    :is="icon"
    v-if="icon"
    class="app-icon"
    v-bind="a11y"
  />
</template>

<style lang="scss">
// Drawn in the text's colour. An icon exported from
// Figma at a size keeps it; one without a size is
// sized to the text.
.app-icon {
  display: inline-block;
  color: inherit;
  vertical-align: -0.125em;
  flex-shrink: 0;
}

.app-icon:not([width]) {
  width: 1em;
  height: 1em;
}
</style>
