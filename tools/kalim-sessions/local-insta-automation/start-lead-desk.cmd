@echo off
REM Instagram Lead Desk -- one click to open the app.
REM Creates the database from the workbook on first run, then serves the page.

setlocal
cd /d "%~dp0"

if not exist "db\lead-desk.db" (
  echo First run: building db\lead-desk.db
  python scripts\migrate_to_sqlite.py
  if errorlevel 1 (
    echo.
    echo Could not build the database. Check the message above.
    pause
    exit /b 1
  )
)

python scripts\lead_desk_app.py %*
pause
