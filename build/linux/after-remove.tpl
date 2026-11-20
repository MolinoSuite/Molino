#!/bin/bash
# Después de quitar el .deb o el .rpm: lo de electron-builder y el comando «molino».

if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove '${executable}' '/opt/${sanitizedProductName}/${executable}'
    update-alternatives --remove 'molino' '/opt/${sanitizedProductName}/resources/engine/molino-engine' || true
else
    rm -f '/usr/bin/${executable}'
    if [ "`readlink '/usr/bin/molino'`" = '/opt/${sanitizedProductName}/resources/engine/molino-engine' ]; then
        rm -f '/usr/bin/molino'
    fi
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi
if hash gtk-update-icon-cache 2>/dev/null; then
    gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi

APPARMOR_PROFILE_DEST='/etc/apparmor.d/${executable}'

# Remove and unload apparmor profile.
if [ -f "$APPARMOR_PROFILE_DEST" ]; then
  if apparmor_status --enabled > /dev/null 2>&1; then
    if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
      apparmor_parser --remove "$APPARMOR_PROFILE_DEST" || true
    fi
  fi
  rm -f "$APPARMOR_PROFILE_DEST"
fi
