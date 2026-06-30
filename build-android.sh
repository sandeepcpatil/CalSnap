#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
MOBILE="$ROOT/mobile"

# Android SDK
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

# Load .env if present
ENV_FILE="$MOBILE/.env"
if [[ -f "$ENV_FILE" ]]; then
  echo "Loading env from $ENV_FILE"
  set -o allexport
  source "$ENV_FILE"
  set +o allexport
fi

# Required env vars check
REQUIRED_VARS=(
  EXPO_PUBLIC_SUPABASE_URL
  EXPO_PUBLIC_SUPABASE_ANON_KEY
  EXPO_PUBLIC_BACKEND_URL
  EXPO_PUBLIC_RAZORPAY_KEY_ID
)

MISSING=0
for VAR in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!VAR:-}" ]]; then
    echo "ERROR: $VAR is not set"
    MISSING=1
  fi
done

if [[ $MISSING -eq 1 ]]; then
  echo ""
  echo "Set missing vars in $MOBILE/.env or export them before running this script."
  exit 1
fi

# Read fallback versionCode from the ternary in app.config.js and increment
CURRENT_VERSION=$(grep 'versionCode:' "$MOBILE/app.config.js" | grep -oE '\) : [0-9]+' | grep -oE '[0-9]+')
if [[ -z "$CURRENT_VERSION" ]]; then
  echo "ERROR: Could not parse versionCode from app.config.js"
  exit 1
fi
NEXT_VERSION=$((CURRENT_VERSION + 1))
export EXPO_PUBLIC_VERSION_CODE=$NEXT_VERSION

echo "Version code: $CURRENT_VERSION → $NEXT_VERSION"
echo "Building Android AAB (local)..."
cd "$MOBILE"

if eas build --platform android --profile production --local --non-interactive --output ./calsnap.aab; then
  # Build succeeded — bump the fallback versionCode in the ternary expression
  sed -i '' "s/\(versionCode:.*) : \)$CURRENT_VERSION,/\1$NEXT_VERSION,/" "$MOBILE/app.config.js"
  echo ""
  echo "Build complete: $MOBILE/calsnap.aab"
  echo "versionCode bumped to $NEXT_VERSION in app.config.js"
else
  echo ""
  echo "Build FAILED — versionCode not updated."
  exit 1
fi
