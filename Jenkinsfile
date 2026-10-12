pipeline {
  agent any
  parameters {
    booleanParam(name: 'SIMULATE_BUG', defaultValue: false,
                 description: 'Deploy a faulty version to prove traffic is NOT switched')
  }
  environment { TAG = "v${env.BUILD_NUMBER}" }

  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Test') {
      steps {
        sh '''docker run --rm -v "$PWD/app:/app" -w /app python:3.12-slim \
              sh -c "pip install -q -r requirements.txt pytest && pytest -q"'''
      }
    }

    stage('Build & Deploy to Idle') {
      steps {
        script { env.IDLE = sh(script: './scripts/idle.sh', returnStdout: true).trim() }
        sh "BROKEN=${params.SIMULATE_BUG ? 1 : 0} ./scripts/deploy.sh ${TAG}"
      }
    }

    stage('Health Check') { steps { sh "./scripts/health.sh ${env.IDLE}" } }

    stage('Switch Traffic') { steps { sh "./scripts/switch.sh ${env.IDLE}" } }

    stage('Verify Production') {
      steps { sh './scripts/health.sh router || (./scripts/rollback.sh && exit 1)' }
    }
  }

  post {
    success { echo "Release ${TAG} is LIVE on ${env.IDLE}" }
    failure { echo "Release ${TAG} failed. Users are still on the previous stable version." }
  }
}
