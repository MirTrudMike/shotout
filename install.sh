#!/usr/bin/env bash
# ShotOUT — installer
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/MirTrudMike/shotout/main/install.sh)
set -euo pipefail

REPO_URL="https://github.com/MirTrudMike/shotout"
EXT_UUID="shotout@local"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$EXT_UUID"
BIN_DIR="$HOME/.local/bin"
CONF_DIR="$HOME/.config/shotout"
STATS_DIR="$HOME/.local/share/shotout"
SHIMS_DIR="$HOME/.local/lib/shotout-shims"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BOLD}▶ $*${NC}"; }
success() { echo -e "${GREEN}✓ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}"; }
die()     { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

# ── 1. Check dependencies ─────────────────────────────────────────────────────

info "Checking dependencies..."

MISSING=()

check_cmd() {
    local cmd="$1" pkg="${2:-$1}"
    if ! command -v "$cmd" &>/dev/null; then
        warn "  $cmd not found (package: $pkg)"
        MISSING+=("$pkg")
    else
        success "  $cmd"
    fi
}

check_cmd sox          sox
check_cmd wl-copy      wl-clipboard
check_cmd wl-paste     wl-clipboard
check_cmd ydotool      ydotool
check_cmd python3      python3
check_cmd gnome-extensions gnome-extensions

if [[ ${#MISSING[@]} -gt 0 ]]; then
    echo
    warn "Missing packages: ${MISSING[*]}"
    echo -e "  Install with: ${BOLD}sudo dnf install ${MISSING[*]}${NC}"
    echo
    read -rp "Continue anyway? [y/N] " ans
    [[ "${ans,,}" == y ]] || exit 1
fi

# ydotoold (daemon) must be running for ydotool to work
if command -v ydotool &>/dev/null && ! pgrep -x ydotoold &>/dev/null; then
    warn "ydotoold daemon is not running."
    echo "  To start it now:  sudo systemctl start ydotoold"
    echo "  To enable on boot: sudo systemctl enable ydotoold"
fi

# ── 2. Install groq Python package ───────────────────────────────────────────

info "Checking Python package: groq..."
if python3 -c "import groq" &>/dev/null 2>&1; then
    success "  groq already installed"
else
    info "  Installing groq via pip..."
    pip install --user --quiet groq
    success "  groq installed"
fi

# ── 3. Fetch source files ─────────────────────────────────────────────────────

# Detect if we're already running from inside the cloned repo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/extension/extension.js" && -f "$SCRIPT_DIR/scripts/shotout" ]]; then
    SRC="$SCRIPT_DIR"
    info "Installing from local directory: $SRC"
else
    info "Cloning repository..."
    TMP_DIR="$(mktemp -d)"
    trap 'rm -rf "$TMP_DIR"' EXIT
    git clone --depth=1 "$REPO_URL" "$TMP_DIR/shotout"
    SRC="$TMP_DIR/shotout"
    success "  Repository cloned"
fi

# ── 4. Copy files ─────────────────────────────────────────────────────────────

info "Installing files..."

mkdir -p "$EXT_DIR" "$BIN_DIR" "$CONF_DIR" "$STATS_DIR" "$SHIMS_DIR"

cp "$SRC/extension/extension.js"  "$EXT_DIR/extension.js"
cp "$SRC/extension/metadata.json" "$EXT_DIR/metadata.json"
cp "$SRC/scripts/shotout"         "$BIN_DIR/shotout"
cp "$SRC/scripts/shotout-wrapper" "$BIN_DIR/shotout-wrapper"

chmod +x "$BIN_DIR/shotout" "$BIN_DIR/shotout-wrapper"

success "  Extension → $EXT_DIR"
success "  Scripts   → $BIN_DIR"

# Make sure ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    warn "~/.local/bin is not in PATH."
    echo "  Add this to ~/.bashrc or ~/.bash_profile:"
    echo '    export PATH="$HOME/.local/bin:$PATH"'
fi

# ── 5. API key ────────────────────────────────────────────────────────────────

info "Groq API key setup..."

if [[ -f "$CONF_DIR/key" ]]; then
    success "  API key already saved at $CONF_DIR/key"
    read -rp "  Replace it? [y/N] " replace_key
    if [[ "${replace_key,,}" != y ]]; then
        echo "  Keeping existing key."
        SAVE_KEY=false
    else
        SAVE_KEY=true
    fi
else
    SAVE_KEY=true
fi

if [[ "${SAVE_KEY:-true}" == true ]]; then
    echo "  Get your key at: https://console.groq.com → API Keys"
    echo
    read -rp "  Paste your Groq API key: " api_key
    if [[ -z "$api_key" ]]; then
        warn "  No key provided — you can set it later in $CONF_DIR/key"
    else
        echo "$api_key" > "$CONF_DIR/key"
        chmod 600 "$CONF_DIR/key"
        success "  Key saved to $CONF_DIR/key"
    fi
fi

# ── 6. Enable GNOME extension ─────────────────────────────────────────────────

info "Enabling GNOME Shell extension..."
if gnome-extensions enable "$EXT_UUID" 2>/dev/null; then
    success "  Extension enabled: $EXT_UUID"
else
    warn "  Could not enable extension automatically."
    echo "  You may need to log out and back in first, then run:"
    echo "    gnome-extensions enable $EXT_UUID"
fi

# ── 7. Done ───────────────────────────────────────────────────────────────────

echo
echo -e "${GREEN}${BOLD}Installation complete!${NC}"
echo
echo -e "${BOLD}Next steps:${NC}"
echo
echo -e "  1. ${BOLD}Log out and back in${NC} (or run 'gnome-extensions enable $EXT_UUID')"
echo "     to activate the 🎤 indicator in the top bar."
echo
echo -e "  2. ${BOLD}Assign a hotkey${NC} in GNOME Settings → Keyboard → Custom Shortcuts:"
echo "     Name:    ShotOUT"
echo "     Command: $BIN_DIR/shotout-wrapper"
echo "     Key:     e.g. Super+R or Ctrl+Alt+V"
echo
echo -e "  3. ${BOLD}Make sure ydotoold is running:${NC}"
echo "     sudo systemctl enable --now ydotoold"
echo
echo -e "  Usage:"
echo "     Press hotkey → start recording (🎙 0:07)"
echo "     Press hotkey again → stop + transcribe → text is pasted"
echo "     Click 🎤 icon during recording → cancel (✗)"
echo
