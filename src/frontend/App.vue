<script setup lang="ts">
import TitleBar from '@/components/TitleBar.vue'
</script>

<template>
  <div class="app-shell">
    <TitleBar />
    <div class="body">
      <!-- The Sidebar's region; BLT-10 fills it. -->
      <aside class="sidebar" />
      <div class="page">
        <RouterView />
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;

  > .body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  // As in the Figma "App Window" frame.
  > .body > .sidebar {
    flex: none;
    width: rem(48px);
    margin-inline: rem(15px);
  }

  > .body > .page {
    flex: 1;
    min-width: 0;
    overflow: auto;
  }
}
</style>
