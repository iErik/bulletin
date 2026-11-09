<script setup lang="ts">
import { computed, type Component } from 'vue'

const props = defineProps<{
  /** The file name in `icons/`, without `.svg`. */
  name: string
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
</script>

<template>
  <component
    :is="icon"
    v-if="icon"
    class="app-icon"
    aria-hidden="true"
  />
</template>

<style lang="scss">
// Sized to the text and drawn in its colour.
.app-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  color: inherit;
  vertical-align: -0.125em;
  flex-shrink: 0;
}
</style>
