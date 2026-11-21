/** Minimal external store compatible with React's `useSyncExternalStore`. */
export interface Store<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}

export interface WritableStore<T> extends Store<T> {
  set(next: T): void;
  update(fn: (current: T) => T): void;
}

export function createStore<T>(initial: T): WritableStore<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  const set = (next: T) => {
    if (Object.is(next, state)) return;
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set,
    update: (fn) => {
      set(fn(state));
    },
  };
}
