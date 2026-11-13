$ErrorActionPreference = 'Stop'
$env:PYTHONIOENCODING = 'utf-8'
$lessonRoot = $PSScriptRoot
& (Join-Path $lessonRoot 'update.ps1')
$lessonPython = Join-Path $lessonRoot '../.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $lessonPython)) { $lessonPython = (Get-Command python -ErrorAction Stop).Source }
$lessonPort = if ($env:CLASSROOM_PORT) { [int]$env:CLASSROOM_PORT } else { 18801 }
$lessonUrl = "http://127.0.0.1:$lessonPort"
$lessonInstance = & $lessonPython -c 'import hashlib,pathlib,sys; print(hashlib.sha256(str(pathlib.Path(sys.argv[1]).resolve()).encode()).hexdigest()[:16])' $lessonRoot
$lessonHealth = $null
try { $lessonHealth = Invoke-RestMethod "$lessonUrl/api/health" -TimeoutSec 2 } catch { }
if ($lessonHealth) {
    if ($lessonHealth.instance -ne $lessonInstance -or $lessonHealth.version -ne 6) { throw 'Port is used by another course or an old server. Close that server or set CLASSROOM_PORT to another port.' }
    Start-Process $lessonUrl
    exit
}
$lessonProcess = Start-Process -FilePath $lessonPython -ArgumentList @('"' + (Join-Path $lessonRoot 'server.py') + '"') -WorkingDirectory $lessonRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $lessonRoot 'server.log') -RedirectStandardError (Join-Path $lessonRoot 'server-error.log') -PassThru
for ($lessonAttempt=0; $lessonAttempt -lt 20; $lessonAttempt++) {
    Start-Sleep -Milliseconds 500
    try {
        $lessonHealth = Invoke-RestMethod "$lessonUrl/api/health" -TimeoutSec 1
        if ($lessonHealth.instance -eq $lessonInstance -and $lessonHealth.version -eq 6) { Start-Process $lessonUrl; exit }
    } catch { }
    if ($lessonProcess.HasExited) { break }
}
throw 'Server did not start. Check server-error.log and port availability.'
