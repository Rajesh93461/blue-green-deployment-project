# Sends traffic back to the previous environment.
. "$PSScriptRoot/common.ps1"
$previous = Get-Idle
& "$PSScriptRoot/switch.ps1" -Target $previous
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "ROLLBACK complete"
