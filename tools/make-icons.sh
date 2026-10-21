#!/usr/bin/env bash
# Regenerate every Android launcher icon and splash image from one design.
# Requires ImageMagick (convert). Run from the repo root:
#
#   bash tools/make-icons.sh
#
# Change ACCENT / ACCENT_2 / GLYPH below to restyle the whole app icon.

set -euo pipefail

RES="android/app/src/main/res"
ACCENT="#8B6BFF"
ACCENT_2="#C8FF4D"
INK="#0A0A0F"
BG="#07070B"
GLYPH="H"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ ! -d "$RES" ]; then
  echo "Android project not found. Run: npx cap add android" >&2
  exit 1
fi

# --- master artwork -------------------------------------------------------
# Diagonal gradient, corner to corner, then the glyph on top.
convert -size 1024x1024 -define gradient:angle=135 gradient:"$ACCENT"-"$ACCENT_2" "$TMP/bg.png"
convert "$TMP/bg.png" \
  -font DejaVu-Sans-Bold -pointsize 600 -fill "$INK" \
  -gravity center -annotate +0-30 "$GLYPH" \
  "$TMP/full.png"

# Rounded (squircle-ish) version for the legacy launcher icon.
convert "$TMP/full.png" \
  \( -size 1024x1024 xc:none -fill white -draw "roundrectangle 0,0,1023,1023,230,230" \) \
  -alpha off -compose CopyOpacity -composite \
  "$TMP/rounded.png"

convert "$TMP/full.png" \
  \( -size 1024x1024 xc:none -fill white -draw "circle 512,512 512,12" \) \
  -alpha off -compose CopyOpacity -composite \
  "$TMP/round.png"

# Adaptive icon layers: gradient background + glyph-only foreground. The glyph
# sits inside the 66% safe zone so no launcher masks the letter.
convert -size 1024x1024 xc:none \
  -font DejaVu-Sans-Bold -pointsize 520 -fill "$INK" \
  -gravity center -annotate +0-20 "$GLYPH" \
  "$TMP/glyph.png"

# --- densities ------------------------------------------------------------
# name:legacySize
for spec in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  density="${spec%%:*}"
  size="${spec##*:}"
  dir="$RES/mipmap-$density"
  mkdir -p "$dir"
  convert "$TMP/rounded.png" -resize "${size}x${size}" "$dir/ic_launcher.png"
  convert "$TMP/round.png" -resize "${size}x${size}" "$dir/ic_launcher_round.png"
  # Adaptive layers are 108dp canvases (glyph at ~46dp, well inside the safe zone).
  adaptive=$((size * 108 / 48))
  convert "$TMP/glyph.png" -resize "$((adaptive * 58 / 100))x$((adaptive * 58 / 100))" \
    -background none -gravity center -extent "${adaptive}x${adaptive}" "$dir/ic_launcher_foreground.png"
  convert "$TMP/bg.png" -resize "${adaptive}x${adaptive}" "$dir/ic_launcher_background.png"
done

# --- splash screens -------------------------------------------------------
# Portrait + landscape variants per density, dark background + centred logo.
declare -A PORTRAIT=(
  [mdpi]="320x480" [hdpi]="480x800" [xhdpi]="720x1280" [xxhdpi]="960x1600" [xxxhdpi]="1280x1920"
)
for density in "${!PORTRAIT[@]}"; do
  dims="${PORTRAIT[$density]}"
  w="${dims%x*}"
  h="${dims#*x}"
  logo=$((w * 30 / 100))

  convert -size "${w}x${h}" "xc:$BG" \
    \( "$TMP/rounded.png" -resize "${logo}x${logo}" \) -gravity center -composite \
    "$RES/drawable-port-$density/splash.png"

  convert -size "${h}x${w}" "xc:$BG" \
    \( "$TMP/rounded.png" -resize "${logo}x${logo}" \) -gravity center -composite \
    "$RES/drawable-land-$density/splash.png"
done

convert -size "480x320" "xc:$BG" \
  \( "$TMP/rounded.png" -resize 140x140 \) -gravity center -composite \
  "$RES/drawable/splash.png"

# Keep the repo light: 8-bit, stripped, no alpha where it is not needed.
find "$RES" -name 'splash.png' -o -name 'ic_launcher*.png' | while read -r f; do
  convert "$f" -strip -depth 8 -define png:compression-level=9 "$f"
done

# --- store / README art ---------------------------------------------------
mkdir -p docs
convert "$TMP/rounded.png" -resize 512x512 docs/icon.png
convert "$TMP/full.png" -resize 1024x1024 docs/icon-1024.png

echo "Icons and splashes regenerated."
