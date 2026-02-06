# PowerShell script to create a desktop shortcut for development (no black console window)
# Run this script: .\create-shortcut.ps1

$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "Speech Therapy Clinic.lnk"
$VbsPath = Join-Path $PSScriptRoot "run-app-no-console.vbs"

# Create a VBS launcher that runs Electron without showing a console window
$escaped = $PSScriptRoot -replace '\\', '\\'
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$escaped"
WshShell.Run "cmd /c node ""$escaped\node_modules\.bin\electron.cmd"" ""$escaped""", 0, False
"@
Set-Content -Path $VbsPath -Value $vbsContent -Encoding ASCII

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$VbsPath`""
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.IconLocation = "$PSScriptRoot\build\icon.ico"
$Shortcut.Description = "Speech Therapy Clinic Desktop App"
$Shortcut.Save()

Write-Host "✅ Desktop shortcut created successfully!" -ForegroundColor Green
Write-Host "   Location: $ShortcutPath" -ForegroundColor Cyan
Write-Host "   (Launcher runs without a black console window)" -ForegroundColor Gray
