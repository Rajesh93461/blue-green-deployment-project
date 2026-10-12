# Usage: ./scripts/health.ps1 -Target green      (blue | green | router)
param([Parameter(Mandatory)][ValidateSet('blue','green','router')][string]$Target)
. "$PSScriptRoot/common.ps1"
$port = @{ blue = 5001; green = 5002; router = 8080 }[$Target]
for ($i = 1; $i -le 10; $i++) {
    try {
        $r = Invoke-WebRequest "http://localhost:$port/health" -UseBasicParsing
        if ($r.StatusCode -eq 200) { Write-Host "Health check PASSED on $Target"; exit 0 }
    } catch { }
    Write-Host "Attempt $i failed, retrying..."
    Start-Sleep 2
}
Write-Host "Health check FAILED on $Target"
exit 1
