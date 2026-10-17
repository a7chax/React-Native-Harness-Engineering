#!/usr/bin/env node
/**
 * Build the bundled music assets in assets/music/.
 *
 * Usage:
 *   node scripts/build-music-assets.mjs
 *
 * Downloads two CC BY 4.0 songs by Josh Woodward, transcodes them with the
 * repo's ffmpeg-static to AAC-LC 128 kbps M4A (exact seeking on Android, unlike
 * VBR MP3), generates a 20 s 440 Hz tone with no lyrics, and prints each file's
 * size, duration and sha256. Exits non-zero on any failure.
 *
 * joshwoodward.com sits behind Cloudflare, which answers 403 to curl's default
 * User-Agent, so downloads send a browser-like one.
 */

import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const OUT_DIR = fileURLToPath(new URL('../assets/music/', import.meta.url));

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const SONGS = [
  {
    id: 'dcye',
    url: 'https://www.joshwoodward.com/mp3/TheSimpleLife/JoshWoodward-TheSimpleLife-204-DontCloseYourEyes.mp3',
  },
  {
    id: 'letting-go',
    url: 'https://www.joshwoodward.com/mp3/TheSimpleLife/JoshWoodward-TheSimpleLife-107-ImLettingGo.mp3',
  },
];

/** AAC-LC 128 kbps, moov atom first, no tags or cover art. */
const AAC_ARGS = [
  '-map_metadata', '-1',
  '-vn',
  '-c:a', 'aac',
  '-profile:a', 'aac_low',
  '-b:a', '128k',
  '-movflags', '+faststart',
];

function ffmpeg(args) {
  const result = spawnSync(ffmpegPath, ['-hide_banner', '-nostdin', ...args], {
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  return result;
}

function run(args) {
  const result = ffmpeg(['-loglevel', 'error', '-y', ...args]);
  if (result.status !== 0) {
    throw new Error(`ffmpeg ${args.join(' ')} failed (${result.status}):\n${result.stderr}`);
  }
}

/** Duration in seconds, read from the `Duration:` line `ffmpeg -i` prints. */
function durationSeconds(file) {
  // With no output file ffmpeg exits 1 after printing the input's details.
  const { stderr } = ffmpeg(['-i', file]);
  const match = /Duration: (\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr);
  if (!match) throw new Error(`No duration in ffmpeg output for ${file}:\n${stderr}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

async function download(url, file) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`GET ${url} -> HTTP ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length === 0) throw new Error(`GET ${url} -> empty body`);
  writeFileSync(file, body);
}

function report(label, file) {
  const kb = (statSync(file).size / 1024).toFixed(1);
  const seconds = durationSeconds(file).toFixed(2);
  console.log(`${label}\n  size ${kb} KiB  duration ${seconds} s  sha256 ${sha256(file)}`);
}

async function main() {
  if (!ffmpegPath) throw new Error('ffmpeg-static has no binary for this platform');
  mkdirSync(OUT_DIR, { recursive: true });
  const workDir = mkdtempSync(join(tmpdir(), 'music-assets-'));
  try {
    for (const song of SONGS) {
      const mp3 = join(workDir, `${song.id}.mp3`);
      console.log(`Downloading ${song.url}`);
      await download(song.url, mp3);
      console.log(`  source sha256 ${sha256(mp3)}`);
      run(['-i', mp3, ...AAC_ARGS, join(OUT_DIR, `${song.id}.m4a`)]);
    }
    run([
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=20',
      '-ac', '1',
      ...AAC_ARGS,
      join(OUT_DIR, 'tone.m4a'),
    ]);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  for (const id of [...SONGS.map((song) => song.id), 'tone']) {
    report(`assets/music/${id}.m4a`, join(OUT_DIR, `${id}.m4a`));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
