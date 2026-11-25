<script setup lang="ts">
// The Recurring Widget (Figma "Expenses / Recurring"):
// the Recurring Expenses as of the Selected Date, by
// amount, in a scrolling list over their monthly total.
import {
  computed,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import { addMonths, startOfMonth } from 'date-fns'
import { localDate } from '@shared/dates'
import type { Transaction } from '@shared/expenses'
import OverlayScrollbar
  from '@/components/OverlayScrollbar/OverlayScrollbar.vue'
import Widget from '@/components/Widget/Widget.vue'
import { useDataVersion }
  from '@/composables/use-data-version'
import { formatAmount } from '@/expenses/money'
import {
  RECURRING_MONTHS,
  recurringCaption,
  recurringExpenses,
  recurringFooter
} from '@/expenses/recurring'
import { useSelectedDateStore }
  from '@/stores/selected-date'

const store = useSelectedDateStore()
const version = useDataVersion('transactions')
const date = computed(() => localDate(store.day))

const transactions =
  shallowRef<readonly Transaction[]>([])
const loaded = ref(false)
const failed = ref(false)
const scroller = useTemplateRef<HTMLElement>('scroller')

// Bumped by each load, so a load a newer one overtook is
// dropped.
let generation = 0

// From the 1st of the month three before the Selected
// Date's, which covers the three months detection looks
// at, through the Selected Date.
const load = async (day: Date): Promise<void> => {
  const asked = ++generation
  const listed = await window.bulletin.expenses.list({
    from: localDate(
      startOfMonth(addMonths(day, -RECURRING_MONTHS))
    ),
    to: localDate(day)
  })
  if (asked !== generation) return
  failed.value = !listed.ok
  if (listed.ok) {
    transactions.value = listed.value
    loaded.value = true
  }
}

watch(
  [date, version],
  () => { void load(store.day) },
  { immediate: true }
)

const recurring = computed(() =>
  recurringExpenses(transactions.value, store.day)
)
</script>

<template>
  <Widget class="recurring-widget" title="Recurring" icon="repeat">
    <template #actions>
      <p class="subtitle">
        Detected
      </p>
    </template>

    <p v-if="failed" class="message" role="alert">
      Couldn’t load recurring expenses.
    </p>
    <p
      v-else-if="loaded && !recurring.expenses.length"
      class="message"
    >
      No recurring expenses detected
    </p>
    <template v-else-if="loaded">
      <div class="view">
        <ul ref="scroller" class="scroller">
          <li
            v-for="expense in recurring.expenses"
            :key="expense.description.toLowerCase()"
            class="row"
          >
            <span class="name">{{ expense.description }}</span>
            <span class="meta">
              {{ recurringCaption(expense) }}
            </span>
            <span class="amount">
              {{ formatAmount(expense.amount) }}
            </span>
          </li>
        </ul>
        <OverlayScrollbar :target="scroller" />
      </div>
      <p class="footer">
        {{ recurringFooter(recurring) }}
      </p>
    </template>
  </Widget>
</template>

<style lang="scss">
@use '@/styles/utils' as *;

.widget-frame.recurring-widget {
  // Figma's list starts 44px from the top, 6px below
  // the header, and its footer ends 8px above the
  // bottom.
  --widget-gap: #{rem(6px)};

  padding-bottom: rem(8px);

  // Figma's "Detected" ends 4px short of the inset.
  > .header > .actions > .subtitle {
    padding-right: rem(4px);
    font-size: rem(13px);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-widget-title);
  }
}

.recurring-widget {
  > .body {
    display: flex;
    flex-direction: column;
  }

  // The list bleeds into the right inset, so the
  // overlay scrollbar sits beside the rows, not on them.
  > .body > .view {
    position: relative;
    display: flex;
    flex: 1;
    min-height: 0;
    margin-right: calc(var(--widget-inset) * -1);
  }

  > .body > .view > .scroller {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: rem(4px);
    min-height: 0;
    padding: rem(2px) var(--widget-inset) 0 0;
    margin: 0;
    list-style: none;
    @include scroller(y);
  }

  .row {
    display: grid;
    flex: none;
    grid-template:
      'name amount' #{rem(15px)}
      'meta amount' #{rem(10px)}
      / minmax(0, 1fr) auto;
    column-gap: rem(10px);
    align-items: start;
    padding: rem(3px) rem(10px);
    background: var(--color-recurring-row);
    border-radius: rem(5px);
  }

  .row > .name,
  .row > .meta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row > .name {
    grid-area: name;
    font-size: rem(12px);
    font-weight: 500;
    line-height: rem(15px);
    color: var(--color-text);
  }

  .row > .meta {
    grid-area: meta;
    font-size: rem(8px);
    font-weight: 700;
    line-height: rem(10px);
    text-transform: uppercase;
    color: var(--color-recurring-meta);
  }

  .row > .amount {
    grid-area: amount;
    align-self: center;
    font-family: $font-family-mono;
    font-size: rem(10px);
    font-weight: 500;
    white-space: nowrap;
    color: var(--color-recurring-amount);
  }

  // The empty and error states take the footer's type,
  // where the list would start.
  > .body > .footer,
  > .body > .message {
    flex: none;
    padding-left: rem(3px);
    font-size: rem(9px);
    font-weight: 700;
    line-height: rem(10px);
    text-transform: uppercase;
    color: var(--color-recurring-footer);
  }

  > .body > .footer { margin-top: rem(4px); }
  > .body > .message { padding-top: rem(2px); }
}
</style>
