#!/bin/sh
# macOS update helper bundled with Chomp. Staged ZIP and code signature
# have been verified by the main process before this helper is launched.
set -eu
umask 077
TARGET="$1"
SOURCE="$2"
APP_PID="$3"
READY="$4"
VERSION="$5"
ARCH="$6"
USER_ID="$7"
ID='io.github.mcbasketballcranjis.chomp'

case "$TARGET" in
  */Chomp.app) ;;
  *) exit 21 ;;
esac
case "$TARGET" in
  /Volumes/*) exit 22 ;;
esac
case "$APP_PID:$USER_ID" in
  *[!0-9:]*|:*|*:) exit 23 ;;
esac
if [ -L "$TARGET" ] || [ -L "$SOURCE" ] || [ ! -d "$TARGET" ] || [ ! -d "$SOURCE" ]; then
  exit 24
fi
PARENT=$(/usr/bin/dirname "$TARGET")
CURRENT_ID=$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$TARGET/Contents/Info.plist")
if [ "$CURRENT_ID" != "$ID" ]; then exit 25; fi
STAGED_ID=$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$SOURCE/Contents/Info.plist")
STAGED_VERSION=$(/usr/bin/plutil -extract CFBundleShortVersionString raw -o - "$SOURCE/Contents/Info.plist")
if [ "$STAGED_ID" != "$ID" ] || [ "$STAGED_VERSION" != "$VERSION" ]; then exit 26; fi

TMP=$(/usr/bin/mktemp -d "$PARENT/.chomp-update.XXXXXX")
NEW="$TMP/Chomp.app"
/usr/bin/ditto "$SOURCE" "$NEW"
if ! /usr/bin/codesign --verify --deep --strict "$NEW"; then
  /bin/rm -rf "$TMP"
  exit 27
fi
case "$ARCH" in
  x64) EXPECTED_ARCH=x86_64 ;;
  arm64) EXPECTED_ARCH=arm64 ;;
  *) /bin/rm -rf "$TMP"; exit 28 ;;
esac
if ! /usr/bin/lipo -archs "$NEW/Contents/MacOS/Chomp" | /usr/bin/grep -qw "$EXPECTED_ARCH"; then
  /bin/rm -rf "$TMP"
  exit 29
fi

# Only after the replacement is prepared do we tell Chomp to quit.
/usr/bin/touch "$READY"
WAITED=0
while /bin/kill -0 "$APP_PID" 2>/dev/null && [ "$WAITED" -lt 120 ]; do
  /bin/sleep 1
  WAITED=$((WAITED + 1))
done
if /bin/kill -0 "$APP_PID" 2>/dev/null; then
  /bin/rm -rf "$TMP"
  exit 30
fi

BACKUP="$PARENT/.Chomp-previous.app"
if [ -L "$BACKUP" ]; then /bin/rm -rf "$TMP"; exit 31; fi
if [ -e "$BACKUP" ]; then /bin/rm -rf "$BACKUP"; fi
if ! /bin/mv "$TARGET" "$BACKUP"; then /bin/rm -rf "$TMP"; exit 32; fi
if ! /bin/mv "$NEW" "$TARGET"; then
  /bin/mv "$BACKUP" "$TARGET"
  /bin/rm -rf "$TMP"
  exit 33
fi
/bin/rm -rf "$TMP"

# Relaunch as the logged-in user, never as administrator.
if [ "$(/usr/bin/id -u)" -eq 0 ]; then
  USERNAME=$(/usr/bin/id -nu "$USER_ID")
  if ! /usr/bin/sudo -H -u "$USERNAME" /usr/bin/open -a "$TARGET"; then
    /bin/rm -rf "$TARGET"
    /bin/mv "$BACKUP" "$TARGET"
    /usr/bin/sudo -H -u "$USERNAME" /usr/bin/open -a "$TARGET" || true
    exit 34
  fi
else
  if ! /usr/bin/open -a "$TARGET"; then
    /bin/rm -rf "$TARGET"
    /bin/mv "$BACKUP" "$TARGET"
    /usr/bin/open -a "$TARGET" || true
    exit 35
  fi
fi
exit 0
