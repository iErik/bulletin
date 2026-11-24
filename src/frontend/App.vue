<script setup lang="ts">
import { useTemplateRef } from 'vue'
import OverlayScrollbar
  from '@/components/OverlayScrollbar/OverlayScrollbar.vue'
import Sidebar from '@/components/Sidebar/Sidebar.vue'
import TitleBar from '@/components/TitleBar/TitleBar.vue'

const scroller = useTemplateRef<HTMLElement>('scroller')
</script>

<template>
  <div class="app-shell">
    <TitleBar />
    <div class="body">
      <div class="sidebar">
        <Sidebar />
      </div>
      <div class="page">
        <div ref="scroller" class="scroller">
          <RouterView />
        </div>
        <OverlayScrollbar :target="scroller" />
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

  // The frame. The scroller fills it, so a view
  // with height: 100% still fills the Page.
  > .body > .page {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  > .body > .page > .scroller {
    height: 100%;
    @include scroller(both);
  }
}
</style>
