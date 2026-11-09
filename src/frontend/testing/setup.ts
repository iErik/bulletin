import { afterEach, beforeEach } from 'vitest'
import { stubBulletin } from './bulletin'

// Runs around every renderer test. Vitest's
// `unstubGlobals` option undoes the stub afterwards.
beforeEach(() => {
  stubBulletin()
})

afterEach(() => {
  localStorage.clear()
})
