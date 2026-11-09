<script setup lang="ts">
import TitleBar from '@/components/TitleBar.vue'
</script>

<template>
  <div class="app-shell">
    <TitleBar />
    <div class="page">
      <RouterView />
    </div>
  </div>
</template>

<style lang="scss">
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;

  > .page {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
}
</style>
