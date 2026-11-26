<script setup lang="ts">
// Task editor popover (Figma 4139:7884): creates a
// Task or edits a Task / Occurrence through `store`.
// Teleported to `body` and placed beside `anchor`.
import {
  computed,
  nextTick,
  onMounted,
  ref,
  useId,
  useTemplateRef
} from 'vue'
import { localDate } from '@shared/dates'
import type { LocalDate } from '@shared/storage'
import Icon from '@/components/Icon/Icon.vue'
import TaskCheckbox
  from '@/components/TaskCheckbox/TaskCheckbox.vue'
import TaskDayPicker
  from '@/components/TaskDayPicker/TaskDayPicker.vue'
import { usePopoverPosition }
  from '@/composables/use-popover-position'
import { formatTime } from '@/locale/format'
import { parseTime, timeText } from '@/tasks/day-choice'
import {
  saveTask,
  taskStore,
  type EditableTask,
  type TaskEditorStore
} from '@/tasks/task-store'

const props = withDefaults(defineProps<{
  task?: EditableTask
  day?: LocalDate | null
  anchor: HTMLElement | null
  someday?: boolean
  store?: TaskEditorStore<EditableTask>
}>(), {
  task: undefined,
  day: undefined,
  someday: true,
  store: undefined
})

const emit = defineEmits<{
  saved: [task: EditableTask]
  deleted: []
  close: []
}>()

const taskId = props.task && 'id' in props.task
  && typeof props.task.id === 'number'
  ? { id: props.task.id }
  : undefined
const activeStore = props.store ?? taskStore(taskId)
const today = new Date()
const todayDay = localDate(today)
const fallback = props.day === undefined ? todayDay : props.day
const startDay = props.task
  ? props.task.day
  : props.someday ? fallback : (fallback ?? todayDay)

const isEdit = Boolean(props.task)
let baseline: EditableTask | undefined = props.task

const title = ref(props.task?.title ?? '')
const plannedDay = ref<LocalDate | null>(startDay)
const timeInput = ref(timeText(props.task?.time ?? null))
const done = ref(Boolean(props.task?.doneAt))
const confirming = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)

const example = formatTime(new Date(2000, 0, 1, 2, 15))
const timeId = useId()
const root = useTemplateRef<HTMLElement>('root')
const titleEl = useTemplateRef<HTMLInputElement>('titleEl')
const timeEl = useTemplateRef<HTMLInputElement>('timeEl')
const deleteEl = useTemplateRef<HTMLButtonElement>('deleteEl')
const cancelDelEl =
  useTemplateRef<HTMLButtonElement>('cancelDelEl')

const { position, update: reposition } = usePopoverPosition(
  root, () => props.anchor, [error, confirming]
)
const canSave = computed(() =>
  !busy.value && title.value.trim().length > 0
)

const clearTime = (): void => {
  timeInput.value = ''
  error.value = null
  timeEl.value?.focus()
}
const close = (): void => {
  if (!busy.value) emit('close')
}

const save = async (): Promise<void> => {
  const trimmed = title.value.trim()
  if (busy.value || !trimmed) return
  const parsed = parseTime(timeInput.value)
  if (parsed === undefined) {
    error.value = `Enter a time like ${example}.`
    return
  }
  error.value = null
  busy.value = true
  const res = await saveTask(activeStore, baseline, {
    title: trimmed,
    day: plannedDay.value,
    time: parsed,
    done: done.value
  })
  busy.value = false
  if (!res.ok) {
    baseline = res.baseline
    error.value = res.message
    return
  }
  baseline = res.value
  if (res.changed) emit('saved', res.value)
  else emit('close')
}

const setConfirm = async (open: boolean): Promise<void> => {
  confirming.value = open
  if (open) error.value = null
  await nextTick()
  ;(open ? cancelDelEl : deleteEl).value?.focus()
}

const confirmDelete = async (): Promise<void> => {
  if (busy.value) return
  busy.value = true
  error.value = null
  const result = await activeStore.remove()
  busy.value = false
  if (!result.ok) error.value = 'Couldn’t delete the task. Try again.'
  else emit('deleted')
}

const onKeydown = (event: KeyboardEvent): void => {
  event.stopPropagation()
  if (event.key === 'Escape') {
    event.preventDefault()
    if (busy.value) return
    if (confirming.value) void setConfirm(false)
    else emit('close')
  } else if (event.key === 'Enter') {
    if (
      event.target instanceof HTMLButtonElement
      || event.target instanceof HTMLSelectElement
    ) return
    event.preventDefault()
    void save()
  }
}

onMounted(() => titleEl.value?.focus())
</script>

