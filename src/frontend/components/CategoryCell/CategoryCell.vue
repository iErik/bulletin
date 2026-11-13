<script setup lang="ts">
// A Transaction's Category chip in the Expense table.
// Clicking it opens a popover like Notion's tags field:
// a text field over the Categories as chips, which
// typing filters. Enter picks the highlighted one, or
// creates the typed name when nothing matches it; the
// arrow keys move the highlight, and clicking a chip
// picks it. Escape, a click outside or moving focus
// out closes it without a change. Focus returns to the
// chip when it closes. The popover is placed on the
// viewport, so the table's scrolling box can't clip it.
import {
  computed,
  nextTick,
  ref,
  useId,
  useTemplateRef,
  watch,
  type CSSProperties
} from 'vue'
import type { Category } from '@shared/expenses'
import Tooltip from '@/components/Tooltip/Tooltip.vue'
import {
  type CategoryChoice,
  categoryChoices
} from '@/expenses/categories'

const props = defineProps<{
  /** The chosen Category, or null for none yet. */
  category: Category | null
  categories: readonly Category[]
}>()

const emit = defineEmits<{
  choose: [choice: CategoryChoice]
}>()

const id = useId()
const isOpen = ref(false)
const query = ref('')
const highlight = ref(0)
const place = ref<CSSProperties>({})
const button = useTemplateRef<HTMLButtonElement>('button')
const popover = useTemplateRef<HTMLElement>('popover')
const field = useTemplateRef<HTMLInputElement>('field')

const name = computed(() => props.category?.name ?? '')

const choices = computed(() =>
  categoryChoices(props.categories, query.value))

watch(query, () => {
  highlight.value = 0
})

const open = async (): Promise<void> => {
  const rect = button.value?.getBoundingClientRect()
  if (rect) {
    place.value = {
      top: `${rect.bottom}px`,
      left: `${rect.left}px`
    }
  }
  query.value = ''
  highlight.value = 0
  isOpen.value = true
  await nextTick()
  field.value?.focus()
}

const close = async (refocus: boolean): Promise<void> => {
  if (!isOpen.value) return
  isOpen.value = false
  if (!refocus) return
  await nextTick()
  button.value?.focus()
}

const choose = (choice: CategoryChoice): void => {
  emit('choose', choice)
  void close(true)
}

/** Moves the highlight by `step`, wrapping around. */
const move = (step: number): void => {
  const count = choices.value.length
  if (count === 0) return
  highlight.value = (highlight.value + step + count) % count
}

const onKeydown = (event: KeyboardEvent): void => {
  // Keeps the keys from the table and the date header.
  event.stopPropagation()
  const highlighted = choices.value[highlight.value]
  if (event.key === 'ArrowDown') move(1)
  else if (event.key === 'ArrowUp') move(-1)
  else if (event.key === 'Escape') void close(true)
  else if (event.key === 'Enter' && highlighted)
    choose(highlighted)
  else return
  event.preventDefault()
}

const onFocusout = (event: FocusEvent): void => {
  const next = event.relatedTarget
  if (next instanceof Node && popover.value?.contains(next))
    return
  // A click outside closes through the backdrop.
  if (next !== null) void close(false)
}

const label = (choice: CategoryChoice): string =>
  choice.kind === 'pick' ? choice.category.name : choice.name
</script>

<template>
  <span class="category-cell">
    <Tooltip :text="name" placement="above" truncated-only>
      <button
        ref="button"
        class="chip"
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="isOpen"
        :aria-label="category ? undefined : 'Choose a Category'"
        @click="open"
      >
        {{ name }}
      </button>
    </Tooltip>
    <template v-if="isOpen">
      <div class="backdrop" @pointerdown="close(false)" />
      <div
        ref="popover"
        class="popover"
        role="dialog"
        aria-label="Category"
        :style="place"
        @keydown="onKeydown"
        @focusout="onFocusout"
      >
        <label class="prompt" :for="`${id}-field`">
          Select an option or create one:
        </label>
        <input
          :id="`${id}-field`"
          ref="field"
          v-model="query"
          class="field"
          type="text"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          :aria-controls="`${id}-list`"
          :aria-activedescendant="choices.length > 0
            ? `${id}-${highlight}`
            : undefined"
        >
        <ul
          :id="`${id}-list`"
          class="options"
          role="listbox"
          aria-label="Categories"
        >
          <li
            v-for="(choice, i) in choices"
            :id="`${id}-${i}`"
            :key="choice.kind === 'pick'
              ? choice.category.id
              : 'create'"
            class="option"
            :class="{ '-active': i === highlight }"
            role="option"
            :aria-selected="i === highlight"
            @pointerdown.prevent
            @pointermove="highlight = i"
            @click="choose(choice)"
          >
            <span v-if="choice.kind === 'create'" class="create">
              Create
            </span>
            <span class="chip">{{ label(choice) }}</span>
          </li>
        </ul>
      </div>
    </template>
  </span>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.category-cell {
  $tint: color-mix(
    in sRGB,
    var(--color-text) 8%,
    transparent
  );

  .chip {
    min-width: 0;
    max-width: rem(95px);
    padding: rem(6px) rem(11px);
    overflow: hidden;
    font-size: rem(10px);
    font-weight: 700;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
    color: inherit;
    background: $tint;
    border-radius: rem(12px);
  }

  .app-tooltip > .chip { @include focus-ring; }

  // Room for a chip's height while it has no name.
  .app-tooltip > .chip:empty {
    min-width: rem(40px);
    min-height: rem(24px);
  }

  > .backdrop {
    position: fixed;
    inset: 0;
    z-index: 9;
  }

  // A raised panel below the chip, over the table.
  > .popover {
    position: fixed;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: space(1);
    width: rem(220px);
    padding: space(2);
    color: var(--color-text-muted);
    white-space: normal;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: $radius-medium;
    transform: translateY(#{space(1)});
    @include colour-transition;
  }

  .prompt { font-size: rem(11px); }

  .field {
    width: 100%;
    padding: rem(4px) rem(6px);
    font: inherit;
    font-size: rem(12px);
    color: var(--color-text);
    background: $tint;
    border-radius: rem(4px);
    @include focus-ring;
  }

  .options {
    max-height: rem(180px);
    padding: 0;
    margin: 0;
    overflow-y: auto;
    list-style: none;
  }

  .option {
    display: flex;
    gap: space(1);
    align-items: center;
    padding: rem(4px);
    font-size: rem(11px);
    cursor: pointer;
    border-radius: rem(4px);

    &.-active { background: $tint; }
  }
}
</style>
