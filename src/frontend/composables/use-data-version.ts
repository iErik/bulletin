/**
 * Reactive counter that increments whenever any of the
 * named Data Sources changes through the bridge. Watch
 * it to reload a Widget when another Widget writes.
 */
import {
  onScopeDispose,
  readonly,
  ref,
  type Ref
} from 'vue'
import type { DataSource } from '@shared/data-sources'

export const useDataVersion = (
  ...sources: DataSource[]
): Readonly<Ref<number>> => {
  const version = ref(0)
  const watched = new Set(sources)
  const stop = window.bulletin.onDataChange(source => {
    if (watched.has(source)) version.value += 1
  })
  onScopeDispose(stop)
  return readonly(version)
}