<template>
  <Teleport to="body">
    <div class="task-editor-backdrop no-drag" @pointerdown="close" />
    <div
      ref="root"
      class="task-editor no-drag"
      role="dialog"
      :aria-label="isEdit ? 'Edit task' : 'New task'"
      :style="{ left: `${position.left}px`, top: `${position.top}px` }"
      @keydown="onKeydown"
    >
      <div class="head">
        <span class="label">{{ isEdit ? 'Edit task' : 'New task' }}</span>
        <button
          class="icon-btn"
          type="button"
          aria-label="Close"
          :disabled="busy"
          @click="close"
        >
          <Icon name="close" />
        </button>
      </div>
      <div class="field">
        <input
          ref="titleEl"
          v-model="title"
          class="input"
          type="text"
          placeholder="Task title"
          aria-label="Task title"
          autocomplete="off"
          @input="error = null"
        >
      </div>
      <TaskDayPicker
        v-model="plannedDay"
        :today="today"
        :someday="someday"
        @update:model-value="error = null"
        @layout="reposition"
      />
      <div class="time-row">
        <label class="label" :for="timeId">Time</label>
        <div class="field -time">
          <input
            :id="timeId"
            ref="timeEl"
            v-model="timeInput"
            class="input"
            type="text"
            placeholder="any time"
            autocomplete="off"
            :aria-invalid="error !== null"
            @input="error = null"
          >
        </div>
        <button
          v-if="timeInput"
          class="icon-btn"
          type="button"
          aria-label="Clear time"
          @click="clearTime"
        >
          <Icon name="close" />
        </button>
      </div>
      <TaskCheckbox v-model="done" class="done">
        Done
      </TaskCheckbox>
      <p v-if="error" class="error" role="alert">
        {{ error }}
      </p>
      <div v-if="confirming" class="footer">
        <span class="confirm-label">Delete?</span>
        <button
          ref="cancelDelEl"
          class="confirm-btn"
          type="button"
          :disabled="busy"
          @click="setConfirm(false)"
        >
          Cancel
        </button>
        <button
          class="confirm-btn -danger"
          type="button"
          :disabled="busy"
          @click="confirmDelete"
        >
          Delete
        </button>
      </div>
      <div v-else class="footer">
        <button
          v-if="isEdit"
          ref="deleteEl"
          class="delete"
          type="button"
          :disabled="busy"
          @click="setConfirm(true)"
        >
          Delete
        </button>
        <span class="hint" aria-hidden="true">Esc</span>
        <button
          class="save"
          type="button"
          aria-label="Save task"
          :disabled="!canSave"
          @click="save"
        >
          <Icon name="check" />
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.task-editor-backdrop {
  position: fixed;
  inset: 0;
  z-index: 19;
}

// Figma 4139:7884 "Task Editor (proposal)".
.task-editor {
  --te-muted: color-mix(in sRGB, var(--color-tile-icon) 50%, transparent);
  --te-chip: color-mix(in sRGB, var(--color-tile-icon) 80%, transparent);

  position: fixed;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: rem(12px);
  width: rem(316px);
  padding: rem(12px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: $radius-large;
  box-shadow: 0 rem(6px) rem(20px) 0 rgb(0 0 0 / 35%);
  @include colour-transition;

  button,
  input { font-family: inherit; }

  .head,
  .time-row,
  .footer {
    display: flex;
    gap: rem(8px);
    align-items: center;
  }

  .head { justify-content: space-between; }

  .icon-btn,
  .save,
  .confirm-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    @include focus-ring;
  }

  .label {
    font-size: rem(10px);
    font-weight: 700;
    line-height: normal;
    text-transform: uppercase;
    color: var(--te-muted);
  }

  .icon-btn {
    flex: none;
    width: rem(16px);
    height: rem(16px);
    color: var(--te-chip);
    border-radius: $radius-small;

    &:hover:not(:disabled) { color: var(--color-tasks-text); }
  }

  .field {
    padding: rem(2px);
    background: var(--color-surface-raised);
    border-radius: $radius-large;

    &:focus-within {
      outline: 2px solid var(--color-accent);
      outline-offset: 1px;
    }

    > .input {
      display: block;
      width: 100%;
      height: rem(36px);
      padding: 0 rem(12px);
      font-size: rem(13px);
      font-weight: 500;
      color: var(--color-tasks-text);
      background: var(--color-tasks-field);
      border: 0;
      border-radius: rem(10px);
      outline: none;

      &::placeholder { color: var(--te-muted); }
    }

    &.-time {
      flex: none;
      width: rem(96px);

      > .input {
        height: rem(28px);
        font-family: $font-family-mono;
        font-size: rem(11px);
        color: var(--color-stat-value);
      }
    }
  }

  .time-row > .label { margin-right: auto; }

  .done {
    display: flex;
    width: 100%;
    height: rem(34px);
    padding: 0 rem(10px);
    font-size: rem(13px);
    font-weight: 500;
    color: var(--color-tasks-text);
    background: color-mix(in sRGB, var(--color-tasks-accent) 3%, transparent);
    border-radius: rem(5px);
  }

  .error {
    font-size: rem(11px);
    line-height: 1.3;
    color: var(--color-tasks-danger);
  }

  .delete,
  .confirm-label { font-size: rem(13px); }

  .delete {
    font-weight: 500;
    color: color-mix(in sRGB, var(--color-tasks-danger) 85%, transparent);
    border-radius: $radius-small;
    @include focus-ring;
  }

  .confirm-label {
    margin-right: auto;
    font-weight: 700;
    color: var(--color-tasks-danger);
  }

  .hint {
    margin-left: auto;
    font-family: $font-family-mono;
    font-size: rem(10px);
    font-weight: 500;
    color: color-mix(in sRGB, var(--color-tile-icon) 40%, transparent);
  }

  .save {
    flex: none;
    width: rem(28px);
    height: rem(28px);
    color: var(--color-tasks-on-accent);
    background: color-mix(in sRGB, var(--color-tasks-accent) 85%, transparent);
    border-radius: $radius-medium;
    box-shadow: 0 0 rem(8px) 0 color-mix(
      in sRGB, var(--color-tasks-accent) 35%, transparent
    );

    &:disabled {
      cursor: default;
      opacity: 0.35;
      box-shadow: none;
    }
  }

  .confirm-btn {
    height: rem(26px);
    padding: 0 rem(10px);
    font-size: rem(10px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--te-chip);
    background: color-mix(in sRGB, var(--color-tasks-accent) 5%, transparent);
    border-radius: rem(6px);

    &.-danger {
      color: var(--color-tasks-danger);
      background: color-mix(
        in sRGB, var(--color-tasks-danger) 16%, transparent
      );
    }
  }
}
</style>
