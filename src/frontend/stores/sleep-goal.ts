import { defineStore } from 'pinia'
import { ref } from 'vue'
import { SLEEP_GOAL_DEFAULT_MINUTES } from '@shared/sleep'

/**
 * The Sleep Goal, in minutes. It starts at 8 hours
 * until `load`, and `failed` is set when that read
 * doesn't succeed. `set` keeps the previous value
 * when main refuses.
 */
export const useSleepGoalStore = defineStore(
  'sleep-goal',
  () => {
    const minutes = ref(SLEEP_GOAL_DEFAULT_MINUTES)
    const failed = ref(false)

    const load = async (): Promise<void> => {
      const result = await window.bulletin.sleep.getGoal()
      failed.value = !result.ok
      if (result.ok) minutes.value = result.value
    }

    const set = async (next: number): Promise<void> => {
      const result = await window.bulletin.sleep.setGoal(next)
      if (result.ok) minutes.value = result.value
    }

    return { minutes, failed, load, set }
  }
)
