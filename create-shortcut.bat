@echo off
REM Runs the PowerShell script to create the desktop shortcut (no console window when app runs)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-shortcut.ps1"
pause
