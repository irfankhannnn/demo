@echo off
rem Double-click this file to reopen your workspace for this repo:
rem   Tab 1 "Claude Code" -> resumes your EXACT last Claude Code session in
rem                          this repo via `claude --continue` (not a fork,
rem                          not a new conversation - the same session).
rem   Tab 2 "Shell"       -> a plain PowerShell prompt in the same repo.
rem
rem This file is not committed to git (see .gitignore) - it is a personal,
rem machine-local launcher.

setlocal EnableExtensions

rem Resolve the repo root as the parent folder of this script.
set "REPO=%~dp0.."
for %%I in ("%REPO%") do set "REPO=%%~fI"

start "" wt.exe -w 0 nt --title "Claude Code" -d "%REPO%" powershell -NoExit -Command "claude --continue" ; nt --title "Shell" -d "%REPO%" powershell -NoExit

endlocal
