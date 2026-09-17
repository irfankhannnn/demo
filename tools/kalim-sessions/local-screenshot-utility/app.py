"""
Local Screenshot Utility
-------------------------
A tiny Windows tray tool for manually capturing selected screen areas and
combining them into one vertically-stacked image per conversation.

No network access, no OCR, no browser automation, no telemetry.

Hotkeys (global, configurable in config.json):
    Ctrl+Alt+F  Select / create the workspace folder
    Ctrl+Alt+N  Start a new conversation (DM-001, DM-002, ...)
    Ctrl+Alt+S  Show the screen-selection overlay and capture a rectangle
    Ctrl+Alt+E  Finish the conversation: stitch shots into combined.png
"""

import ctypes
import ctypes.wintypes as wintypes
import json
import re
import sys
from pathlib import Path

from PIL import Image
import mss

from PySide6.QtCore import Qt, QRect, QObject, QTimer, QAbstractNativeEventFilter
from PySide6.QtGui import QGuiApplication, QPainter, QColor, QPen, QIcon, QPixmap, QImage, QAction
from PySide6.QtWidgets import (
    QApplication,
    QWidget,
    QSystemTrayIcon,
    QMenu,
    QFileDialog,
    QMessageBox,
)


def app_dir() -> Path:
    """Directory the config file lives next to (the .exe folder when frozen)."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


APP_DIR = app_dir()
CONFIG_PATH = APP_DIR / "config.json"

DEFAULT_CONFIG = {
    "workspace_folder": None,
    "dm_prefix": "DM",
    "dm_number_padding": 3,
    "screenshot_prefix": "screenshot",
    "combined_filename": "combined.png",
    "overlay_tint_rgba": [0, 0, 0, 110],
    "selection_border_rgb": [255, 60, 60],
    "hotkeys": {
        "select_workspace": {"ctrl": True, "alt": True, "key": "F"},
        "new_conversation": {"ctrl": True, "alt": True, "key": "N"},
        "capture": {"ctrl": True, "alt": True, "key": "S"},
        "finish_conversation": {"ctrl": True, "alt": True, "key": "E"},
    },
}

# --- Win32 hotkey plumbing -------------------------------------------------

WM_HOTKEY = 0x0312
MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_NOREPEAT = 0x4000

HOTKEY_IDS = {
    "select_workspace": 1,
    "new_conversation": 2,
    "capture": 3,
    "finish_conversation": 4,
}
ID_TO_NAME = {v: k for k, v in HOTKEY_IDS.items()}

user32 = ctypes.windll.user32


def load_config() -> dict:
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                config = json.load(f)
            merged = dict(DEFAULT_CONFIG)
            merged.update(config)
            return merged
        except (json.JSONDecodeError, OSError):
            pass
    save_config(DEFAULT_CONFIG)
    return dict(DEFAULT_CONFIG)


def save_config(config: dict) -> None:
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
    except OSError:
        pass


def build_modifiers(combo: dict) -> int:
    mods = MOD_NOREPEAT
    if combo.get("ctrl"):
        mods |= MOD_CONTROL
    if combo.get("alt"):
        mods |= MOD_ALT
    return mods


def register_hotkeys(hwnd: int, hotkeys_config: dict) -> list:
    registered = []
    for name, hotkey_id in HOTKEY_IDS.items():
        combo = hotkeys_config[name]
        mods = build_modifiers(combo)
        vk = ord(combo["key"].upper())
        if not user32.RegisterHotKey(hwnd, hotkey_id, mods, vk):
            unregister_hotkeys(hwnd, registered)
            raise OSError(
                f"Could not register hotkey Ctrl+Alt+{combo['key']} for '{name}'. "
                "Another application may already be using it."
            )
        registered.append(hotkey_id)
    return registered


def unregister_hotkeys(hwnd: int, ids: list) -> None:
    for hotkey_id in ids:
        user32.UnregisterHotKey(hwnd, hotkey_id)


class HotkeyFilter(QAbstractNativeEventFilter):
    """Forwards WM_HOTKEY Windows messages to a callback."""

    def __init__(self, callback):
        super().__init__()
        self._callback = callback

    def nativeEventFilter(self, eventType, message):
        if eventType == b"windows_generic_MSG":
            msg = wintypes.MSG.from_address(int(message))
            if msg.message == WM_HOTKEY:
                self._callback(msg.wParam)
        return False, 0


class HiddenHotkeyWindow(QWidget):
    """Invisible native window solely to own a HWND for RegisterHotKey."""

    def __init__(self):
        super().__init__()
        self.setAttribute(Qt.WA_DontShowOnScreen)
        self.setWindowFlags(Qt.Tool | Qt.FramelessWindowHint)
        self.resize(1, 1)
        self.show()


# --- Selection overlay -------------------------------------------------


class SelectionOverlay(QWidget):
    """Full-virtual-desktop frameless window showing a frozen screenshot.

    The user drags a rectangle over it; on release the rectangle (scaled
    into the coordinate space of the already-captured full-resolution
    image) is handed back via on_selected. Esc cancels.
    """

    def __init__(self, pixmap: QPixmap, geometry_rect: QRect, tint_rgba, border_rgb, on_selected, on_cancelled):
        super().__init__()
        self._pixmap = pixmap
        self._tint = QColor(*tint_rgba)
        self._border = QColor(*border_rgb)
        self._on_selected = on_selected
        self._on_cancelled = on_cancelled
        self._origin = None
        self._current = None

        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
        self.setCursor(Qt.CrossCursor)
        self.setGeometry(geometry_rect)
        self.setMouseTracking(True)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self._on_cancelled()

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self._origin = event.position().toPoint()
            self._current = self._origin
            self.update()

    def mouseMoveEvent(self, event):
        if self._origin is not None:
            self._current = event.position().toPoint()
            self.update()

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.LeftButton and self._origin is not None:
            rect = QRect(self._origin, self._current).normalized()
            self._origin = None
            self._current = None
            if rect.width() >= 4 and rect.height() >= 4:
                scale_x = self._pixmap.width() / max(self.width(), 1)
                scale_y = self._pixmap.height() / max(self.height(), 1)
                box = (
                    round(rect.left() * scale_x),
                    round(rect.top() * scale_y),
                    round(rect.right() * scale_x),
                    round(rect.bottom() * scale_y),
                )
                self._on_selected(box)
            else:
                self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.drawPixmap(self.rect(), self._pixmap)

        if self._origin is not None and self._current is not None:
            rect = QRect(self._origin, self._current).normalized()
            top = QRect(0, 0, self.width(), rect.top())
            bottom = QRect(0, rect.bottom(), self.width(), self.height() - rect.bottom())
            left = QRect(0, rect.top(), rect.left(), rect.height())
            right = QRect(rect.right(), rect.top(), self.width() - rect.right(), rect.height())
            for r in (top, bottom, left, right):
                painter.fillRect(r, self._tint)
            painter.setPen(QPen(self._border, 2))
            painter.drawRect(rect)
        else:
            painter.fillRect(self.rect(), self._tint)
        painter.end()


def build_tray_icon() -> QIcon:
    pixmap = QPixmap(64, 64)
    pixmap.fill(Qt.transparent)
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.Antialiasing)
    painter.setPen(Qt.NoPen)
    painter.setBrush(QColor(28, 21, 18))
    painter.drawRoundedRect(4, 16, 56, 38, 8, 8)
    painter.setBrush(QColor(255, 122, 26))
    painter.drawRect(4, 12, 56, 8)
    painter.setBrush(QColor(251, 242, 228))
    painter.drawEllipse(20, 26, 24, 24)
    painter.setBrush(QColor(28, 21, 18))
    painter.drawEllipse(28, 34, 8, 8)
    painter.end()
    return QIcon(pixmap)


# --- Main controller -------------------------------------------------


class TrayApp(QObject):
    def __init__(self, app: QApplication):
        super().__init__()
        self.app = app
        self.config = load_config()

        self.workspace_folder = None
        saved = self.config.get("workspace_folder")
        if saved and Path(saved).is_dir():
            self.workspace_folder = Path(saved)

        self.current_dm_folder = None
        self.current_dm_name = None
        self.shot_paths = []
        self.shot_counter = 0

        self._overlay = None
        self._pending_full_image = None

        self.hidden_window = None
        self.native_filter = None
        self.registered_hotkey_ids = []
        self.tray_icon = None
        self.status_action = None

    # -- lifecycle --

    def start(self):
        self.hidden_window = HiddenHotkeyWindow()
        hwnd = int(self.hidden_window.winId())
        try:
            self.registered_hotkey_ids = register_hotkeys(hwnd, self.config["hotkeys"])
        except OSError as exc:
            QMessageBox.critical(None, "Screenshot Utility", str(exc))
            sys.exit(1)

        self.native_filter = HotkeyFilter(self._queue_hotkey)
        self.app.installNativeEventFilter(self.native_filter)

        self._build_tray_icon()
        self._update_status()
        self._notify(
            "Screenshot Utility running",
            "Ctrl+Alt+F workspace  |  Ctrl+Alt+N new DM  |  Ctrl+Alt+S capture  |  Ctrl+Alt+E finish",
        )

        self.app.aboutToQuit.connect(self._cleanup)

    def _cleanup(self):
        self._close_overlay()
        if self.hidden_window is not None:
            hwnd = int(self.hidden_window.winId())
            unregister_hotkeys(hwnd, self.registered_hotkey_ids)
            self.registered_hotkey_ids = []

    def _build_tray_icon(self):
        self.tray_icon = QSystemTrayIcon(build_tray_icon())
        menu = QMenu()

        self.status_action = QAction("No workspace selected", menu)
        self.status_action.setEnabled(False)
        menu.addAction(self.status_action)
        menu.addSeparator()

        actions = [
            ("Select Workspace Folder\tCtrl+Alt+F", self.action_select_workspace),
            ("New Conversation\tCtrl+Alt+N", self.action_new_conversation),
            ("Capture\tCtrl+Alt+S", self.action_capture),
            ("Finish Conversation\tCtrl+Alt+E", self.action_finish_conversation),
        ]
        for label, slot in actions:
            act = QAction(label, menu)
            act.triggered.connect(slot)
            menu.addAction(act)

        menu.addSeparator()
        quit_act = QAction("Quit", menu)
        quit_act.triggered.connect(self.app.quit)
        menu.addAction(quit_act)

        self.tray_icon.setContextMenu(menu)
        self.tray_icon.setToolTip("Screenshot Utility")
        self.tray_icon.show()

    # -- hotkey dispatch --

    def _queue_hotkey(self, hotkey_id):
        QTimer.singleShot(0, lambda: self._on_hotkey(hotkey_id))

    def _on_hotkey(self, hotkey_id):
        name = ID_TO_NAME.get(hotkey_id)
        dispatch = {
            "select_workspace": self.action_select_workspace,
            "new_conversation": self.action_new_conversation,
            "capture": self.action_capture,
            "finish_conversation": self.action_finish_conversation,
        }
        handler = dispatch.get(name)
        if handler:
            handler()

    # -- helpers --

    def _notify(self, title, message, warning=False):
        if self.tray_icon is None:
            return
        icon = QSystemTrayIcon.MessageIcon.Warning if warning else QSystemTrayIcon.MessageIcon.Information
        self.tray_icon.showMessage(title, message, icon, 4000)

    def _update_status(self):
        if self.current_dm_folder is not None:
            text = f"{self.current_dm_name} — {len(self.shot_paths)} shot(s)"
        elif self.workspace_folder is not None:
            text = f"Workspace: {self.workspace_folder.name} (no active conversation)"
        else:
            text = "No workspace selected"
        if self.status_action is not None:
            self.status_action.setText(text)
        if self.tray_icon is not None:
            self.tray_icon.setToolTip(f"Screenshot Utility — {text}")

    def _next_dm_number(self) -> int:
        prefix = self.config["dm_prefix"]
        pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
        max_num = 0
        if self.workspace_folder and self.workspace_folder.exists():
            for entry in self.workspace_folder.iterdir():
                if entry.is_dir():
                    m = pattern.match(entry.name)
                    if m:
                        max_num = max(max_num, int(m.group(1)))
        return max_num + 1

    # -- actions (Ctrl+Alt+F / N / S / E) --

    def action_select_workspace(self):
        start_dir = str(self.workspace_folder) if self.workspace_folder else str(Path.home())
        chosen = QFileDialog.getExistingDirectory(None, "Select or create workspace folder", start_dir)
        if not chosen:
            return
        self.workspace_folder = Path(chosen)
        self.current_dm_folder = None
        self.current_dm_name = None
        self.shot_paths = []
        self.shot_counter = 0
        self.config["workspace_folder"] = str(self.workspace_folder)
        save_config(self.config)
        self._notify("Workspace set", str(self.workspace_folder))
        self._update_status()

    def action_new_conversation(self):
        if not self.workspace_folder:
            self._notify("No workspace", "Select a workspace folder first (Ctrl+Alt+F).", warning=True)
            return
        if self.shot_paths:
            self._notify(
                "Finish current conversation",
                f"Finish {self.current_dm_name} first (Ctrl+Alt+E).",
                warning=True,
            )
            return

        num = self._next_dm_number()
        padding = self.config.get("dm_number_padding", 3)
        dm_name = f"{self.config['dm_prefix']}-{num:0{padding}d}"
        dm_folder = self.workspace_folder / dm_name
        dm_folder.mkdir(parents=True, exist_ok=True)

        self.current_dm_folder = dm_folder
        self.current_dm_name = dm_name
        self.shot_paths = []
        self.shot_counter = 0
        self._notify("New conversation", f"Started {dm_name}")
        self._update_status()

    def action_capture(self):
        if not self.workspace_folder or not self.current_dm_folder:
            self._notify(
                "No active conversation",
                "Select a workspace and start a new conversation first.",
                warning=True,
            )
            return
        if self._overlay is not None:
            return
        self._start_overlay_selection()

    def action_finish_conversation(self):
        if not self.current_dm_folder:
            self._notify("No active conversation", "Start a new conversation first (Ctrl+Alt+N).", warning=True)
            return
        if not self.shot_paths:
            self._notify("Nothing to finish", "Capture at least one screenshot first (Ctrl+Alt+S).", warning=True)
            return
        self._stitch_and_finish()

    # -- capture flow --

    def _start_overlay_selection(self):
        try:
            with mss.mss() as sct:
                raw = sct.grab(sct.monitors[0])
            full_img = Image.frombytes("RGB", (raw.width, raw.height), raw.bgra, "raw", "BGRX")
        except Exception as exc:  # pragma: no cover - depends on live display
            self._notify("Capture failed", f"Could not read the screen: {exc}", warning=True)
            return

        qimg = QImage(
            full_img.tobytes(), full_img.width, full_img.height, full_img.width * 3, QImage.Format_RGB888
        ).copy()
        pixmap = QPixmap.fromImage(qimg)

        screens = QGuiApplication.screens()
        union_rect = screens[0].geometry()
        for s in screens[1:]:
            union_rect = union_rect.united(s.geometry())

        self._pending_full_image = full_img
        self._overlay = SelectionOverlay(
            pixmap,
            union_rect,
            self.config.get("overlay_tint_rgba", [0, 0, 0, 110]),
            self.config.get("selection_border_rgb", [255, 60, 60]),
            self._on_region_selected,
            self._on_selection_cancelled,
        )
        self._overlay.show()
        self._overlay.activateWindow()
        self._overlay.raise_()

    def _close_overlay(self):
        if self._overlay is not None:
            overlay = self._overlay
            self._overlay = None
            overlay.close()
            overlay.deleteLater()

    def _on_region_selected(self, box):
        self._close_overlay()
        full_img = self._pending_full_image
        self._pending_full_image = None
        try:
            cropped = full_img.crop(box)
            self.shot_counter += 1
            filename = f"{self.config['screenshot_prefix']}_{self.shot_counter:03d}.png"
            path = self.current_dm_folder / filename
            cropped.save(path, "PNG")
            self.shot_paths.append(path)
            self._notify("Captured", f"{filename} saved ({len(self.shot_paths)} total)")
        except Exception as exc:
            self._notify("Capture failed", str(exc), warning=True)
        finally:
            self._update_status()

    def _on_selection_cancelled(self):
        self._close_overlay()
        self._pending_full_image = None

    # -- finish / stitch flow --

    def _stitch_and_finish(self):
        dm_folder = self.current_dm_folder
        dm_name = self.current_dm_name
        paths = list(self.shot_paths)
        combined_path = dm_folder / self.config["combined_filename"]

        images = []
        width = 0
        total_height = 0
        try:
            for p in paths:
                img = Image.open(p)
                img.load()
                if img.mode != "RGB":
                    img = img.convert("RGB")
                images.append(img)

            width = max(img.width for img in images)
            total_height = sum(img.height for img in images)
            combined = Image.new("RGB", (width, total_height), "white")
            y = 0
            for img in images:
                combined.paste(img, (0, y))
                y += img.height
            combined.save(combined_path, "PNG")
        except Exception:
            self._notify("Stitching failed", "Stitching failed — screenshots preserved.", warning=True)
            return
        finally:
            for img in images:
                try:
                    img.close()
                except Exception:
                    pass

        verified = False
        try:
            with Image.open(combined_path) as check_img:
                check_img.load()
                verified = check_img.size == (width, total_height)
        except Exception:
            verified = False

        if not verified:
            self._notify("Stitching failed", "Stitching failed — screenshots preserved.", warning=True)
            return

        for p in paths:
            try:
                p.unlink()
            except OSError:
                pass

        self._notify("Conversation finished", f"{dm_name}: combined.png ready ({len(paths)} shots).")
        self.current_dm_folder = None
        self.current_dm_name = None
        self.shot_paths = []
        self.shot_counter = 0
        self._update_status()


def main():
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)

    if not QSystemTrayIcon.isSystemTrayAvailable():
        QMessageBox.critical(None, "Screenshot Utility", "System tray is not available on this system.")
        sys.exit(1)

    controller = TrayApp(app)
    controller.start()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
