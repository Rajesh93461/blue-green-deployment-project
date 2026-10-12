# Usage: ./scripts/deploy.ps1 -Tag v2 [-Broken 1]
# Builds the image and deploys it to the IDLE environment (users do not see it yet).
param(
    [Parameter(Mandatory)][string]$Tag,
    [string]$Broken = '0'
)
. "$PSScriptRoot/common.ps1"
if (-not (Test-Path .active)) {
    & "$PSScriptRoot/setup.ps1"
    if ($LASTEXITCODE -ne 0) { exit 1 }
}
$Idle = Get-Idle
$Var = $Idle.ToUpper() + '_TAG'
Run docker build --build-arg "BROKEN=$Broken" -t "bluegreen-app:$Tag" app/
(Get-Content .env) -replace "^$Var=.*", "$Var=$Tag" | Set-Content .env -Encoding ascii
Run docker compose up -d --no-deps --force-recreate $Idle
Write-Host "Deployed $Tag to $Idle (no user traffic yet)"
