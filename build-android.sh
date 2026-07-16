#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
#  CalSnap — local Android release build (AAB)
#
#  Usage:
#    ./build-android.sh          # builds with VERSION_CODE set below
#    ./build-android.sh 15       # override the version code for this run
#
#  Just edit VERSION_CODE below (or pass it as an argument), then run:
#    bash build-android.sh
# ─────────────────────────────────────────────────────────────────────────────

# 👉 EDIT THIS: the Play Store versionCode for this build (must be higher than
#    the last one you uploaded). A CLI argument, if given, overrides it.
VERSION_CODE="${1:-12}"

# Expected upload-key fingerprint — the AAB is verified against this at the end.
EXPECTED_SHA1="A8:91:B5:DC:B0:13:DC:C7:DC:96:3C:46:29:FD:2A:81:73:39:E2:11"

ROOT="$(cd "$(dirname "$0")" && pwd)"
MOBILE="$ROOT/mobile"
ANDROID_DIR="$MOBILE/android"
AAB_PATH="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"

# Android SDK
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

# ── Load EXPO_PUBLIC_* from .env so the JS bundle gets Supabase / Google /
#    RevenueCat config baked in (gradle reads process.env at export:embed time).
ENV_FILE="$MOBILE/.env"
if [[ -f "$ENV_FILE" ]]; then
  echo "Loading env from $ENV_FILE"
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
else
  echo "ERROR: $ENV_FILE not found"
  exit 1
fi

# ── Required env vars ────────────────────────────────────────────────────────
REQUIRED_VARS=(
  EXPO_PUBLIC_SUPABASE_URL
  EXPO_PUBLIC_SUPABASE_ANON_KEY
  EXPO_PUBLIC_BACKEND_URL
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
)
MISSING=0
for VAR in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!VAR:-}" ]]; then
    echo "ERROR: $VAR is not set (add it to $ENV_FILE)"
    MISSING=1
  fi
done
[[ $MISSING -eq 1 ]] && exit 1

# ── Version code drives the release build (read by android/app/build.gradle) ──
export EXPO_PUBLIC_VERSION_CODE="$VERSION_CODE"

echo ""
echo "──────────────────────────────────────────────"
echo "  Building CalSnap Android AAB"
echo "  versionCode : $VERSION_CODE"
echo "  output      : app-release.aab"
echo "──────────────────────────────────────────────"
echo ""

# ── Build ────────────────────────────────────────────────────────────────────
cd "$ANDROID_DIR"
./gradlew :app:bundleRelease --no-daemon

# ── Verify the result ────────────────────────────────────────────────────────
if [[ ! -f "$AAB_PATH" ]]; then
  echo "ERROR: build reported success but $AAB_PATH is missing"
  exit 1
fi

echo ""
echo "──────────────────────────────────────────────"
echo "  ✅ Build complete"
echo "  file : $AAB_PATH"
echo "  size : $(ls -lh "$AAB_PATH" | awk '{print $5}')"

ACTUAL_SHA1="$(keytool -printcert -jarfile "$AAB_PATH" 2>/dev/null | grep -m1 'SHA1:' | sed 's/.*SHA1: //')"
if [[ "$ACTUAL_SHA1" == "$EXPECTED_SHA1" ]]; then
  echo "  sign : $ACTUAL_SHA1  ✅ upload key"
else
  echo "  sign : $ACTUAL_SHA1"
  echo "  ⚠️  WARNING: not signed with the expected upload key — Play will reject this."
fi
echo "  code : versionCode $VERSION_CODE"
echo "──────────────────────────────────────────────"
echo ""
echo "Next: upload the AAB to Play Console. Remember to bump VERSION_CODE"
echo "(or pass a new one: ./build-android.sh $((VERSION_CODE + 1))) next time."
