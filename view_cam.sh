#!/usr/bin/env bash
# Reset MX Brio digital zoom/pan/tilt and show a live full-FOV preview.
# Usage: ./view_cam.sh [WIDTHxHEIGHT]   (default 3840x2160; e.g. 1920x1080 for 60fps-ish)
set -euo pipefail
cd "$(dirname "$0")"

DEV=$(ls /dev/v4l/by-id/usb-046d_MX_Brio_*-video-index0 2>/dev/null | head -1)
[ -n "$DEV" ] || { echo "MX Brio not found" >&2; exit 1; }
SIZE=${1:-3840x2160}

python3 camctl.py "$DEV" zoom_absolute=100 pan_absolute=0 tilt_absolute=0

exec ffplay -hide_banner -loglevel warning \
  -f v4l2 -input_format mjpeg -video_size "$SIZE" -framerate 30 \
  -fflags nobuffer -flags low_delay -framedrop \
  -x 1600 -y 900 -window_title "MX Brio $SIZE" \
  "$DEV"
