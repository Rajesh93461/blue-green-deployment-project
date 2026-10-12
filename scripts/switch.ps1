# Usage: ./scripts/switch.ps1 -Target green      (blue | green)
# Points Nginx at the chosen environment.
param([Parameter(Mandatory)][ValidateSet('blue','green')][string]$Target)
. "$PSScriptRoot/common.ps1"
Run docker cp "nginx/$Target.conf" app-router:/etc/nginx/conf.d/default.conf
Run docker exec app-router nginx -s reload
Set-Content .active $Target -Encoding ascii
Write-Host "Traffic switched -> $Target"
