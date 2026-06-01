/** A single key/value pair to store in MMKV. */
export interface SeedEntry {
  key: string;
  value: string;
}

/**
 * 10 sensitive values written to the ENCRYPTED MMKV instance.
 * These are the kind of values you would never want sitting in plain text on disk.
 */
export const ENCRYPTED_SEED: SeedEntry[] = [
  { key: 'authToken', value: 'eyJhbGciOiJIUzI1NiJ9.demo-access.payload' },
  { key: 'refreshToken', value: 'rt_9f8c2a1b7e4d6f3a0c5b8e2d' },
  { key: 'userId', value: 'usr_10293847' },
  { key: 'sessionId', value: 'sess_a1b2c3d4e5f6a7b8' },
  { key: 'deviceId', value: 'dev_7c9e2f4a8b1d3e6f' },
  { key: 'apiKey', value: 'sk_live_51HxDemoKeyAbc123Xyz' },
  { key: 'pinHash', value: '$2b$10$N9qo8uLOickgx2ZMRZoMye' },
  { key: 'biometricSecret', value: 'bio_4f7a9c2e8d1b6035' },
  { key: 'cardLast4', value: '4242' },
  { key: 'phoneNumber', value: '+628123456789' },
];

/**
 * 10 non-sensitive values written to the PLAIN MMKV instance.
 * Everyday preferences/flags where encryption would be overkill.
 */
export const PLAIN_SEED: SeedEntry[] = [
  { key: 'theme', value: 'dark' },
  { key: 'language', value: 'en-US' },
  { key: 'onboardingDone', value: 'true' },
  { key: 'lastTab', value: 'home' },
  { key: 'fontScale', value: '1.0' },
  { key: 'hapticsEnabled', value: 'true' },
  { key: 'notificationsEnabled', value: 'false' },
  { key: 'currency', value: 'IDR' },
  { key: 'recentSearch', value: 'react native mmkv' },
  { key: 'appVersion', value: '1.0.0' },
];
