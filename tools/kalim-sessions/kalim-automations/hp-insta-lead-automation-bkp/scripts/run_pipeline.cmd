@echo off
rem Called by the Windows scheduled task "HP Insta Lead Automation" every 6 hours.
rem Runs the full fetch -> analyse -> Excel -> dashboard pipeline. Output: logs\scheduler.log
setlocal
cd /d "%~dp0.."
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
set PATH=%USERPROFILE%\.local\bin;%PATH%
echo. >> logs\scheduler.log
echo ===== %DATE% %TIME% ===== >> logs\scheduler.log
"C:\Python313\python.exe" scripts\run_pipeline.py %* >> logs\scheduler.log 2>&1
echo exit %ERRORLEVEL% >> logs\scheduler.log
endlocal
