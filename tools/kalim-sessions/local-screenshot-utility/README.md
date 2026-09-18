# Local Screenshot Utility

A very small Windows tray tool for **manually** capturing selected screen
areas and combining them into one vertically-stacked image per conversation.

It is a generic screenshot tool. It does **not** talk to Instagram, Meta,
any website, or the network in any way — there is no HTTP client, no OCR, no
browser automation, and no telemetry in the codebase.

## Requirements

* Windows 10/11
* Python 3.12+

## Setup

```bat
cd local-screenshot-utility
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The app has no window — it runs quietly in the **system tray** (bottom-right
icon tray). Look for a small camera-style icon. Right-click it for a menu, or
use the global hotkeys below.

## Workflow & hotkeys

| Hotkey | Action |
|---|---|
| `Ctrl+Alt+F` | Select (or create) the workspace folder |
| `Ctrl+Alt+N` | Start a new conversation: `DM-001`, `DM-002`, ... |
| `Ctrl+Alt+S` | Show the screen-selection overlay and capture the dragged rectangle |
| `Ctrl+Alt+E` | Finish the current conversation: stitch all captures into `combined.png` |

Typical use:

1. `Ctrl+Alt+F` → pick or create a workspace folder (e.g. `DM-Capture`).
2. `Ctrl+Alt+N` → creates `DM-001` inside the workspace.
3. `Ctrl+Alt+S` → screen dims, drag a rectangle over the area you want, release
   to capture. A tray notification confirms the shot was saved.
4. Manually scroll the browser/app to the next section.
5. `Ctrl+Alt+S` again → capture the next rectangle. Repeat as needed.
6. `Ctrl+Alt+E` → all captured shots for `DM-001` are stitched top-to-bottom,
   in capture order, into `DM-001/combined.png`. Once that file is verified
   readable, the individual screenshots are deleted, leaving only
   `combined.png` in the folder.
7. `Ctrl+Alt+N` again to start `DM-002`, and so on.

Press `Esc` at any time during the selection overlay to cancel that capture.

Result:

```text
DM-Capture/
├── DM-001/
│   └── combined.png
├── DM-002/
│   └── combined.png
└── DM-003/
    └── combined.png
```

## Configuration

`config.json` (next to `app.py`, or next to the built `.exe`) controls:

* `dm_prefix` / `dm_number_padding` — conversation folder naming (`DM-001`, ...)
* `screenshot_prefix` — temporary per-shot filename prefix
* `combined_filename` — output filename (`combined.png`)
* `overlay_tint_rgba` / `selection_border_rgb` — selection overlay colors
* `hotkeys` — the four global hotkeys (modifier flags + key letter)
* `workspace_folder` — remembers the last-selected workspace so you don't
  have to press `Ctrl+Alt+F` again on every launch (still fully overridable)

If `config.json` is missing, a default one is written automatically on first
run.

## Error handling

If stitching a conversation's screenshots fails for any reason, the tool
**never deletes** the source screenshots. It shows:

```
Stitching failed — screenshots preserved.
```

You can retry `Ctrl+Alt+E` after fixing the problem (e.g. freeing disk
space); the individual screenshots are still there.

## Notes / limitations

* Capture is screen-based (via `mss`), so it works the same regardless of
  which application is on screen (browser, desktop app, etc.) — there is no
  website or app detection of any kind.
* The selection overlay is drawn over a frozen screenshot of the whole
  virtual desktop, so what you see while dragging is a snapshot, not a live
  feed — this is intentional (like Windows Snipping Tool) and keeps DPI
  scaling / multi-monitor coordinate math simple and correct: the final crop
  is taken from the original full-resolution capture, not from the on-screen
  overlay rendering.
* On very unusual mixed-DPI multi-monitor setups, the overlay's on-screen
  preview may be drawn at a very slightly different scale than the real
  desktop across a monitor boundary; the captured pixels themselves are
  always exact because they come directly from the frozen full-resolution
  capture.
* If another running application already owns `Ctrl+Alt+F/N/S/E`, the tool
  will show an error on startup naming the conflicting hotkey — free it up
  (or edit `config.json` to use different keys) and relaunch.

## Building a standalone .exe

```bat
build.bat
```

This installs `pyinstaller` (plus the runtime requirements) and produces
`dist\ScreenshotUtility.exe` — a single-file, windowless executable. Copy
that `.exe` anywhere; a `config.json` will be created next to it the first
time it runs.

## Manual test checklist

This exact workflow should be run once after any change:

1. Launch the app (`python app.py` or the built `.exe`) — tray icon appears,
   a startup notification lists the four hotkeys.
2. `Ctrl+Alt+F` → select/create a test folder, e.g. `DM-Capture`.
3. `Ctrl+Alt+N` → `DM-001` folder is created inside it.
4. `Ctrl+Alt+S` → drag a rectangle over some on-screen content → notification
   confirms `screenshot_001.png` saved.
5. Manually scroll the window you're capturing from.
6. `Ctrl+Alt+S` again → `screenshot_002.png` saved.
7. `Ctrl+Alt+E` → notification confirms the conversation is finished;
   `DM-001/combined.png` exists and is a single image with both shots
   stacked vertically in capture order; the two `screenshot_*.png` files
   are gone; `DM-001/` contains only `combined.png`.
8. `Ctrl+Alt+N` → `DM-002` is created; repeat capture/finish to confirm
   numbering increments correctly and multiple conversations coexist.
