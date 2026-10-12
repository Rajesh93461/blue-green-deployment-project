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
