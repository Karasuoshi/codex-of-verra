@echo off
echo Codex of Verra: exporting icons from the game files...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0extract_icons.ps1"
echo.
pause
