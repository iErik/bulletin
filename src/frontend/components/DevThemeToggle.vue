<script setup lang="ts">
// Temporary, dev-only control for switching Theme and
// Scheme. Rendered only when `import.meta.env.DEV`.
import { useThemeStore } from '@/stores/theme'
import { themes } from '@/theme/themes'
import {
  SCHEME_PREFERENCES,
  type SchemePreference
} from '@/theme/types'

const store = useThemeStore()

const onTheme = (event: Event) =>
  store.setTheme((event.target as HTMLSelectElement).value)

const onScheme = (event: Event) =>
  store.setPreference(
    (event.target as HTMLSelectElement)
      .value as SchemePreference
  )
</script>

<template>
  <form class="dev-toggle" @submit.prevent>
    <span class="badge">dev</span>
    <label class="field">
      Theme
      <select :value="store.themeId" @change="onTheme">
        <option
          v-for="theme in themes"
          :key="theme.id"
          :value="theme.id"
        >
          {{ theme.name }}
        </option>
      </select>
    </label>
    <label class="field">
      Scheme
      <select
        :value="store.preference"
        @change="onScheme"
      >
        <option
          v-for="value in SCHEME_PREFERENCES"
          :key="value"
          :value="value"
        >
          {{ value }}
        </option>
      </select>
    </label>
  </form>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.dev-toggle {
  display: flex;
  align-items: center;
  gap: space(3);
  padding: space(2) space(3);
  font-size: rem(13px);
  color: var(--color-text-muted);
  background: var(--color-surface-raised);
  border: 1px dashed var(--color-border);
  border-radius: $radius-medium;
  @include colour-transition;

  > .badge {
    padding: 0 space(1);
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-on-accent);
    background: var(--color-accent);
    border-radius: $radius-small;
  }

  > .field {
    display: flex;
    align-items: center;
    gap: space(1);
  }

  > .field > select {
    padding: 0 space(1);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: $radius-small;
    @include focus-ring;
  }
}
</style>
