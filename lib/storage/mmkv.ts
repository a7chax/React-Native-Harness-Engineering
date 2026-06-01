import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Encryption key for the encrypted MMKV instance.
 *
 * DEMO ONLY: never hardcode an encryption key in a real app. The key itself is a
 * secret — if it ships in your JS bundle, the "encrypted" storage is effectively
 * plain text to anyone who unpacks the app. In production, generate the key once
 * and store it in the device keystore via `react-native-keychain` or
 * `expo-secure-store`, then pass it here at startup.
 *
 * AES-256 requires a 32-byte key (AES-128 allows up to 16 bytes).
 */
export const DEMO_ENCRYPTION_KEY = 'demo-mmkv-encryption-key-32bytes';

/** Plain (unencrypted) storage — appropriate for non-sensitive preferences. */
export const plainStorage: MMKV = createMMKV({ id: 'demo-plain' });

/** Encrypted storage (AES-256) — for sensitive tokens / credentials. */
export const encryptedStorage: MMKV = createMMKV({
  id: 'demo-encrypted',
  encryptionKey: DEMO_ENCRYPTION_KEY,
  encryptionType: 'AES-256',
});
