<script setup lang="ts">
// The frame every Tracker's Widget shares, as in Figma:
// a titled panel with its icon in a tile before the
// title, whose body is the default slot, with optional
// header buttons in the `actions` slot. The Dashboard
// places Widgets by class, so a Widget sets no outer
// size or position of its own. A Widget's frame sets
// `--widget-inset` (its padding, 10px by default),
// `--widget-gap` (from the header to the body, 0) and
// `--widget-icon-size` (12px) where Figma differs.
import Icon from '@/components/Icon/Icon.vue'

defineProps<{
  title: string
  /** Its icon's file name in `icons/`. */
  icon: string
}>()
</script>

<template>
  <section class="widget-frame">
    <header class="header">
      <span class="tile">
        <Icon class="icon" :name="icon" />
      </span>
      <h2 class="title">
        {{ title }}
      </h2>
      <div v-if="$slots.actions" class="actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="body">
      <slot />
    </div>
  </section>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame {
  --widget-inset: #{rem(10px)};
  --widget-gap: 0;
  --widget-icon-size: #{rem(12px)};

  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: var(--widget-inset);
  background: var(--color-surface-raised);
  border-radius: $radius-large;
  @include colour-transition;

  > .header {
    display: flex;
    align-items: center;
    gap: rem(10px);
  }

  > .header > .tile {
    display: grid;
    flex: none;
    place-items: center;
    width: rem(28px);
    height: rem(28px);
    color: var(--color-tile-icon);
    background: var(--color-tile);
    border-radius: rem(6px);
  }

  > .header > .tile > .icon {
    width: var(--widget-icon-size);
    height: var(--widget-icon-size);
  }

  > .header > .title {
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-widget-title);
  }

  > .header > .actions {
    display: flex;
    gap: rem(10px);
    margin-left: auto;
  }

  > .body {
    flex: 1;
    min-height: 0;
    margin-top: var(--widget-gap);
  }
}
</style>
