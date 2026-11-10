import { join } from 'node:path'

/** The migrations folder, from the project root. */
export const MIGRATIONS_DIR =
  'src/backend/storage/migrations'

export interface PathsInput {
  /** Electron's `app.isPackaged`. */
  readonly packaged: boolean
  /** Electron's `app.getPath('userData')`. */
  readonly userData: string
  /** Electron's `app.getAppPath()`: the project root
   *  in development. */
  readonly appPath: string
  /** Electron's `process.resourcesPath`. */
  readonly resourcesPath: string
}

export interface StoragePaths {
  readonly file: string
  readonly migrationsFolder: string
}

/**
 * Where the database file and the migrations folder
 * are. Development builds use their own file. Packaged
 * builds read migrations from the app's resources,
 * where `electron-builder.yml` copies them.
 */
export const storagePaths = (
  input: PathsInput
): StoragePaths => ({
  file: join(
    input.userData,
    input.packaged ? 'bulletin.db' : 'bulletin-dev.db'
  ),
  migrationsFolder: input.packaged
    ? join(input.resourcesPath, 'migrations')
    : join(input.appPath, MIGRATIONS_DIR)
})
