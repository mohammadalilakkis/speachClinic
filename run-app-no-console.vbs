Set WshShell = CreateObject("WScript.Shell")
runCmd = """C:\\Users\\acer\\Desktop\\clinic\node_modules\.bin\electron.cmd"" ""C:\\Users\\acer\\Desktop\\clinic"""
' #region agent log - write when shortcut is double-clicked
Set fso = CreateObject("Scripting.FileSystemObject")
jsonCmd = Replace(Replace(runCmd, "\", "\\"), """", Chr(92) & """")
logLine = "{""message"":""VBS run"",""data"":{""runCmd"":""" & jsonCmd & """}}"
On Error Resume Next
Set logFile = fso.OpenTextFile("c:\Users\acer\Desktop\clinic\.cursor\debug.log", 8, True)
If Not logFile Is Nothing Then logFile.WriteLine logLine: logFile.Close
On Error Goto 0
' #endregion
On Error Resume Next
WshShell.Environment("Process")("PATH") = "C:\\\\Program Files\\\\nodejs;" & WshShell.Environment("User")("PATH") & ";" & WshShell.Environment("Machine")("PATH")
On Error Goto 0
WshShell.CurrentDirectory = "C:\\Users\\acer\\Desktop\\clinic"
WshShell.Run runCmd, 0, False
