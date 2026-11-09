<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import Icon from '@/components/Icon.vue'

const { platform } = window.bulletin

// Loaded lazily so production builds drop it entirely.
const DevThemeToggle = import.meta.env.DEV
  ? defineAsyncComponent(
      () => import('@/components/DevThemeToggle.vue')
    )
  : null
</script>

<template>
  <main class="home-view">
    <section class="card">
      <h1 class="title">
        <Icon name="bullet" />
        Bulletin
      </h1>
      <p class="info">
        Platform:
        <strong class="value" data-test="platform">
          {{ platform }}
        </strong>
      </p>
    </section>
    <DevThemeToggle v-if="DevThemeToggle" />
  </main>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.home-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: space(6);
  min-height: 100%;
  padding: space(8);

  > .card {
    padding: space(8) space(10);
    text-align: center;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: $radius-medium;
    @include colour-transition;
  }

  > .card > .title {
    display: flex;
    align-items: center;
    gap: space(2);
    font-size: rem(32px);
  }

  > .card > .info {
    margin-top: space(2);
    color: var(--color-text-muted);
  }

  > .card > .info > .value {
    color: var(--color-text);
  }
}
</style>
