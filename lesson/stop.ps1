$ErrorActionPreference = 'Stop'
$env:PYTHONIOENCODING = 'utf-8'
$lessonPython = Join-Path $PSScriptRoot '../.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $lessonPython)) { $lessonPython = (Get-Command python -ErrorAction Stop).Source }
& $lessonPython (Join-Path $PSScriptRoot 'stop_server.py')
if ($LASTEXITCODE -ne 0) { throw 'The service was not stopped. Read the message above.' }
