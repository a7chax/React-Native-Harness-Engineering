#!/usr/bin/env bash
# Turn a test video into one PNG frame strip so it can be read as an image.
# Usage: contact-sheet.sh <video.mp4> [out.png] [frames-per-second]
# Default 2 fps; use 3-4 for short, fast clips. Frames are laid out 10 per row.
set -euo pipefail

VIDEO="$1"
OUT="${2:-${VIDEO%.mp4}.strip.png}"
FPS="${3:-2}"
ROOT="$(git rev-parse --show-toplevel)"
FFMPEG="$ROOT/node_modules/ffmpeg-static/ffmpeg"
[ -x "$FFMPEG" ] || FFMPEG="$(command -v ffmpeg)" || { echo "ffmpeg not found" >&2; exit 1; }

# `ffmpeg -i` without an output always exits 1; only its stream info matters.
DURATION=$({ "$FFMPEG" -i "$VIDEO" 2>&1 || true; } | sed -n 's/.*Duration: \([0-9:.]*\).*/\1/p' | head -n1)
SECONDS_TOTAL=$(echo "$DURATION" | awk -F: '{ print $1*3600 + $2*60 + $3 }')
FRAMES=$(awk -v d="$SECONDS_TOTAL" -v f="$FPS" 'BEGIN { n = int(d * f + 0.999); print (n < 1 ? 1 : n) }')
COLS=$(( FRAMES < 10 ? FRAMES : 10 ))
ROWS=$(( (FRAMES + COLS - 1) / COLS ))

"$FFMPEG" -y -loglevel error -i "$VIDEO" \
  -vf "fps=$FPS,scale=200:-1,tile=${COLS}x${ROWS}" -frames:v 1 "$OUT"
echo "$OUT ($FRAMES frames at ${FPS}fps from ${DURATION})"
