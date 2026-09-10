#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="$ROOT/native-host/ext-install-native-host.py"
HOST_NAME="com.bonsai.ext_install"
EXTENSION_ID="06647b6f49cbcc96de88f26ab75221b3"

chmod +x "$HOST"

install_for() {
  local dir="$1"
  mkdir -p "$dir"
  cat > "$dir/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Bonsai Ext Install native messaging host",
  "path": "$HOST",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXTENSION_ID/"]
}
EOF
  echo "registered: $dir/$HOST_NAME.json"
}

# Edge/Chromium-compatible user-level locations.
install_for "$HOME/.config/microsoft-edge/NativeMessagingHosts"
install_for "$HOME/.config/google-chrome/NativeMessagingHosts"
install_for "$HOME/.config/chromium/NativeMessagingHosts"

echo "Native host ready: $HOST_NAME"
