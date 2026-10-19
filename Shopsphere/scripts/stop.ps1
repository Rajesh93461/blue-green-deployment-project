# Stops and removes all containers and the routing volume.
Set-Location (Split-Path $PSScriptRoot -Parent)
docker compose down -v
