#!/usr/bin/env node
/**
 * Decrypt + read an ENCRYPTED react-native-mmkv instance offline, given its data
 * file, its `.crc` meta file, and the encryption key.
 *
 * Usage:
 *   node scripts/read-mmkv-encrypted.mjs <data-file> <crc-file> [encryptionKey]
 *
 * Example (defaults to the demo key from lib/storage/mmkv.ts):
 *   node scripts/read-mmkv-encrypted.mjs \
 *     mmkv-stored/demo-encrypted mmkv-stored/demo-encrypted.crc
 *
 * How it works
 * ------------
 * MMKV encrypts with AES-CFB128. The AES IV is NOT in the data file — it lives
 * in the companion `.crc` meta file. The relevant meta layout (Tencent MMKV):
 *   [0:4]  crcDigest   [4:8]  version   [8:12] sequence
 *   [12:28] m_vector (the 16-byte AES IV)   [28:32] actualSize (uint32 LE)
 *
 * Data file layout:
 *   [0:4] legacy size field (0 in v4)   [4 : 4+actualSize] the AES ciphertext
 *
 * After decryption the plaintext is MMKV's content region: a 4-byte internal
 * header, then length-prefixed [key][value] records (same encoding the plain
 * reader handles). We skip the 4-byte header and parse from there.
 *
 * SECURITY POINT: this only works because we hold the key. In a real app the key
 * must live in the Keystore/Keychain, never hardcoded in the JS bundle.
 */

import { readFileSync } from 'node:fs';
import { createDecipheriv } from 'node:crypto';
import { Buffer } from 'node:buffer';

const [, , dataPath, crcPath, keyArg] = process.argv;
if (!dataPath || !crcPath) {
  console.error(
    'Usage: node scripts/read-mmkv-encrypted.mjs <data-file> <crc-file> [encryptionKey]',
  );
  process.exit(1);
}

const KEY = Buffer.from(keyArg ?? 'demo-mmkv-encryption-key-32bytes', 'utf8');
const cipherName =
  KEY.length === 32 ? 'aes-256-cfb' : KEY.length === 16 ? 'aes-128-cfb' : null;
if (!cipherName) {
  console.error(`Key must be 16 (AES-128) or 32 (AES-256) bytes; got ${KEY.length}.`);
  process.exit(1);
}

const data = readFileSync(dataPath);
const meta = readFileSync(crcPath);

const iv = meta.subarray(12, 28);
const actualSize = meta.readUInt32LE(28);

if (iv.every((b) => b === 0)) {
  console.error(
    'IV in the .crc meta is all zeros → this instance is NOT encrypted.\n' +
      'Use:  node scripts/read-mmkv-plain.mjs ' + dataPath,
  );
  process.exit(1);
}

// Ciphertext is the content region: data[4 : 4 + actualSize].
const ciphertext = data.subarray(4, 4 + actualSize);
const decipher = createDecipheriv(cipherName, KEY, iv);
decipher.setAutoPadding(false);
const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

// Parse length-prefixed [key][value] records from a buffer, starting at `start`.
function parseKV(buf, start) {
  let pos = start;
  const readVarint = () => {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = buf[pos++];
      result |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    return result >>> 0;
  };

  const entries = {};
  while (pos < buf.length) {
    const keyLen = readVarint();
    if (keyLen === 0 || pos + keyLen > buf.length) break;
    const key = buf.toString('utf8', pos, pos + keyLen);
    pos += keyLen;
    const valLen = readVarint();
    const valEnd = pos + valLen;
    const strLen = readVarint();
    const value = buf.toString('utf8', pos, pos + strLen);
    pos = valEnd;
    if (!/^[\x20-\x7e]+$/.test(key)) return null; // not a real key → wrong offset
    entries[key] = value;
  }
  return entries;
}

// The content region begins with a 4-byte internal header, so KV starts at +4.
// Fall back to scanning the first few offsets in case the header size varies.
let entries = null;
for (const start of [4, 0, 8, 5, 6]) {
  const parsed = parseKV(plain, start);
  if (parsed && Object.keys(parsed).length > 0) {
    entries = parsed;
    break;
  }
}

if (!entries) {
  console.error('Could not parse decrypted data. Decrypted head (hex):');
  console.error(plain.subarray(0, 48).toString('hex').replace(/(..)/g, '$1 '));
  process.exit(1);
}

const width = Math.max(...Object.keys(entries).map((k) => k.length));
for (const [key, value] of Object.entries(entries)) {
  console.log(`${key.padEnd(width)} = ${value}`);
}
console.log(`\n(${Object.keys(entries).length} keys, decrypted with ${cipherName})`);
