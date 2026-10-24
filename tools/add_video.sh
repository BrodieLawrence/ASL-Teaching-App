#!/bin/bash
# Converts a video of a sign into the format the page uses and saves it as videos/<word>.mp4.
# Works with phone videos (.mov, .mp4, ...). Removes sound, scales to 480 pixels tall,
# and compresses it so it loads quickly.
#
# Usage: tools/add_video.sh <input video> <word>     (needs ffmpeg)
# Optional: START=1.5 DURATION=3 tools/add_video.sh in.mov sleep   to keep only part of it.
set -e
if [ $# -ne 2 ]; then echo "Usage: $0 <input video> <word>"; exit 1; fi
cd "$(dirname "$0")/.."
TRIM=()
[ -n "$START" ] && TRIM+=(-ss "$START")
[ -n "$DURATION" ] && TRIM+=(-t "$DURATION")
ffmpeg -y -loglevel error "${TRIM[@]}" -i "$1" -an -vf "scale=-2:480,fps=30" \
  -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 28 -movflags +faststart "videos/$2.mp4"
echo "Saved videos/$2.mp4 ($(du -h "videos/$2.mp4" | cut -f1))"
