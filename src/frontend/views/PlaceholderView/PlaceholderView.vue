<script setup lang="ts">
// Stands in for a Page that isn't built yet. A Page's
// own ticket replaces it by giving the Page a view.
defineProps<{ page: string }>()
</script>

<template>
  <main class="placeholder-view">
    <h1 class="title">
      {{ page }}
    </h1>
    <p class="note">
      Coming soon
    </p>
  </main>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.placeholder-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: space(2);
  height: 100%;
  padding: 0 rem(15px) rem(15px) 0;

  > .title {
    font-size: rem(24px);
    font-weight: 600;
    color: var(--color-text);
  }

  > .note {
    color: var(--color-text-muted);
  }
}
</style>
