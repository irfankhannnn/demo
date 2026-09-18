@echo off
setlocal

echo Installing/upgrading dependencies (PySide6, Pillow, mss, pyinstaller)...
python -m pip install --upgrade -r requirements.txt pyinstaller
if errorlevel 1 goto :error

echo.
echo Building ScreenshotUtility.exe with PyInstaller...
python -m PyInstaller --noconfirm --onefile --windowed --name ScreenshotUtility app.py
if errorlevel 1 goto :error

echo.
echo Build complete: dist\ScreenshotUtility.exe
echo A default config.json will be created next to the .exe the first time it runs.
goto :eof

:error
echo.
echo Build failed.
exit /b 1
