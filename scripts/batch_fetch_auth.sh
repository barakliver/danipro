#!/bin/bash
# Fetch a wave into the buffer using the auth cookie, gently paced.
while read -r TAG URL; do
  [ -z "$TAG" ] && continue
  BUF=/tmp/claude-0/-home-user-danipro/b167b0ad-6060-5cc8-b5ea-f19e972bf588/scratchpad/buffer
  mkdir -p "$BUF"; cd "$BUF"
  for i in 1 2 3; do
    yt-dlp --no-warnings --cookies /home/user/danipro/cookies.txt \
      -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b" --merge-output-format mp4 \
      --write-info-json -o "${TAG}.%(ext)s" "$URL" < /dev/null 2>/dev/null
    if [ -f "${TAG}.mp4" ]; then
      D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "${TAG}.mp4")
      ffmpeg -v error -i "${TAG}.mp4" -vf "fps=20/${D},scale=340:-1,tile=5x4" -frames:v 1 "sheet_${TAG}.png" -y </dev/null
      echo "OK ${TAG}"; break
    fi
    [ "$i" -lt 3 ] && sleep 45
  done
  [ -f "${BUF}/${TAG}.mp4" ] || echo "FAILED ${TAG}"
  sleep 15
done < "$1"
echo "WAVE_DONE $1"
