<script setup lang="ts">
// The Title Bar: a full-width strip at the top of the
// window that drags it and keeps the window controls
// clear. Its content area, centred on the window, takes
// the default slot or a `<Teleport defer>` to
// `#title-bar-content` (BLT-9's date header). Mark
// interactive elements in it with the global `no-drag`
// class so they stay clickable.
import {
  controlsSide,
  MAC_CONTROLS_INSET,
  TITLE_BAR_HEIGHT
} from '@shared/title-bar'

const { platform } = window.bulletin
const side = controlsSide(platform)

// The overlay's width on Linux and Windows, from the
// window controls overlay's CSS environment variables.
const OVERLAY_INSET =
  'calc(100vw - env(titlebar-area-x, 0px)'
  + ' - env(titlebar-area-width, 100vw))'

// Exposed as custom properties for the Title Bar's
// content to size itself against.
const style = {
  '--title-bar-height': `${TITLE_BAR_HEIGHT}px`,
  '--title-bar-controls': side === 'left'
    ? `${MAC_CONTROLS_INSET}px`
    : OVERLAY_INSET
}
</script>

<template>
  <header
    class="title-bar"
    :data-controls="side"
    :style="style"
  >
    <div id="title-bar-content" class="content">
      <slot />
    </div>
  </header>
</template>

<style lang="scss">
.title-bar {
  // Keeps the controls' width clear on both sides, so
  // the slot is centred on the window and never sits
  // under the controls.
  flex: none;
  display: flex;
  align-items: center;
  height: var(--title-bar-height);
  padding-inline: var(--title-bar-controls);
  -webkit-app-region: drag;
  user-select: none;

  > .content {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: 100%;
  }
}
</style>
