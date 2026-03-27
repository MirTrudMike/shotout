# ShotOUT

Voice input for Fedora (GNOME, Wayland). Press a hotkey — speak — press again — text is pasted into the active field.

Powered by Groq Whisper API (fast, accurate, free tier available).

```
┌─────────────────────────────────────────────┐
│  Activities   [App name]        🎤  ···  EN │  ← idle
│  Activities   [App name]       🎙 0:07  ···  │  ← recording
│  Activities   [App name]  ⏳ RECOGNIZING ··· │  ← transcribing
│  Activities   [App name]        ✗  ···  EN  │  ← cancelled
└─────────────────────────────────────────────┘
```

## Requirements

- Fedora 39+ with GNOME 45+
- Wayland session
- Groq API key (free registration)

## Step 0: Get a Groq API key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up → API Keys → Create API key
3. Copy the key — you'll need it during installation

## Installation

### One-liner

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/shotout/main/install.sh)
```

The script will:
- Check dependencies and suggest how to install any missing ones
- Install the `groq` Python package if needed
- Ask for your Groq API key and save it to `~/.config/shotout/key`
- Copy files to the right places
- Enable the GNOME extension

### Dependencies (install manually if missing)

```bash
sudo dnf install sox wl-clipboard ydotool python3
sudo systemctl enable --now ydotoold
```

### After installation

Enable the keyboard input simulation daemon:
```bash
sudo systemctl enable --now ydotoold
```

Log out and back in so the 🎤 indicator appears in the top bar.

## Assign a hotkey

**GNOME Settings → Keyboard → View and Customize Shortcuts → Custom Shortcuts → +**

| Field    | Value                                                    |
|----------|----------------------------------------------------------|
| Name     | ShotOUT                                                  |
| Command  | `/home/YOUR_LINUX_USERNAME/.local/bin/shotout-wrapper`   |
| Shortcut | Super+R (or anything you like)                           |

> Use the full path in Command, not just `shotout-wrapper` — GNOME does not include `~/.local/bin` in its PATH when executing hotkey commands.

## Usage

| Action | Result |
|--------|--------|
| Hotkey (first press) | Start recording. Indicator: 🎙 0:07 |
| Hotkey (second press) | Stop recording → transcribe → paste text |
| Click 🎤 during recording | Cancel without transcription. Indicator: ✗ |
| Click 🎤 while idle | Open stats menu |

## Top bar indicator

| Icon | State |
|------|-------|
| 🎤 | Idle |
| 🎙 0:07 | Recording, timer in m:ss |
| 🎙 *orange pulse* | Less than 10 seconds left before the recording limit |
| ⏳ RECOGNIZING | Transcription in progress |
| ✗ | Recording cancelled (~2 seconds) |

The idle menu shows today's and this month's stats: request count and total recorded time.

## Configuration

Parameters live in two files:

### `~/.local/bin/shotout-wrapper` — recording settings

```python
TAIL_DELAY         = 1.5      # extra seconds of recording after stop hotkey (catches last words)
MAX_RECORDING_SECS = 5 * 60  # auto-stop after this many seconds
```

### `~/.local/share/gnome-shell/extensions/shotout@local/extension.js` — indicator settings

```javascript
const WARNING_SECS = 10;  // seconds before the limit when the orange pulse starts
```

### Applying changes

**`shotout-wrapper`** — changes take effect immediately on the next run. No restart needed.

**`extension.js`** — GNOME Shell caches the extension. After editing, reload it:

```bash
gnome-extensions disable shotout@local
gnome-extensions enable shotout@local
```

On Wayland, Alt+F2 is not available, so the only reliable way is to log out and back in.

## File layout

```
~/.local/bin/shotout              — main script (sox + Groq API)
~/.local/bin/shotout-wrapper      — wrapper (status, watchdog, stats)
~/.local/share/gnome-shell/extensions/shotout@local/
    extension.js                  — GNOME Shell extension
    metadata.json
~/.config/shotout/key             — Groq API key
~/.local/share/shotout/stats.json — usage stats
```

## How it works

1. Hotkey runs `shotout-wrapper`
2. Wrapper writes status to `/tmp/shotout-status` (recording / recognizing / idle)
3. Starts `shotout` (records via `sox`) and a background watchdog process
4. Watchdog watches `/tmp/shotout-cancel` (cancel click) and the time limit
5. On stop: TAIL_DELAY seconds of extra recording → `shotout` sends audio to Groq API → `wl-copy` + `ydotool` pastes the text
6. The extension reads `/tmp/shotout-status` every 500ms and updates the indicator

## Updating

Just run the installer again — it will overwrite the files:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/shotout/main/install.sh)
```

Your API key will be kept unless you choose to replace it.
