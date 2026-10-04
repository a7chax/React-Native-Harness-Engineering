import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

export interface RecordingLabel {
  feature: string;
  index: number;
  title: string;
  passed: boolean;
}

/** A tap performed during the test, in device pixels, timed from video start. */
export interface RecordedTap {
  atMs: number;
  x: number;
  y: number;
}

// Height of the caption band added above the device screen, in source pixels.
const BAND_HEIGHT = 320;
// Hold the final frame so the end state of each test is readable.
const HOLD_SECONDS = 2;
const OUTPUT_WIDTH = 720;
// How long each tap marker stays on screen.
const TAP_MARKER_MS = 700;

/** Escape text for an ASS subtitle dialogue line. */
function assText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/[{}]/g, "").replace(/\n/g, "\\N");
}

/** Format milliseconds as an ASS timestamp (h:mm:ss.cc). */
function assTime(ms: number): string {
  const cs = Math.max(0, Math.round(ms / 10));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs % 100)}`;
}

/**
 * ASS vector path for a circle of radius r inside the box (0,0)-(2r,2r).
 * libass aligns drawings from their (0,0) origin, so coordinates must stay
 * non-negative for \an5 to centre the circle on \pos.
 */
function circlePath(r: number): string {
  const k = Math.round(r * 0.5523);
  const d = 2 * r;
  return [
    `m ${r} 0`,
    `b ${r + k} 0 ${d} ${r - k} ${d} ${r}`,
    `b ${d} ${r + k} ${r + k} ${d} ${r} ${d}`,
    `b ${r - k} ${d} 0 ${r + k} 0 ${r}`,
    `b 0 ${r - k} ${r - k} 0 ${r} 0`,
  ].join(" ");
}

/**
 * A "show taps"-style marker: a translucent orange dot with a solid ring that pops
 * in, then grows and fades out. Android's own Show taps setting does not draw
 * Appium's injected touches, so they are drawn here instead.
 */
function tapEvent(tap: RecordedTap, width: number): string {
  const radius = Math.round(width * 0.045);
  const x = Math.round(tap.x);
  const y = Math.round(tap.y) + BAND_HEIGHT;
  const tags = [
    "\\an5",
    `\\pos(${x},${y})`,
    "\\bord8",
    "\\1c&H2C9CFF&\\1a&H90&",
    "\\3c&H2C9CFF&\\3a&H00&",
    "\\fscx70\\fscy70",
    "\\t(0,120,\\fscx100\\fscy100)",
    `\\t(350,${TAP_MARKER_MS},\\fscx150\\fscy150\\alpha&HFF&)`,
    "\\p1",
  ].join("");
  return `Dialogue: 1,${assTime(tap.atMs)},${assTime(tap.atMs + TAP_MARKER_MS)},Tap,,0,0,0,,{${tags}}${circlePath(radius)}{\\p0}`;
}

/** Read the video's WxH from ffmpeg's stream info (ffprobe isn't bundled). */
function videoSize(file: string): { width: number; height: number } | null {
  const info = spawnSync(ffmpegPath as string, ["-hide_banner", "-i", file], {
    encoding: "utf8",
  });
  const match = /Video:.*?\b(\d{3,5})x(\d{3,5})\b/.exec(info.stderr);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

function buildCaption(
  label: RecordingLabel,
  taps: RecordedTap[],
  width: number,
  height: number,
): string {
  const status = label.passed ? "PASSED" : "FAILED";
  // ASS colours are &HBBGGRR.
  const statusColour = label.passed ? "&H0050AF4C" : "&H003643F4";
  const margin = Math.round(width * 0.05);
  const title = `${String(label.index).padStart(2, "0")}. ${label.title}`;

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height + BAND_HEIGHT}`,
    "WrapStyle: 0",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Feature,DejaVu Sans,44,&H00B0B0B0,&H00000000,&H00000000,&H00000000,1,0,0,0,100,100,2,0,1,0,0,7,${margin},${margin},40,1`,
    `Style: Title,DejaVu Sans,54,&H00FFFFFF,&H00000000,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,7,${margin},${margin},110,1`,
    "Style: Tap,DejaVu Sans,20,&H00FFFFFF,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1",
    `Style: Status,DejaVu Sans,44,${statusColour},&H00000000,&H00000000,&H00000000,1,0,0,0,100,100,2,0,1,0,0,9,${margin},${margin},40,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    `Dialogue: 0,0:00:00.00,9:59:59.00,Feature,,0,0,0,,FEATURE · ${assText(label.feature.toUpperCase())}`,
    `Dialogue: 0,0:00:00.00,9:59:59.00,Title,,0,0,0,,${assText(title)}`,
    `Dialogue: 0,0:00:00.00,9:59:59.00,Status,,0,0,0,,● ${status}`,
    ...taps.map((tap) => tapEvent(tap, width)),
  ].join("\n");
}

/**
 * Turn a raw Appium screen recording into a readable clip: constant 30fps in
 * real time (screenrecord only emits frames when the screen changes), a
 * caption band naming the feature, test and result, a marker on every tap,
 * and a held final frame.
 *
 * Returns false (leaving the raw file in place) when ffmpeg is unavailable or
 * fails, so a labelling problem never fails the test run.
 */
export function labelRecording(
  rawFile: string,
  outFile: string,
  label: RecordingLabel,
  taps: RecordedTap[] = [],
): boolean {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return false;
  const size = videoSize(rawFile);
  if (!size) return false;

  const captionFile = `${outFile}.ass`;
  fs.writeFileSync(captionFile, buildCaption(label, taps, size.width, size.height));

  const filters = [
    "fps=30",
    `tpad=stop_mode=clone:stop_duration=${HOLD_SECONDS}`,
    `pad=iw:ih+${BAND_HEIGHT}:0:${BAND_HEIGHT}:color=0x1E1E24`,
    `ass=${path.basename(captionFile)}`,
    `scale=${OUTPUT_WIDTH}:-2`,
  ].join(",");

  const result = spawnSync(
    ffmpegPath,
    [
      "-y",
      "-loglevel",
      "error",
      "-i",
      path.resolve(rawFile),
      "-vf",
      filters,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      path.resolve(outFile),
    ],
    // Run beside the caption so the ass filter path needs no escaping.
    { cwd: path.dirname(captionFile), encoding: "utf8" },
  );
  fs.rmSync(captionFile, { force: true });

  if (result.status !== 0) {
    console.warn(`[recording] ffmpeg failed: ${result.stderr.trim()}`);
    return false;
  }
  return true;
}
