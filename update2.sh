#!/usr/bin/env bash
# Run once inside your bluegreen-project folder: bash update2.sh
set -e
mkdir -p scripts app
rm -rf jenkins scripts/*.sh
cat > app/Dockerfile <<'END_OF_FILE'
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py test_app.py ./
# BROKEN=1 builds a deliberately faulty version (used to demo failed health check)
ARG BROKEN=0
ENV BROKEN=$BROKEN
EXPOSE 5000
CMD ["gunicorn", "-b", "0.0.0.0:5000", "app:app"]
END_OF_FILE
cat > docker-compose.yml <<'END_OF_FILE'
name: bluegreen
services:
  blue:
    image: bluegreen-app:${BLUE_TAG:-v1}
    container_name: app-blue
    environment:
      - ENV_NAME=blue
      - APP_VERSION=${BLUE_TAG:-v1}
    ports: ["5001:5000"]      # direct access for health checks

  green:
    image: bluegreen-app:${GREEN_TAG:-v1}
    container_name: app-green
    environment:
      - ENV_NAME=green
      - APP_VERSION=${GREEN_TAG:-v1}
    ports: ["5002:5000"]      # direct access for health checks

  router:
    image: nginx:1.27-alpine
    container_name: app-router
    ports: ["8080:80"]        # users always visit http://localhost:8080
    depends_on: [blue, green]
END_OF_FILE
cat > Jenkinsfile <<'END_OF_FILE'
pipeline {
  agent any
  parameters {
    booleanParam(name: 'SIMULATE_BUG', defaultValue: false,
                 description: 'Deploy a faulty version to prove traffic is NOT switched')
  }
  environment { TAG = "v2.${env.BUILD_NUMBER}" }

  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Test') {
      steps {
        powershell '''
          docker build -t bluegreen-test app/
          if ($LASTEXITCODE -ne 0) { exit 1 }
          docker run --rm --entrypoint sh bluegreen-test -c "pip install -q pytest && pytest -q"
          if ($LASTEXITCODE -ne 0) { exit 1 }
        '''
      }
    }

    stage('Build & Deploy to Idle') {
      steps {
        script { env.IDLE = powershell(script: './scripts/idle.ps1', returnStdout: true).trim() }
        powershell "./scripts/deploy.ps1 -Tag ${TAG} -Broken ${params.SIMULATE_BUG ? 1 : 0}"
      }
    }

    stage('Health Check') { steps { powershell "./scripts/health.ps1 -Target ${env.IDLE}" } }

    stage('Switch Traffic') { steps { powershell "./scripts/switch.ps1 -Target ${env.IDLE}" } }

    stage('Verify Production') {
      steps {
        powershell '''
          ./scripts/health.ps1 -Target router
          if ($LASTEXITCODE -ne 0) { ./scripts/rollback.ps1; exit 1 }
        '''
      }
    }
  }

  post {
    success { echo "Release ${TAG} is LIVE on ${env.IDLE}" }
    failure { echo "Release ${TAG} failed. Users are still on the previous stable version." }
  }
}
END_OF_FILE
cat > scripts/common.ps1 <<'END_OF_FILE'
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
END_OF_FILE
cat > scripts/setup.ps1 <<'END_OF_FILE'
# One-time setup: builds v1, starts Blue + Green + Nginx. Blue is live.
. "$PSScriptRoot/common.ps1"
Run docker build -t bluegreen-app:v1 app/
Set-Content .env "BLUE_TAG=v1`nGREEN_TAG=v1" -Encoding ascii
Run docker compose up -d
Run docker cp nginx/blue.conf app-router:/etc/nginx/conf.d/default.conf
Run docker exec app-router nginx -s reload
Set-Content .active blue -Encoding ascii
Write-Host "Ready: http://localhost:8080 -> BLUE (v1)"
END_OF_FILE
cat > scripts/idle.ps1 <<'END_OF_FILE'
# Prints the environment that is NOT serving users.
. "$PSScriptRoot/common.ps1"
Write-Output (Get-Idle)
END_OF_FILE
cat > scripts/deploy.ps1 <<'END_OF_FILE'
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
END_OF_FILE
cat > scripts/health.ps1 <<'END_OF_FILE'
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
END_OF_FILE
cat > scripts/switch.ps1 <<'END_OF_FILE'
# Usage: ./scripts/switch.ps1 -Target green      (blue | green)
# Points Nginx at the chosen environment.
param([Parameter(Mandatory)][ValidateSet('blue','green')][string]$Target)
. "$PSScriptRoot/common.ps1"
Run docker cp "nginx/$Target.conf" app-router:/etc/nginx/conf.d/default.conf
Run docker exec app-router nginx -s reload
Set-Content .active $Target -Encoding ascii
Write-Host "Traffic switched -> $Target"
END_OF_FILE
cat > scripts/rollback.ps1 <<'END_OF_FILE'
# Sends traffic back to the previous environment.
. "$PSScriptRoot/common.ps1"
$previous = Get-Idle
& "$PSScriptRoot/switch.ps1" -Target $previous
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "ROLLBACK complete"
END_OF_FILE
echo "Update applied: scripts are now PowerShell (.ps1)."
