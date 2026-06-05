import type { MMKV } from 'react-native-mmkv';

import { ENCRYPTED_SEED, PLAIN_SEED, type SeedEntry } from './demoData';
import { encryptedStorage, plainStorage } from './mmkv';

/** Result of seeding: the values read back out of each MMKV instance. */
export interface DemoStorageSnapshot {
  encrypted: SeedEntry[];
  plain: SeedEntry[];
}

/** Write every entry, then read each one back so callers can display what was stored. */
function writeAndReadBack(storage: MMKV, seed: SeedEntry[]): SeedEntry[] {
  for (const { key, value } of seed) {
    storage.set(key, value);
  }
  return seed.map(({ key }) => ({ key, value: storage.getString(key) ?? '' }));
}

/**
 * Seeds both MMKV instances: 10 encrypted entries and 10 plain entries.
 * Returns the values read back from storage (proof the round-trip worked).
 */
export function seedDemoStorage(): DemoStorageSnapshot {
  return {
    encrypted: writeAndReadBack(encryptedStorage, ENCRYPTED_SEED),
    plain: writeAndReadBack(plainStorage, PLAIN_SEED),
  };
}
