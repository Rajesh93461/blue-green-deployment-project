# Shared helpers used by all scripts
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path $PSScriptRoot -Parent)   # always work from the project folder

# Run a command; stop the script if it fails
function Run {
    $cmd = $args[0]
    $rest = @($args | Select-Object -Skip 1)
    & $cmd @rest
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: command failed: $args"; exit 1 }
}

# Which environment is live? (stored in the .active file)
function Get-Active {
    if (Test-Path .active) { (Get-Content .active -Raw).Trim() } else { 'blue' }
}

# The other environment is the idle one
function Get-Idle {
    if ((Get-Active) -eq 'blue') { 'green' } else { 'blue' }
}
