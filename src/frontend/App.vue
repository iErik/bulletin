<script setup lang="ts">
import Sidebar from '@/components/Sidebar.vue'
import TitleBar from '@/components/TitleBar.vue'
</script>

<template>
  <div class="app-shell">
    <TitleBar />
    <div class="body">
      <div class="sidebar">
        <Sidebar />
      </div>
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

  // As in the Figma "App Window" frame, with the
  // Sidebar vertically centred.
  > .body > .sidebar {
    display: flex;
    flex: none;
    align-items: center;
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
