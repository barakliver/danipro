#!/bin/bash
# Fetch one reel into the analysis buffer, with paced retries for rate limits.
# usage: fetch_buffer.sh <tag> <url> [attempts] [initial_delay_s]
TAG="$1"; URL="$2"; TRIES="${3:-5}"; DELAY="${4:-90}"
BUF=/tmp/claude-0/-home-user-danipro/b167b0ad-6060-5cc8-b5ea-f19e972bf588/scratchpad/buffer
mkdir -p "$BUF"; cd "$BUF"
for i in $(seq 1 "$TRIES"); do
  OUT=$(yt-dlp --no-warnings -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b" \
        --merge-output-format mp4 --write-info-json -o "${TAG}.%(ext)s" "$URL" 2>&1)
  if [ -f "${TAG}.mp4" ]; then
    D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "${TAG}.mp4")
    ffmpeg -v error -i "${TAG}.mp4" -vf "fps=20/${D},scale=340:-1,tile=5x4" -frames:v 1 "sheet_${TAG}.png" -y
    echo "OK ${TAG} attempt=$i duration=${D}s"
    exit 0
  fi
  echo "attempt $i/$TRIES failed: $(echo "$OUT" | grep -oE 'empty media response|login|rate|429|not available|Restricted' | head -1)"
  [ "$i" -lt "$TRIES" ] && sleep "$DELAY" && DELAY=$((DELAY*2))
done
echo "FAILED ${TAG} after $TRIES attempts"
echo "$OUT" | tail -3
exit 1
