#!/bin/sh
# Chomp macOS replacement helper. The archive is copied into a protected
# same-volume directory and verified again BEFORE installing or invoking admin
# filesystem operations on the existing app.
set -eu
umask 077
TARGET="$1"
ARCHIVE="$2"
EXPECTED_SHA256="$3"
APP_PID="$4"
READY="$5"
VERSION="$6"
ARCH="$7"
USER_ID="$8"
ID='io.github.mcbasketballcranjis.chomp'

case "$TARGET" in */Chomp.app) ;; *) exit 21 ;; esac
case "$TARGET" in /Volumes/*) exit 22 ;; esac
case "$APP_PID:$USER_ID" in *[!0-9:]*|:*|*:) exit 23 ;; esac
if [ -L "$TARGET" ] || [ ! -d "$TARGET" ] || [ -L "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then exit 24; fi
if ! /bin/echo "$EXPECTED_SHA256" | /usr/bin/grep -Eq '^[0-9a-f]{64}$'; then exit 25; fi
CURRENT_ID=$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$TARGET/Contents/Info.plist")
if [ "$CURRENT_ID" != "$ID" ]; then exit 26; fi
PARENT=$(/usr/bin/dirname "$TARGET")
TMP=$(/usr/bin/mktemp -d "$PARENT/.chomp-update.XXXXXX")
# Protect against a user-space race on the downloaded ZIP. Both the checksum
# check and extraction use the same copy, inaccessible to other users.
if ! /bin/cp "$ARCHIVE" "$TMP/download.zip"; then /bin/rm -rf "$TMP"; exit 27; fi
ACTUAL=$(/usr/bin/shasum -a 256 "$TMP/download.zip" | /usr/bin/awk '{print $1}')
if [ "$ACTUAL" != "$EXPECTED_SHA256" ]; then /bin/rm -rf "$TMP"; exit 28; fi
/bin/mkdir "$TMP/unpacked"
if ! /usr/bin/ditto -x -k "$TMP/download.zip" "$TMP/unpacked"; then /bin/rm -rf "$TMP"; exit 29; fi
NEW="$TMP/unpacked/Chomp.app"
if [ -L "$NEW" ] || [ ! -d "$NEW" ]; then /bin/rm -rf "$TMP"; exit 30; fi
NEW_ID=$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$NEW/Contents/Info.plist")
NEW_VERSION=$(/usr/bin/plutil -extract CFBundleShortVersionString raw -o - "$NEW/Contents/Info.plist")
if [ "$NEW_ID" != "$ID" ] || [ "$NEW_VERSION" != "$VERSION" ]; then /bin/rm -rf "$TMP"; exit 31; fi
if ! /usr/bin/codesign --verify --deep --strict "$NEW"; then /bin/rm -rf "$TMP"; exit 32; fi
case "$ARCH" in x64) EXPECTED_ARCH=x86_64 ;; arm64) EXPECTED_ARCH=arm64 ;; *) /bin/rm -rf "$TMP"; exit 33 ;; esac
if ! /usr/bin/lipo -archs "$NEW/Contents/MacOS/Chomp" | /usr/bin/grep -qw "$EXPECTED_ARCH"; then
  /bin/rm -rf "$TMP"
  exit 34
fi

# Only signal the app to quit AFTER the replacement is extracted and verified.
# The running app is never removed when authorization or verification fails.
/usr/bin/touch "$READY"
WAITED=0
while /bin/kill -0 "$APP_PID" 2>/dev/null && [ "$WAITED" -lt 120 ]; do
  /bin/sleep 1
  WAITED=$((WAITED + 1))
done
if /bin/kill -0 "$APP_PID" 2>/dev/null; then /bin/rm -rf "$TMP"; exit 35; fi

BACKUP="$PARENT/.Chomp-previous.app"
if [ -L "$BACKUP" ]; then /bin/rm -rf "$TMP"; exit 36; fi
if [ -e "$BACKUP" ]; then /bin/rm -rf "$BACKUP"; fi
if ! /bin/mv "$TARGET" "$BACKUP"; then /bin/rm -rf "$TMP"; exit 37; fi
if ! /bin/mv "$NEW" "$TARGET"; then
  /bin/mv "$BACKUP" "$TARGET"
  /bin/rm -rf "$TMP"
  exit 38
fi
/bin/rm -rf "$TMP"

# CI tests the swap without opening a GUI; the production helper relaunches.
if [ "$(/usr/bin/printenv CHOMP_UPDATE_SKIP_RELAUNCH || true)" = "1" ]; then exit 0; fi
if [ "$(/usr/bin/id -u)" -eq 0 ]; then
  USERNAME=$(/usr/bin/id -nu "$USER_ID")
  if ! /usr/bin/sudo -H -u "$USERNAME" /usr/bin/open -a "$TARGET"; then
    /bin/rm -rf "$TARGET"
    /bin/mv "$BACKUP" "$TARGET"
    /usr/bin/sudo -H -u "$USERNAME" /usr/bin/open -a "$TARGET" || true
    exit 39
  fi
else
  if ! /usr/bin/open -a "$TARGET"; then
    /bin/rm -rf "$TARGET"
    /bin/mv "$BACKUP" "$TARGET"
    /usr/bin/open -a "$TARGET" || true
    exit 40
  fi
fi
exit 0
