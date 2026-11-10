import type { z } from 'zod'
import type { StorageError } from '@shared/storage'

/**
 * Thrown by storage operations for an expected failure.
 * The IPC layer turns it into a `StorageError` for the
 * renderer.
 */
export class StorageFailure extends Error {
  constructor(readonly error: StorageError) {
    super(error.code)
    this.name = 'StorageFailure'
  }
}

/**
 * `value` parsed by `schema`, or a `StorageFailure`
 * naming the first invalid field.
 */
export const parse = <T>(
  schema: z.ZodType<T>,
  value: unknown
): T => {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  const [issue] = result.error.issues
  throw new StorageFailure({
    code: 'invalid-payload',
    field: issue?.path.join('.') ?? ''
  })
}
