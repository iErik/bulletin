<script setup lang="ts">
// The Sleep Widget both Pages use: the moon tile, the
// title and the Timeline. Figma's frame sits closer in
// than the shared Widget. `fade` is the Timeline's
// bottom mask; the Sleep Page turns it off. `change`
// re-fires when the Timeline saves, moves or deletes.
import SleepTimeline
  from '@/components/SleepTimeline/SleepTimeline.vue'
import Widget from '@/components/Widget/Widget.vue'

withDefaults(
  defineProps<{
    /** Draws the Timeline's bottom fade. */
    fade?: boolean
  }>(),
  { fade: true }
)

defineEmits<{
  change: []
}>()
</script>

<template>
  <Widget class="sleep" title="Sleep" icon="moon">
    <SleepTimeline
      :fade="fade"
      @change="$emit('change')"
    />
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Figma's Sleep frame sits closer to its edges, with
// its rows 9px below the header.
.widget-frame.sleep {
  --widget-inset: #{rem(7px)};
  --widget-gap: #{rem(9px)};
}
</style>
