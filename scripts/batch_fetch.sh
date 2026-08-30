#!/bin/bash
# Fetch a wave of reels serially into the buffer, gently paced.
# usage: batch_fetch.sh <wavefile>   (lines: "<tag> <url>")
while read -r TAG URL; do
  [ -z "$TAG" ] && continue
  /home/user/danipro/scripts/fetch_buffer.sh "$TAG" "$URL" 3 60
  sleep 20
done < "$1"
echo "WAVE_COMPLETE $1"
