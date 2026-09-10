#!/usr/bin/env bash
set -euo pipefail

REPOSITORY="${1:?usage: ext-install <owner/repo|github-url> [browser] [url]}"
BROWSER="${2:-auto}"
URL="${3:-}"

normalize_repo() {
  local value="$1"
  value="${value%/}"
  if [[ "$value" =~ ^https://github\.com/([^/]+)/([^/#?]+)(\.git)?$ ]]; then
    echo "${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
  elif [[ "$value" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
    echo "$value"
  else
    echo "invalid GitHub repository: $value" >&2
    exit 2
  fi
}

windows_downloads() {
  if [[ -n "${WSL_INTEROP:-}" ]] && command -v cmd.exe >/dev/null 2>&1 && command -v wslpath >/dev/null 2>&1; then
    local profile
    profile="$(cmd.exe /c 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r')"
    if [[ "$profile" =~ ^[A-Za-z]:\\Users\\[^\\]+$ ]]; then
      wslpath -u "$profile\\Downloads"
      return 0
    fi
  fi
  return 1
}

REPO="$(normalize_repo "$REPOSITORY")"
OWNER="${REPO%%/*}"
NAME="${REPO#*/}"

if BASE_WIN="$(windows_downloads)"; then
  BASE="$BASE_WIN/ext-install"
else
  BASE="${LOCALAPPDATA:-$HOME/.local/share}/ext-install"
fi

DIR="$BASE/$OWNER-$NAME"
mkdir -p "$BASE"

echo "[1/3] source: $DIR"
if [[ -d "$DIR/.git" ]]; then
  git -C "$DIR" pull --ff-only
else
  if command -v gh >/dev/null 2>&1; then
    gh repo clone "$REPO" "$DIR"
  else
    git clone "https://github.com/$REPO.git" "$DIR"
  fi
fi

EXT_DIR=""
if [[ -f "$DIR/manifest.json" ]]; then
  EXT_DIR="$DIR"
else
  while IFS= read -r manifest; do
    EXT_DIR="$(dirname "$manifest")"
    break
done < <(find "$DIR" -maxdepth 3 -type f -name manifest.json -print)
fi
[[ -n "$EXT_DIR" && -f "$EXT_DIR/manifest.json" ]] || { echo "manifest.json not found under $DIR" >&2; exit 1; }

node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(![2,3].includes(m.manifest_version)||!m.name) process.exit(1);' "$EXT_DIR/manifest.json" || { echo "invalid extension manifest" >&2; exit 1; }

echo "[2/3] manifest: $EXT_DIR/manifest.json"

find_browser() {
  case "$BROWSER" in
    edge) printf '%s\n' "${EDGE_PATH:-$(command -v microsoft-edge || command -v msedge || true)}" ;;
    chrome) printf '%s\n' "${CHROME_PATH:-$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)}" ;;
    auto)
      printf '%s\n' "${EDGE_PATH:-$(command -v microsoft-edge || command -v msedge || true)}"
      printf '%s\n' "${CHROME_PATH:-$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)}"
      ;;
    *) echo "browser must be edge, chrome, or auto" >&2; exit 2 ;;
  esac
}

BROWSER_PATH=""
while IFS= read -r candidate; do
  if [[ -n "$candidate" && -x "$candidate" ]]; then BROWSER_PATH="$candidate"; break; fi
done < <(find_browser)

if [[ -z "$BROWSER_PATH" && -n "${WSL_INTEROP:-}" ]] && command -v cmd.exe >/dev/null 2>&1; then
  case "$BROWSER" in
    edge|auto) BROWSER_PATH="msedge.exe" ;;
    chrome) BROWSER_PATH="chrome.exe" ;;
  esac
fi
[[ -n "$BROWSER_PATH" ]] || { echo "browser not found: $BROWSER" >&2; exit 1; }

LOAD_PATH="$EXT_DIR"
if [[ "$BROWSER_PATH" == *.exe ]]; then
  LOAD_PATH="$(wslpath -w "$EXT_DIR" 2>/dev/null || printf '%s' "$EXT_DIR")"
fi

echo "[3/3] launch: $BROWSER_PATH --load-extension=$LOAD_PATH"
ARGS=("--load-extension=$LOAD_PATH")
[[ -n "$URL" ]] && ARGS+=("--new-window" "$URL")
"$BROWSER_PATH" "${ARGS[@]}" &

echo "Installed and launched: $REPO"
