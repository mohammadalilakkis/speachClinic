# PowerShell script to create a desktop shortcut for development (no black console window)
# Run this script: .\create-shortcut.ps1

# #region agent log
$logPath = "c:\Users\acer\Desktop\clinic\.cursor\debug.log"
$dbg = @{ id = "log_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"; timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); location = "create-shortcut.ps1:entry"; message = "Script started"; data = @{ PSScriptRoot = $PSScriptRoot }; hypothesisId = "H1" } | ConvertTo-Json -Compress
Add-Content -Path $logPath -Value $dbg -Encoding UTF8
# #endregion

$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "Clinic Desk.lnk"
$VbsPath = Join-Path $PSScriptRoot "run-app-no-console.vbs"

# Create a VBS launcher that runs Electron without showing a console window
$escaped = $PSScriptRoot -replace '\\', '\\'
# Prepend Node's directory to PATH so node is found when shortcut runs (e.g. from Explorer)
$nodeDir = ""
try { $nodeExe = (Get-Command node -ErrorAction Stop).Source; $nodeDir = [System.IO.Path]::GetDirectoryName($nodeExe) } catch { }
$pathRhs = if ($nodeDir) {
  $nodeDirEsc = $nodeDir -replace '\\', '\\\\'
  "`"$nodeDirEsc;`" & WshShell.Environment(""User"")(""PATH"") & "";"" & WshShell.Environment(""Machine"")(""PATH"")"
} else {
  "WshShell.Environment(""User"")(""PATH"") & "";"" & WshShell.Environment(""Machine"")(""PATH"")"
}
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
runCmd = """$escaped\node_modules\.bin\electron.cmd"" ""$escaped"""
' #region agent log - write when shortcut is double-clicked
Set fso = CreateObject("Scripting.FileSystemObject")
jsonCmd = Replace(Replace(runCmd, "\", "\\"), """", Chr(92) & """")
logLine = "{""message"":""VBS run"",""data"":{""runCmd"":""" & jsonCmd & """}}"
On Error Resume Next
Set logFile = fso.OpenTextFile("$logPath", 8, True)
If Not logFile Is Nothing Then logFile.WriteLine logLine: logFile.Close
On Error Goto 0
' #endregion
On Error Resume Next
WshShell.Environment("Process")("PATH") = $pathRhs
On Error Goto 0
WshShell.CurrentDirectory = "$escaped"
WshShell.Run runCmd, 0, False
"@
Set-Content -Path $VbsPath -Value $vbsContent -Encoding ASCII

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$VbsPath`""
$Shortcut.WorkingDirectory = $PSScriptRoot
$iconPath = Join-Path $PSScriptRoot "build\icon.ico"
$iconPathAbs = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "build\icon.ico"))
$iconExists = Test-Path -LiteralPath $iconPath
# #region agent log
$dbg2 = @{ id = "log_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"; timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); location = "create-shortcut.ps1:icon"; message = "Icon path check"; data = @{ iconPath = $iconPath; iconPathAbs = $iconPathAbs; iconExists = $iconExists }; hypothesisId = "H1,H3,H4" } | ConvertTo-Json -Compress
Add-Content -Path $logPath -Value $dbg2 -Encoding UTF8
# #endregion
$iconLocationOriginal = "$PSScriptRoot\build\icon.ico"
# #region agent log
$dbg3 = @{ id = "log_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"; timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); location = "create-shortcut.ps1:iconLocation"; message = "IconLocation value"; data = @{ iconLocationOriginal = $iconLocationOriginal; iconPathAbs = $iconPathAbs }; hypothesisId = "H2,H5" } | ConvertTo-Json -Compress
Add-Content -Path $logPath -Value $dbg3 -Encoding UTF8
# #endregion
$Shortcut.IconLocation = $iconLocationOriginal
$Shortcut.Description = "Clinic Desk"
$Shortcut.Save()
# #region agent log
$dbg4 = @{ id = "log_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"; timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); location = "create-shortcut.ps1:save"; message = "Shortcut saved"; data = @{ ShortcutPath = $ShortcutPath; IconLocationSet = $Shortcut.IconLocation }; hypothesisId = "H2,H5" } | ConvertTo-Json -Compress
Add-Content -Path $logPath -Value $dbg4 -Encoding UTF8
# #endregion

Write-Host "✅ Desktop shortcut created successfully!" -ForegroundColor Green
Write-Host "   Location: $ShortcutPath" -ForegroundColor Cyan
Write-Host "   (Launcher runs without a black console window)" -ForegroundColor Gray
