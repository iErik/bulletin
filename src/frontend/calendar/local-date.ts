import { format } from 'date-fns'
import type { LocalDate } from '@shared/storage'

/** A day as storage writes it: `YYYY-MM-DD`. */
export const toLocalDate = (day: Date): LocalDate =>
  format(day, 'yyyy-MM-dd')
