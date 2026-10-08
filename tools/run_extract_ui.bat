@echo off
echo Codex of Verra: exporting skill tree art from the game files...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0extract_ui.ps1"
echo.
pause
