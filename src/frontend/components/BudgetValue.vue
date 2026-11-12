<script setup lang="ts">
// The Budget card's value, edited in place. Clicking
// it, or the dash with no Budget, turns it into an
// input. Enter or clicking away saves it as `month`'s
// own Budget through storage and emits `saved`;
// Escape cancels. Clicking away without typing just
// closes. A negative or invalid amount isn't saved:
// on Enter the input stays with an inline error, and
// clicking away reverts and shows it. A storage error
// reverts and shows inline. While a save is under way
// the input holds, ignoring keys and clicks away.
import { nextTick, ref, useTemplateRef } from 'vue'
import { format } from 'date-fns'
import type { Budget } from '@shared/expenses'
import { amountText, parseAmount } from '@/expenses/amount'
import { formatAmount } from '@/expenses/money'

const props = defineProps<{
  /** The month's Budget, maybe carried forward. */
  budget: Budget | null
  /** The first of the month shown. */
  month: Date
}>()

const emit = defineEmits<{
  saved: [budget: Budget]
}>()

const editing = ref(false)
const text = ref('')
/** Whether anything was typed since opening. */
const typed = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const field = useTemplateRef<HTMLInputElement>('field')
const button = useTemplateRef<HTMLButtonElement>('button')

const open = async (): Promise<void> => {
  const { budget } = props
  text.value = budget ? amountText(budget.amount) : ''
  typed.value = false
  error.value = null
  editing.value = true
  await nextTick()
  field.value?.focus()
  field.value?.select()
}

/** Back to the value; `refocus` moves focus to it. */
const close = async (refocus: boolean): Promise<void> => {
  editing.value = false
  if (!refocus) return
  await nextTick()
  button.value?.focus()
}

/** The typed amount, or why it can't be a Budget. */
const typedAmount = (): number | string => {
  const amount = parseAmount(text.value)
  if (amount === null)
    return `Enter an amount like ${amountText(123_456)}.`
  return amount < 0
    ? 'The Budget can’t be negative.'
    : amount
}

/** Saves a valid amount; `fromKey` if Enter asked. */
const save = async (fromKey: boolean): Promise<void> => {
  const amount = typedAmount()
  if (typeof amount === 'string') {
    error.value = amount
    if (!fromKey) void close(false)
    return
  }
  const month = format(props.month, 'yyyy-MM')
  const { budget } = props
  if (budget?.month === month
    && budget.amount === amount)
    return close(fromKey)
  busy.value = true
  const result = await window.bulletin.expenses
    .setBudget({ month, amount })
  busy.value = false
  if (result.ok) emit('saved', result.value)
  else error.value = 'Couldn’t save the Budget.'
  await close(fromKey)
}

const onKeydown = (event: KeyboardEvent): void => {
  // Keeps the keys from the Widget and the date header.
  event.stopPropagation()
  if (event.key !== 'Enter' && event.key !== 'Escape')
    return
  event.preventDefault()
  if (busy.value) return
  if (event.key === 'Enter') void save(true)
  else {
    error.value = null
    void close(true)
  }
}

const onBlur = (): void => {
  if (!editing.value || busy.value) return
  if (typed.value) void save(false)
  else void close(false)
}

const onInput = (): void => {
  typed.value = true
  error.value = null
}
</script>

<template>
  <div class="budget-value">
    <input
      v-if="editing"
      ref="field"
      v-model="text"
      class="value -field"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      aria-label="Budget"
      :placeholder="amountText(0)"
      :readonly="busy"
      :aria-invalid="error !== null"
      @input="onInput"
      @keydown="onKeydown"
      @blur="onBlur"
    >
    <button
      v-else-if="budget"
      ref="button"
      class="value"
      type="button"
      @click="open"
    >
      {{ formatAmount(budget.amount) }}
    </button>
    <button
      v-else
      ref="button"
      class="value"
      type="button"
      aria-label="Set budget"
      @click="open"
    >
      —
    </button>
    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>
  </div>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.budget-value {
  min-width: 0;

  > .value {
    display: block;
    width: 100%;
    padding: 0;
    overflow: hidden;
    font-family: $font-family-mono;
    font-size: rem(11px);
    font-weight: 500;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text);
    border-radius: rem(2px);
    @include focus-ring;
  }

  > .value.-field {
    background: color-mix(
      in sRGB,
      var(--color-text) 8%,
      transparent
    );

    &::placeholder { color: var(--color-text-muted); }
  }

  > .error {
    margin-top: rem(2px);
    font-size: rem(9px);
    color: var(--color-danger);
  }
}
</style>
