/**
 * Types shared by every Tracker's storage API. They
 * describe what crosses the bridge: no database types.
 */

/** A local calendar date, as `YYYY-MM-DD`. */
export type LocalDate = string

/** Days from `from` to `to`, both included. */
export interface DateRange {
  readonly from: LocalDate
  readonly to: LocalDate
}

/**
 * Why a storage operation failed, by machine-readable
 * code:
 * - `invalid-payload`: the payload has the wrong shape
 *   or breaks a rule; `field` names the first bad one;
 * - `future-date`: the Entry is dated after today, or
 *   a Period ends after now;
 * - `not-found`: there's no Entry to change;
 * - `reversed-period`: a Period doesn't end after it
 *   starts;
 * - `period-too-long`: a Period is over 24 hours;
 * - `overlapping-period`: a Period overlaps another;
 * - `internal`: anything unexpected, logged in main.
 */
export type StorageError =
  | {
      readonly code: 'invalid-payload'
      readonly field: string
    }
  | { readonly code: 'future-date' }
  | { readonly code: 'not-found' }
  | { readonly code: 'reversed-period' }
  | { readonly code: 'period-too-long' }
  | { readonly code: 'overlapping-period' }
  | { readonly code: 'internal' }

export type StorageErrorCode = StorageError['code']

/**
 * What every storage operation resolves to: its value,
 * or the error that stopped it. It never rejects.
 */
export type StorageResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: StorageError }
