#!/usr/bin/env bash
# Bring up everything the Appium suite needs: emulator, Metro, port reverse,
# installed debug app. Each step is skipped if it is already done, so this is
# safe to re-run. Usage: boot-device.sh [AVD_NAME]
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
SDK="${ANDROID_HOME:-$HOME/Android/Sdk}"
ADB="$SDK/platform-tools/adb"
EMULATOR="$SDK/emulator/emulator"
PACKAGE="com.anonymous.reactnativeuitest"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
LOG_DIR="${TMPDIR:-/tmp}/rn-harness"
mkdir -p "$LOG_DIR"

if ! "$ADB" devices | grep -qE "\sdevice$"; then
  AVD="${1:-$("$EMULATOR" -list-avds | head -n1)}"
  [ -n "$AVD" ] || { echo "No AVD found; create one in Android Studio." >&2; exit 1; }
  echo "Booting emulator $AVD (log: $LOG_DIR/emulator.log)"
  nohup "$EMULATOR" -avd "$AVD" -no-snapshot-load -no-boot-anim >"$LOG_DIR/emulator.log" 2>&1 &
fi

echo "Waiting for boot to complete..."
"$ADB" wait-for-device
for _ in $(seq 1 120); do
  [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
  sleep 2
done
[ "$("$ADB" shell getprop sys.boot_completed | tr -d '\r')" = "1" ] || { echo "Emulator did not finish booting." >&2; exit 1; }

# Gboard's "Try out your stylus" onboarding can cover the screen mid-test.
"$ADB" shell settings put secure stylus_handwriting_enabled 0

if ! curl -s localhost:8081/status | grep -q running; then
  echo "Starting Metro (log: $LOG_DIR/metro.log)"
  (cd "$ROOT" && nohup npx expo start --port 8081 >"$LOG_DIR/metro.log" 2>&1 &)
  for _ in $(seq 1 60); do curl -s localhost:8081/status | grep -q running && break; sleep 2; done
fi
"$ADB" reverse tcp:8081 tcp:8081 >/dev/null

if ! "$ADB" shell pm list packages | grep -q "$PACKAGE"; then
  [ -f "$APK" ] || { echo "No APK at $APK; build it with: npx expo run:android" >&2; exit 1; }
  echo "Installing $APK"
  "$ADB" install -r "$APK" >/dev/null
fi

echo "Ready: $("$ADB" devices | grep -E '\sdevice$' | cut -f1), Metro on 8081, $PACKAGE installed."
echo "Node $(node -v) (needs v22), appium $(appium --version 2>/dev/null || echo 'NOT FOUND')"
