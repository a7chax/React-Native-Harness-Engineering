#!/usr/bin/env node
/**
 * Read an UNENCRYPTED react-native-mmkv data file and print `key = value`.
 *
 * Usage:
 *   node scripts/read-mmkv-plain.mjs <path-to-mmkv-data-file>
 *   node scripts/read-mmkv-plain.mjs mmkv-stored/demo-plain
 *
 * Only works for PLAIN (non-encrypted) instances whose values were stored as
 * strings. Encrypted instances are AES-scrambled on disk and can't be read this
 * way — read those at runtime via the app instead.
 *
 * MMKV on-disk layout (plain): an 8-byte header, then repeated records of
 *   [keyLen][keyBytes][valLen][valueBlob]
 * where lengths are LEB128 varints and a string valueBlob is itself
 *   [strLen][strBytes]. The file is mmap-padded with trailing zero bytes.
 */

import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/read-mmkv-plain.mjs <mmkv-data-file>');
  process.exit(1);
}

const buf = readFileSync(file);
let pos = 8; // skip the 8-byte header

function readVarint() {
  let result = 0;
  let shift = 0;
  let byte;
  do {
    byte = buf[pos++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  return result >>> 0;
}

const entries = {};
while (pos < buf.length) {
  const keyLen = readVarint();
  if (keyLen === 0) break; // reached the zero padding -> end of data

  const key = buf.toString('utf8', pos, pos + keyLen);
  pos += keyLen;

  const valLen = readVarint();
  const valEnd = pos + valLen;
  // The value blob holds a length-prefixed string.
  const strLen = readVarint();
  const value = buf.toString('utf8', pos, pos + strLen);
  pos = valEnd; // last-write-wins: later appends overwrite earlier ones

  entries[key] = value;
}

const width = Math.max(...Object.keys(entries).map((k) => k.length));
for (const [key, value] of Object.entries(entries)) {
  console.log(`${key.padEnd(width)} = ${value}`);
}
console.log(`\n(${Object.keys(entries).length} keys)`);
