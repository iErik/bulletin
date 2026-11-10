import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { storagePaths } from './paths'

const input = {
  userData: '/data',
  appPath: '/project',
  resourcesPath: '/app/resources'
}

describe('storagePaths', () => {
  it('uses the dev file and the project folder', () => {
    expect(storagePaths({ ...input, packaged: false }))
      .toEqual({
        file: join('/data', 'bulletin-dev.db'),
        migrationsFolder: join(
          '/project',
          'src/backend/storage/migrations'
        )
      })
  })

  it('uses the app resources once packaged', () => {
    expect(storagePaths({ ...input, packaged: true }))
      .toEqual({
        file: join('/data', 'bulletin.db'),
        migrationsFolder: join(
          '/app/resources',
          'migrations'
        )
      })
  })
})
