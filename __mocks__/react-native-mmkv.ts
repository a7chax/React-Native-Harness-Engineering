/**
 * Jest manual mock for `react-native-mmkv` (v4).
 *
 * v4 eagerly imports `react-native-nitro-modules` — a native module — at
 * module-load time, which throws under Jest (there is no native runtime). The
 * library's built-in `isTest()` guard can't help because the throw happens at
 * import, before any of our code runs.
 *
 * This replaces the whole package with a tiny in-memory implementation so unit
 * tests exercise our storage code without touching native modules. Jest applies
 * it automatically because it sits in `<rootDir>/__mocks__` adjacent to
 * `node_modules`. Encryption is a native concern, so the mock ignores the
 * encryption config and just stores values in a Map (the API is identical).
 */

type StoredValue = boolean | string | number | ArrayBuffer;

function createInMemoryMMKV() {
  const store = new Map<string, StoredValue>();
  return {
    set(key: string, value: StoredValue) {
      store.set(key, value);
    },
    getString(key: string): string | undefined {
      const value = store.get(key);
      return typeof value === 'string' ? value : undefined;
    },
    getNumber(key: string): number | undefined {
      const value = store.get(key);
      return typeof value === 'number' ? value : undefined;
    },
    getBoolean(key: string): boolean | undefined {
      const value = store.get(key);
      return typeof value === 'boolean' ? value : undefined;
    },
    contains(key: string): boolean {
      return store.has(key);
    },
    remove(key: string): boolean {
      return store.delete(key);
    },
    getAllKeys(): string[] {
      return [...store.keys()];
    },
    clearAll(): void {
      store.clear();
    },
  };
}

export function createMMKV() {
  return createInMemoryMMKV();
}
