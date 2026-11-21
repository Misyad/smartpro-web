// Declarative pipeline: test, build a Docker image, smoke-test it, then push and deploy.
// Install, lint, and test run inside a container so the pipeline does not depend on
// tools installed on the Jenkins agent itself.
//
// Configure these as Jenkins credentials / global env or edit the defaults below:
//   DOCKER_REGISTRY   e.g. docker.io/youruser  (or a private registry host)
//   IMAGE_NAME        e.g. smartpro-web
//   REGISTRY_CRED_ID  Jenkins credentials id for docker login (username/password)
//   DEPLOY_HOST       target ssh host for docker deploy (optional)
//   DEPLOY_CRED_ID    Jenkins ssh credentials id for DEPLOY_HOST (optional)

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  environment {
    IMAGE_NAME        = "${env.IMAGE_NAME ?: 'smartpro-web'}"
    DOCKER_REGISTRY   = "${env.DOCKER_REGISTRY ?: 'docker.io/youruser'}"
    IMAGE_TAG         = "${env.BUILD_NUMBER}"
    IMAGE             = "${DOCKER_REGISTRY}/${IMAGE_NAME}"
    CONTAINER_NAME    = 'smartpro-web'
    APP_PORT          = '3050'
    REGISTRY_CRED_ID  = "${env.REGISTRY_CRED_ID ?: 'docker-registry-credentials'}"
    BUILD_IMAGE       = 'oven/bun:1'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Lint & Test') {
      steps {
        // Run inside a container: the host Node on this agent is broken (missing libatomic).
        // The inner commands live in a script file so quoting stays simple and reliable.
        // Run as the workspace owner so generated files stay removable by cleanWs().
        writeFile file: '.ci-lint-test.sh', text: '#!/bin/sh\nset -e\nbun install --frozen-lockfile\nbun run lint\nbun run test\n'
        sh """
          docker run --rm \
            --user "\$(id -u):\$(id -g)" \
            -e HOME=/tmp \
            -v "\$WORKSPACE":/app \
            -w /app \
            ${BUILD_IMAGE} \
            sh /app/.ci-lint-test.sh
        """
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'junit.xml'
        }
      }
    }

    stage('Build Image') {
      steps {
        sh """
          docker build \
            --label "org.opencontainers.image.revision=${env.GIT_COMMIT}" \
            --label "org.opencontainers.image.source=${env.GIT_URL}" \
            -t ${IMAGE}:${IMAGE_TAG} \
            -t ${IMAGE}:latest \
            .
        """
      }
    }

    stage('Smoke Test') {
      steps {
        sh """
          set -e
          docker rm -f ${CONTAINER_NAME}-smoke 2>/dev/null || true
          docker run -d --name ${CONTAINER_NAME}-smoke -p ${APP_PORT}:${APP_PORT} ${IMAGE}:${IMAGE_TAG}
          for i in \$(seq 1 30); do
            if docker exec ${CONTAINER_NAME}-smoke node -e "fetch('http://127.0.0.1:${APP_PORT}/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
              echo "Smoke test passed"; break
            fi
            if [ "\$i" = "30" ]; then echo "Smoke test failed"; docker logs ${CONTAINER_NAME}-smoke; exit 1; fi
            sleep 2
          done
          docker rm -f ${CONTAINER_NAME}-smoke
        """
      }
    }

    stage('Push Image') {
      when { anyOf { branch 'main'; branch 'master' } }
      steps {
        withCredentials([usernamePassword(credentialsId: env.REGISTRY_CRED_ID, usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
          sh '''
            echo "$REG_PASS" | docker login "${DOCKER_REGISTRY%%/*}" -u "$REG_USER" --password-stdin
            docker push "${IMAGE}:${IMAGE_TAG}"
            docker push "${IMAGE}:latest"
            docker logout "${DOCKER_REGISTRY%%/*}" || true
          '''
        }
      }
    }

    stage('Deploy') {
      when {
        allOf {
          anyOf { branch 'main'; branch 'master' }
          expression { env.DEPLOY_HOST?.trim() }
          expression { env.DEPLOY_CRED_ID?.trim() }
        }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: env.REGISTRY_CRED_ID, usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
          sshagent(credentials: [env.DEPLOY_CRED_ID]) {
            sh '''
              ssh -o StrictHostKeyChecking=accept-new "${DEPLOY_HOST}" "
                echo '$REG_PASS' | docker login '${DOCKER_REGISTRY%%/*}' -u '$REG_USER' --password-stdin &&
                docker pull '${IMAGE}:${IMAGE_TAG}' &&
                docker rm -f '${CONTAINER_NAME}' 2>/dev/null || true
                docker run -d --name '${CONTAINER_NAME}' --restart unless-stopped \
                  -p '${APP_PORT}:${APP_PORT}' '${IMAGE}:${IMAGE_TAG}' &&
                docker image prune -f
              "
            '''
          }
        }
      }
    }
  }

  post {
    success {
      echo "Deployed ${IMAGE}:${IMAGE_TAG}"
    }
    failure {
      echo "Pipeline failed for ${IMAGE}:${IMAGE_TAG}"
    }
    always {
      cleanWs()
    }
  }
}
