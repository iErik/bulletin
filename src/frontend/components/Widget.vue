<script setup lang="ts">
// The frame every Tracker's Widget shares: a titled
// panel whose body is the default slot. The Dashboard
// places Widgets by class, so a Widget sets no outer
// size or position of its own.
defineProps<{ title: string }>()
</script>

<template>
  <section class="widget-frame">
    <header class="header">
      <h2 class="title">
        {{ title }}
      </h2>
    </header>
    <div class="body">
      <slot />
    </div>
  </section>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: space(2);
  background: var(--color-surface-raised);
  border-radius: $radius-medium;
  @include colour-transition;

  > .header {
    display: flex;
    align-items: center;
    gap: space(2);
    min-height: space(8);
  }

  > .header > .title {
    font-size: rem(13px);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  > .body {
    flex: 1;
    min-height: 0;
  }
}
</style>
