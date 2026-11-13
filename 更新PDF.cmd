@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0lesson\update.ps1" -Pdf
pause
