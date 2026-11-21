import { useSyncExternalStore } from 'react';
import type { Store } from '../engine';

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
