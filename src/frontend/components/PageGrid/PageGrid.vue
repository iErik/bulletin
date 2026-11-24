<script setup lang="ts">
// The Page grid the Dashboard and every Tracker Page
// share. Tracks and gaps are the Figma "App Window"
// frame's: at the minimum window size the grid matches
// it, and above that columns widen and rows grow in
// proportion. The date header goes in the Title Bar.
// Named slots are the cells; the default slot is for
// content outside them, such as the dev theme toggle.
import DateHeader
  from '@/components/DateHeader/DateHeader.vue'
</script>

<template>
  <Teleport defer to="#title-bar-content">
    <DateHeader />
  </Teleport>
  <main class="page-grid">
    <div class="wide">
      <slot name="wide" />
    </div>
    <div class="side">
      <slot name="side" />
    </div>
    <div class="left">
      <slot name="left" />
    </div>
    <div class="middle">
      <slot name="middle" />
    </div>
    <div class="right">
      <slot name="right" />
    </div>
    <slot />
  </main>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.page-grid {
  display: grid;
  grid-template:
    'wide wide side' 558fr
    'left middle right' 208fr
    / 356fr 356fr 407fr;
  gap: rem(8px);
  height: 100%;
  padding: 0 rem(15px) rem(15px) 0;

  // A cell stretches its Widget the way the Widget
  // stretched when it was the grid item itself.
  > .wide,
  > .side,
  > .left,
  > .middle,
  > .right {
    display: grid;
    min-width: 0;
    min-height: 0;
  }

  > .wide { grid-area: wide; }
  > .side { grid-area: side; }
  > .left { grid-area: left; }
  > .middle { grid-area: middle; }
  > .right { grid-area: right; }
}
</style>
