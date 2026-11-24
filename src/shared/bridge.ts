import type { DataSource } from './data-sources'
import type { ExpensesApi } from './expenses'
import type { HabitsApi } from './habits'
import type { MoodApi } from './mood'
import type { SleepApi } from './sleep'
import type { SleepQualityApi } from './sleep-quality'
import type { TasksApi } from './tasks'
import type { WeightApi } from './weight'

/**
 * Colours of the window controls on Linux and Windows,
 * as CSS colour strings.
 */
export interface WindowControlsColours {
  /** The controls' background (the Title Bar's). */
  readonly background: string
  /** The minimize, maximize and close symbols. */
  readonly symbol: string
}

/**
 * The API the preload script exposes to the renderer
 * through `contextBridge`, as `window[BRIDGE_KEY]`.
 */
export interface BulletinApi {
  /** The OS platform, as Node's `process.platform`. */
  readonly platform: string
  /**
   * Recolours the window controls overlay to match the
   * Title Bar. Does nothing on macOS, whose traffic
   * lights keep their native colours.
   */
  setWindowControlsColours(
    colours: WindowControlsColours
  ): void
  /**
   * Calls `listener` after a bridge write succeeds,
   * with the Data Source that changed. Returns a
   * function to stop listening.
   */
  onDataChange(
    listener: (source: DataSource) => void
  ): () => void
  /** The Weight Tracker's Entries. */
  readonly weight: WeightApi
  /** The Sleep Tracker's Periods. */
  readonly sleep: SleepApi
  /** Sleep Quality ratings, one per day. */
  readonly sleepQuality: SleepQualityApi
  /** The Mood Tracker's Entries. */
  readonly mood: MoodApi
  /** The Habits Tracker's Habits and Entries. */
  readonly habits: HabitsApi
  /**
   * The Expenses Tracker's Transactions, Categories
   * and Budgets.
   */
  readonly expenses: ExpensesApi
  /** One-off Tasks. */
  readonly tasks: TasksApi
}

export const BRIDGE_KEY = 'bulletin'

/** IPC channel behind `setWindowControlsColours`. */
export const WINDOW_CONTROLS_CHANNEL =
  'window-controls:set-colours'

declare global {
  interface Window {
    readonly bulletin: BulletinApi
  }
}
