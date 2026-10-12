# One-time setup: builds v1, starts Blue + Green + Nginx. Blue is live.
. "$PSScriptRoot/common.ps1"
Run docker build -t bluegreen-app:v1 app/
Set-Content .env "BLUE_TAG=v1`nGREEN_TAG=v1" -Encoding ascii
Run docker compose up -d
Run docker cp nginx/blue.conf app-router:/etc/nginx/conf.d/default.conf
Run docker exec app-router nginx -s reload
Set-Content .active blue -Encoding ascii
Write-Host "Ready: http://localhost:8080 -> BLUE (v1)"
