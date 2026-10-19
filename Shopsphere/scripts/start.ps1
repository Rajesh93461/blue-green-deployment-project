# Builds and starts everything: Blue, Green, Nginx router and the Deployment Console.
Set-Location (Split-Path $PSScriptRoot -Parent)
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: docker compose failed. Is Docker Desktop running?"; exit 1 }
Write-Host ""
Write-Host "READY"
Write-Host "  Deployment Console : http://localhost:9000   <-- start here"
Write-Host "  Users (via Nginx)  : http://localhost:8080   (BLUE v1.0 is live)"
Write-Host "  Blue directly      : http://localhost:3001"
Write-Host "  Green directly     : http://localhost:3002"
