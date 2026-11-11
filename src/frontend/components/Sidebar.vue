<script setup lang="ts">
// The Sidebar: one icon link per Page, in the Page
// list's order, with the current Page highlighted.
import { useRoute } from 'vue-router'
import Icon from '@/components/Icon.vue'
import Tooltip from '@/components/Tooltip.vue'
import { isPageActive, PAGES } from '@/pages'

const route = useRoute()
</script>

<template>
  <nav class="app-sidebar" aria-label="Pages">
    <ul class="items">
      <li v-for="page in PAGES" :key="page.name">
        <Tooltip :text="page.label">
          <RouterLink
            v-slot="{ href, navigate }"
            custom
            :to="page.path"
          >
            <a
              class="link"
              :href="href"
              :aria-label="page.label"
              :aria-current="
                isPageActive(page, route.path)
                  ? 'page'
                  : undefined
              "
              @click="navigate"
            >
              <Icon :name="page.icon" />
            </a>
          </RouterLink>
        </Tooltip>
      </li>
    </ul>
  </nav>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

// Sizes and spacing are the Figma Sidebar frame's.
.app-sidebar {
  padding-block: rem(7px);
  background: var(--color-surface-raised);
  border-radius: rem(14px);
  @include colour-transition;

  > .items {
    display: flex;
    flex-direction: column;
    gap: rem(19px);
    padding-inline: rem(6px);
  }

  .link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: rem(36px);
    height: rem(36px);
    font-size: rem(24px);
    color: var(--color-text-muted);
    border-radius: rem(6px);
    @include colour-transition;
    @include focus-ring;

    &:hover {
      color: var(--color-text);
      background: color-mix(
        in sRGB,
        var(--color-border) 50%,
        transparent
      );
    }

    &[aria-current='page'] {
      color: var(--color-text);
      background: var(--color-border);
    }
  }
}
</style>
