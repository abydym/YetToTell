param([switch]$Watch, [switch]$Pdf)
$ErrorActionPreference = 'Stop'
$env:PYTHONIOENCODING = 'utf-8'
$lessonPython = Join-Path $PSScriptRoot '../.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $lessonPython)) { $lessonPython = (Get-Command python -ErrorAction Stop).Source }
$lessonArgs = @((Join-Path $PSScriptRoot 'build_markdown.py'))
if ($Watch) { $lessonArgs += '--watch' }
& $lessonPython @lessonArgs
if ($LASTEXITCODE -ne 0) { throw 'Markdown build failed. Read the error above.' }
if ($Pdf) {
    foreach ($lessonMode in @('student','teacher')) {
        & $lessonPython (Join-Path $PSScriptRoot 'pdf_export.py') --mode $lessonMode --scope core
        if ($LASTEXITCODE -ne 0) { throw 'PDF export failed. Install requirements.txt and Microsoft Edge first.' }
    }
}
