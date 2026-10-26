import type { PersistStorage } from 'zustand/middleware';

/** Skip transient store updates before JSON serialization or disk access. */
export function skipUnchangedStorage<S>(
  storage: PersistStorage<S>,
  equal: (a: S, b: S) => boolean,
): PersistStorage<S> {
  let previous: { state: S; version?: number } | undefined;
  return {
    getItem: name => storage.getItem(name),
    removeItem: name => { previous = undefined; return storage.removeItem(name); },
    setItem: (name, value) => {
      if (previous && previous.version === value.version && equal(previous.state, value.state)) return;
      previous = value;
      try {
        const result = storage.setItem(name, value);
        return Promise.resolve(result).catch(error => {
          if (previous === value) previous = undefined;
          throw error;
        });
      } catch (error) {
        if (previous === value) previous = undefined;
        throw error;
      }
    },
  };
}
