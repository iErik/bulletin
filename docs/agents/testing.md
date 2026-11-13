# Testing

Tests use [Vitest](https://vitest.dev). One config,
`vitest.config.mts`, defines two projects, and every
script runs both.

## Projects

| Project    | Environment | Tests under                               |
|------------|-------------|-------------------------------------------|
| `renderer` | happy-dom   | `src/frontend/`                           |
| `main`     | Node        | `src/backend/`, `src/shared/`, `scripts/` |

- **`renderer`** has the Vue and SVG plugins, and runs
  `src/frontend/testing/setup.ts` before each file.
  Mount components with `@vue/test-utils`.
- **`main`** has no DOM. Shared code is tested here,
  which also proves it doesn't touch the DOM. Don't
  import Electron at runtime: mock it with
  `vi.mock('electron')`, or move the logic into a
  module without side effects that takes Electron
  objects as parameters (see
  `src/backend/electron/navigation.ts`).
- **`scripts/`** holds the repo's Node scripts, such
  as the release workflow's `next-version.mts`. Their
  tests run in `main`, and `pnpm typecheck` covers
  them (`tsconfig.node.json`).
- Both projects resolve the `@` and `@shared` aliases.
- To add a project, add an entry to `test.projects`
  with `extends: true`, a `name` and its `include`.

## The `window.bulletin` fake

Every renderer test starts with a fake preload API,
installed by the setup file. It lives in
`src/frontend/testing/bulletin.ts`:

- `fakeBulletin(overrides?)` returns a `BulletinApi`
  with test defaults. It's typed against the bridge,
  so it stops compiling when the bridge changes: give
  new members a default there.
- `stubBulletin(overrides?)` installs a fake for the
  current test only:

  ```ts
  stubBulletin({ platform: 'darwin' })
  ```

  Call it before mounting, or before importing a
  module that reads `window.bulletin` when it loads.

After each renderer test, globals are unstubbed
(Vitest's `unstubGlobals`) and `localStorage` is
cleared.

## Scripts

- `pnpm test`: one run of both projects. Exits
  non-zero when any test fails.
- `pnpm test:watch`: reruns affected tests on change.
- `pnpm test:coverage`: one run with a v8 coverage
  report of app source, printed to the terminal. There
  is no threshold.

Pass Vitest flags after the script, for example
`pnpm test --project main` or
`pnpm test --sequence.shuffle`.

## Conventions

- A test file sits next to the code it tests, named
  `<file>.test.ts`.
- Every Vue component, except `App.vue`, lives in its
  own folder named after it, with its unit tests. The
  folder sits where the component belongs:
  `components/`, `views/` or any other directory.

  ```text
  components/SleepSnake/SleepSnake.vue
  components/SleepSnake/SleepSnake.test.ts
  views/DashboardView/DashboardView.vue
  ```

  Import it by its `.vue` file
  (`@/components/SleepSnake/SleepSnake.vue`). Never
  put a component's `.vue` file directly in
  `components/`, `views/` or any other directory.
- Import `describe`, `it`, `expect` and `vi` from
  `vitest`. No globals.
- Test files are covered by `pnpm typecheck`, like any
  other source file.
- Tests don't depend on run order: they must pass with
  `--sequence.shuffle`.
- Modules that hold state at module level are isolated
  with `vi.resetModules()` and a fresh
  `await import()` in each test. No reset functions or
  test-only exports in production code.
- No real network requests, and no file writes outside
  a temp directory (`fs.mkdtemp` under `os.tmpdir()`).
- `pnpm build` and `pnpm typecheck` never run tests.
