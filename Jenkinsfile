// Declarative pipeline for smartpro-web.
//
// Jenkins runs on CT104 (192.168.1.60) — the SAME host that serves the app, so this
// pipeline deploys locally: no container registry, no SSH hop, no DEPLOY_HOST.
// Cloudflare Tunnel maps smartpro-web.projecthasan.com -> http://192.168.1.60:3050.
//
// Lint, tests and the production build all run inside Docker (see Dockerfile targets),
// so the pipeline does not depend on tools installed on the Jenkins agent.

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  environment {
    IMAGE_NAME     = 'smartpro-web'
    IMAGE          = "youruser/${IMAGE_NAME}"
    IMAGE_TAG      = "${env.BUILD_NUMBER}"
    CONTAINER_NAME = 'smartpro-web'
    APP_PORT       = '3050'
    HEALTH_TIMEOUT = '60'
    // Jenkins runs in a bridge container: 127.0.0.1 is the Jenkins container
    // itself, not the CT104 host. Probe the host's LAN address instead.
    DEPLOY_PROBE_HOST = '192.168.1.60'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Lint & Test') {
      steps {
        sh """
          docker build \
            --target test \
            --label "org.opencontainers.image.revision=${env.GIT_COMMIT}" \
            -t ${IMAGE}:test \
            .
        """
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
          # Published on the host loopback only; the probe below runs INSIDE the
          # smoke container, so 127.0.0.1 there is the container itself -- correct.
          docker run -d --name ${CONTAINER_NAME}-smoke -p 127.0.0.1:${APP_PORT}:${APP_PORT} ${IMAGE}:${IMAGE_TAG}
          for i in \$(seq 1 30); do
            if docker exec ${CONTAINER_NAME}-smoke node -e "fetch('http://127.0.0.1:${APP_PORT}/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
              echo "Smoke test passed"; break
            fi
            if [ "\$i" = "30" ]; then echo "Smoke test failed"; docker logs ${CONTAINER_NAME}-smoke; docker rm -f ${CONTAINER_NAME}-smoke; exit 1; fi
            sleep 2
          done
          docker rm -f ${CONTAINER_NAME}-smoke
        """
      }
    }

    // Deploy runs on every build: Jenkins and the app share the CT104 host.
    // The old container is stopped FIRST so the port is free (no bind race),
    // then the new one starts and must pass its Docker HEALTHCHECK before we
    // declare success. A failed deploy fails the build — no false "Deployed" echo.
    stage('Deploy') {
      steps {
        sh """
          set -eu
          echo "Deploying ${IMAGE}:${IMAGE_TAG} on port ${APP_PORT}"

          # 1. Stop and remove the running container to free the port.
          docker rm -f ${CONTAINER_NAME} 2>/dev/null || true

          # 2. Start the newly built image.
          docker run -d --name ${CONTAINER_NAME} \
            --restart unless-stopped \
            -p ${APP_PORT}:${APP_PORT} \
            ${IMAGE}:${IMAGE_TAG}

          # 3. Wait for the container to become healthy.
          echo "Waiting up to ${HEALTH_TIMEOUT}s for container health..."
          for i in \$(seq 1 ${HEALTH_TIMEOUT}); do
            status=\$(docker inspect --format '{{.State.Health.Status}}' ${CONTAINER_NAME} 2>/dev/null || echo "unknown")
            if [ "\$status" = "healthy" ]; then
              echo "Container healthy after \${i}s"
              break
            fi
            if [ "\$status" = "unhealthy" ]; then
              echo "Container became unhealthy"
              docker logs ${CONTAINER_NAME} --tail 50
              exit 1
            fi
            if [ "\$i" = "${HEALTH_TIMEOUT}" ]; then
              echo "Container did not become healthy within ${HEALTH_TIMEOUT}s"
              docker logs ${CONTAINER_NAME} --tail 50
              exit 1
            fi
            sleep 1
          done

          # 4. Verify the port answers. Jenkins runs in its own bridge container,
          # so 127.0.0.1 is the Jenkins container itself, not the host -- probe the
          # host LAN address instead. Exit code is checked separately so a failed
          # curl cannot append a second "000" to the status code.
          if ! code=\$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 10 "http://${DEPLOY_PROBE_HOST}:${APP_PORT}/"); then
            echo "Post-deploy check failed: curl could not reach ${DEPLOY_PROBE_HOST}:${APP_PORT}"
            docker logs ${CONTAINER_NAME} --tail 50
            exit 1
          fi
          if [ "\$code" != "200" ]; then
            echo "Post-deploy check failed: HTTP \$code on ${DEPLOY_PROBE_HOST}:${APP_PORT}"
            docker logs ${CONTAINER_NAME} --tail 50
            exit 1
          fi

          echo "Deploy verified: HTTP \$code on ${DEPLOY_PROBE_HOST}:${APP_PORT}"

          # 5. Reclaim space from superseded image layers.
          docker image prune -f || true
        """
      }
    }
  }

  post {
    success {
      echo "Build #${env.BUILD_NUMBER} deployed ${IMAGE}:${IMAGE_TAG} to port ${APP_PORT} (verified healthy)"
    }
    failure {
      echo "Build #${env.BUILD_NUMBER} FAILED — container may be down, check the Deploy stage log"
    }
    always {
      cleanWs()
    }
  }
}
