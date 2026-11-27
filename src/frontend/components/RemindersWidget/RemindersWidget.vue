<script setup lang="ts">
// Reminders (Figma 3889:8162): the Reminders due in
// the next 7 days, soonest first, in a vertical
// timeline; the soonest gets the bright dot. Clicking a
// Task entry opens its Task in the editor; Occurrence
// entries are shown but not interactive. The window is
// real time, ignoring the Selected Date.
import {
  computed,
  onBeforeUnmount,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import Icon from '@/components/Icon/Icon.vue'
import OverlayScrollbar
  from '@/components/OverlayScrollbar/OverlayScrollbar.vue'
import TaskEditor
  from '@/components/TaskEditor/TaskEditor.vue'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import { formatReminderText } from '@shared/reminders'
import type { Task } from '@shared/tasks'
import {
  reminderLabel,
  reminderWindow
} from '@/tasks/reminders'

interface Entry {
  readonly id: string
  readonly task: Task | null
  readonly dueAt: number
  readonly label: string
  readonly text: string
}

const version = useDataVersion('tasks')
const entries = shallowRef<readonly Entry[]>([])
const loaded = ref(false)
const failed = ref(false)
const scroller = useTemplateRef<HTMLElement>('scroller')

// The Task being edited, with its entry as anchor.
const editing = ref<{
  task: Task
  anchor: HTMLElement
} | null>(null)

let generation = 0

const load = async (): Promise<void> => {
  const asked = ++generation
  const now = new Date()
  const { from, to } = reminderWindow(now)
  const result = await window.bulletin.reminders.listDue({ from, to })
  if (asked !== generation) return
  if (!result.ok) {
    failed.value = true
    loaded.value = true
    return
  }
  failed.value = false
  loaded.value = true
  entries.value = result.value.map(r => {
    const isTask = r.kind === 'task'
    return {
      id: isTask
        ? `task-${r.task.id}`
        : `occurrence-${r.occurrence.ruleId}-${r.occurrence.scheduled}`,
      task: isTask ? r.task : null,
      dueAt: r.dueAt,
      label: reminderLabel(r.dueAt, now),
      text: formatReminderText(
        isTask ? r.task.title : r.occurrence.title,
        r.offset
      )
    }
  })
}

watch(
  () => version.value,
  () => { void load() },
  { immediate: true }
)

// Re-check the window as time passes, so a Reminder
// whose moment passed leaves the list.
const timer = setInterval(
  () => { void load() },
  60_000
)
onBeforeUnmount(() => clearInterval(timer))

const empty = computed((): boolean =>
  loaded.value && !failed.value && entries.value.length === 0)

const open = (
  entry: Entry,
  anchor: HTMLElement | null
): void => {
  if (!entry.task || !anchor) return
  editing.value = { task: entry.task, anchor }
}

const close = (): void => {
  editing.value = null
}

const onKeydown = (
  entry: Entry,
  anchor: HTMLElement | null,
  event: KeyboardEvent
): void => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  open(entry, anchor)
}
</script>

<template>
  <Widget
    class="reminders-widget"
    title="Reminders"
    icon="bell"
  >
    <template #actions>
      <p class="subtitle">
        Next 7 days
      </p>
    </template>

    <p v-if="failed" class="message" role="alert">
      Couldn’t load Reminders.
    </p>
    <p v-else-if="empty" class="message">
      No reminders due
    </p>
    <template v-else-if="loaded">
      <div class="view">
        <ul ref="scroller" class="scroller">
          <li
            v-for="(entry, index) in entries"
            :key="entry.id"
            class="entry"
            :class="{ occurrence: !entry.task }"
            :data-soonest="index === 0"
            :tabindex="entry.task ? 0 : undefined"
            :role="entry.task ? 'button' : undefined"
            :aria-label="entry.task
              ? `${entry.label}: ${entry.text}`
              : undefined"
            @click="open(entry, $event.currentTarget as HTMLElement)"
            @keydown="onKeydown(
              entry, $event.currentTarget as HTMLElement, $event)"
          >
            <span class="dot" aria-hidden="true" />
            <span class="label">{{ entry.label }}</span>
            <span class="text">{{ entry.text }}</span>
            <Icon name="bell" class="bell" />
          </li>
        </ul>
        <OverlayScrollbar :target="scroller" />
      </div>
    </template>

    <TaskEditor
      v-if="editing"
      :task="editing.task"
      :anchor="editing.anchor"
      @close="close"
      @saved="close"
      @deleted="close"
    />
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.reminders-widget {
  // Figma's first entry starts 6px below the header.
  --widget-gap: #{rem(6px)};

  // Figma's "Next 7 days" ends 4px short of the inset.
  > .header > .actions > .subtitle {
    padding-right: rem(4px);
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--color-widget-title);
  }
}

.reminders-widget {
  > .body {
    display: flex;
    flex-direction: column;
  }

  // The list bleeds into the right inset, so the
  // overlay scrollbar sits beside the entries, not on them.
  > .body > .view {
    position: relative;
    display: flex;
    flex: 1;
    min-height: 0;
    margin-right: calc(var(--widget-inset) * -1);
  }

  > .body > .message {
    padding-left: rem(3px);
    font-size: rem(9px);
    font-weight: 700;
    line-height: rem(10px);
    text-transform: uppercase;
    color: var(--color-widget-title);
  }

  .scroller {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: rem(2px) var(--widget-inset) 0 rem(28px);
    margin: 0;
    list-style: none;
    @include scroller(y);
  }

  .entry {
    position: relative;
    min-height: rem(36px);
    padding: rem(4px) rem(30px) 0 0;
    cursor: pointer;
    @include focus-ring;

    &.occurrence {
      cursor: default;
    }

    // The timeline's spine: one segment per entry, so
    // it scrolls with the list. The first starts at its
    // dot, the last ends at its.
    &::before {
      content: '';
      position: absolute;
      left: rem(-16px);
      top: 0;
      bottom: 0;
      width: 1px;
      background: rgb(255 255 255 / 10%);
    }

    &:first-child::before { top: rem(13px); }

    &:last-child::before {
      bottom: auto;
      height: rem(13px);
    }

    .dot {
      position: absolute;
      left: rem(-20px);
      top: rem(9px);
      width: rem(9px);
      height: rem(9px);
      border-radius: 50%;
      background: color-mix(
        in sRGB, var(--color-text) 35%, transparent
      );
    }

    &[data-soonest='true'] .dot {
      background: var(--color-text);
      box-shadow: 0 0 rem(6px) color-mix(
        in sRGB, var(--color-text) 70%, transparent
      );
    }

    .label {
      display: block;
      font-size: rem(9px);
      font-weight: 700;
      line-height: rem(11px);
      text-transform: uppercase;
      color: color-mix(
        in sRGB, var(--color-tile-icon) 40%, transparent
      );
    }

    &[data-soonest='true'] .label {
      color: color-mix(
        in sRGB, var(--color-tile-icon) 80%, transparent
      );
    }

    .text {
      display: block;
      margin-top: rem(2px);
      font-size: rem(12px);
      font-weight: 500;
      line-height: rem(15px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--color-tasks-text);
    }

    .bell {
      position: absolute;
      right: rem(12px);
      top: rem(12px);
      width: rem(11px);
      height: rem(11px);
      color: var(--color-tile-icon);
      opacity: 0.85;
    }
  }
}
</style>
