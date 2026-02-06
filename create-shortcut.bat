@echo off
REM Batch script to create a desktop shortcut for development
REM Run this script: create-shortcut.bat

set SCRIPT_DIR=%~dp0
set DESKTOP=%USERPROFILE%\Desktop
set SHORTCUT_NAME=Speech Therapy Clinic.lnk

echo Creating desktop shortcut...

REM Create VBScript to create shortcut
set VBS_FILE=%TEMP%\create_shortcut.vbs
(
echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
echo sLinkFile = "%DESKTOP%\%SHORTCUT_NAME%"
echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
echo oLink.TargetPath = "node"
echo oLink.Arguments = """%SCRIPT_DIR%node_modules\.bin\electron.cmd"" ""%SCRIPT_DIR%"""
echo oLink.WorkingDirectory = "%SCRIPT_DIR%"
echo oLink.IconLocation = "%SCRIPT_DIR%build\icon.ico"
echo oLink.Description = "Speech Therapy Clinic Desktop App"
echo oLink.Save
) > "%VBS_FILE%"

cscript //nologo "%VBS_FILE%"
del "%VBS_FILE%"

echo.
echo ✅ Desktop shortcut created successfully!
echo    Location: %DESKTOP%\%SHORTCUT_NAME%
pause
