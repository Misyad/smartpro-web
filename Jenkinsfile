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
    // Runtime secrets. TWO copies are required because Jenkins runs in a
    // container and cannot see the host filesystem:
    //   BUILD_ENV_FILE   -> inside the Jenkins volume, read by the Build stage
    //                       to inline VITE_* at compile time
    //   RUNTIME_ENV_FILE -> on the CT104 host, read by the Deploy stage and
    //                       passed to `docker run --env-file`
    // Both are mode 600. Keep them in sync; scripts/place-jenkins-env.py does.
    BUILD_ENV_FILE   = '/var/jenkins_home/.smartpro.env'
    RUNTIME_ENV_FILE = '/root/smartpro.env'
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

    // Validates every SQL migration against a throwaway Postgres. Never touches
    // a real database: scripts/migrate.sh --check spins up postgres:17-alpine,
    // applies the migrations with ON_ERROR_STOP, runs the seed twice to prove
    // idempotency, asserts row counts, then destroys the container.
    //
    // Applying to a real project is a deliberate manual step (--apply with
    // DATABASE_URL), not a CI side effect.
    stage('Migration Check') {
      steps {
        sh 'chmod +x scripts/migrate.sh && ./scripts/migrate.sh --check'
      }
    }

    stage('Build Image') {
      steps {
        sh """
          set -eu

          # Vite inlines VITE_* at compile time, so the browser bundle needs these
          # during `docker build`, not at `docker run`. Read them from the runtime
          # env file so there is a single source of truth for the project URL.
          #
          # Only the PUBLIC anon key is passed as a build arg; it is readable in
          # the shipped JavaScript by design. The service-role key stays out of
          # the image and is injected at run time only.
          VITE_URL=''
          VITE_ANON=''
          if [ -f '${BUILD_ENV_FILE}' ]; then
            VITE_URL=\$(grep -E '^[[:space:]]*SUPABASE_URL=..*' '${BUILD_ENV_FILE}' | head -1 | cut -d= -f2-)
            VITE_ANON=\$(grep -E '^[[:space:]]*SUPABASE_ANON_KEY=..*' '${BUILD_ENV_FILE}' | head -1 | cut -d= -f2-)
          fi

          if [ -z "\$VITE_URL" ] || [ -z "\$VITE_ANON" ]; then
            echo "FATAL: SUPABASE_URL / SUPABASE_ANON_KEY missing from '${BUILD_ENV_FILE}'."
            echo "       The client bundle would be built in demo mode."
            exit 1
          fi

          echo "Building with client env from ${BUILD_ENV_FILE} (url length \${#VITE_URL})"

          docker build \\
            --build-arg VITE_SUPABASE_URL="\$VITE_URL" \\
            --build-arg VITE_SUPABASE_ANON_KEY="\$VITE_ANON" \\
            --label "org.opencontainers.image.revision=${env.GIT_COMMIT}" \\
            --label "org.opencontainers.image.source=${env.GIT_URL}" \\
            -t ${IMAGE}:${IMAGE_TAG} \\
            -t ${IMAGE}:latest \\
            .
        """
      }
    }

    stage('Smoke Test') {
      steps {
        sh """
          set -e
          docker rm -f ${CONTAINER_NAME}-smoke 2>/dev/null || true
          # No -p here on purpose: publishing a port would reserve APP_PORT on the
          # host, which the live container already holds -- any bind address,
          # including 127.0.0.1, still reserves the port and fails with
          # "port is already allocated". The probe below uses docker exec, which
          # runs INSIDE the smoke container, so no host port is needed at all.
          docker run -d --name ${CONTAINER_NAME}-smoke ${IMAGE}:${IMAGE_TAG}
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

    // Fails the build when the runtime credentials are missing, instead of
    // deploying a container that silently falls back to local demo data.
    //
    // The app reads the catalog from Supabase when SUPABASE_URL and anon key are
    // present and falls back to seeded demo data when they are not. That fallback
    // is correct for previews, but on production it means the site looks healthy
    // (HTTP 200, real product cards) while serving stale demo rows. This stage
    // turns that silent failure into a loud one.
    //
    // Only variable NAMES are printed. Values are never echoed: the service-role
    // key bypasses RLS and must not leak into build logs.
    stage('Verify Runtime Config') {
      steps {
        sh """
          set -eu

          # Jenkins runs in a container: the host copy at RUNTIME_ENV_FILE is
          # invisible here, so this stage validates the BUILD copy it can read,
          # and separately asserts the host copy exists where Deploy expects it.
          # (If the host copy were missing, Deploy would fail after the old
          # container was already removed - the worst moment to find out.)
          ENV_FILE='${BUILD_ENV_FILE}'

          if [ ! -f "\$ENV_FILE" ]; then
            echo "FATAL: runtime env file not found: \$ENV_FILE"
            echo ""
            echo "The deployed container needs Supabase credentials. Create the file on"
            echo "the CT104 host (mode 600) containing:"
            echo "  SUPABASE_URL=..."
            echo "  SUPABASE_ANON_KEY=..."
            echo "  SUPABASE_SERVICE_ROLE_KEY=..."
            echo "  APP_URL=https://smartpro-web.projecthasan.com"
            echo ""
            echo "Refusing to deploy without it: the app would start in demo mode."
            exit 1
          fi

          # The env file holds secrets; refuse to use a world-readable one.
          PERM=\$(stat -c '%a' "\$ENV_FILE")
          case "\$PERM" in
            600|400) : ;;
            *)
              echo "FATAL: \$ENV_FILE has mode \$PERM; must be 600 or 400."
              echo "       A world-readable file exposes the service-role key."
              exit 1
              ;;
          esac

          missing=''
          for name in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
            # match only real assignments, not comments
            if ! grep -qE "^[[:space:]]*\${name}=..*" "\$ENV_FILE"; then
              missing="\$missing \$name"
            fi
          done

          if [ -n "\$missing" ]; then
            echo "FATAL: \$ENV_FILE is missing required variable(s):\$missing"
            echo "Refusing to deploy: the app would start in demo mode."
            exit 1
          fi

          echo "Runtime config OK (3 required variables present, mode \$PERM)"

          # Deploy passes this path to `docker run --env-file`, evaluated on the
          # HOST. Verify it from the host's point of view (via the docker socket,
          # which this container can reach) so a missing host copy fails here
          # rather than mid-deploy, after the running container was removed.
          if ! docker run --rm -v '${RUNTIME_ENV_FILE}:/probe:ro' alpine:3 \
                 sh -c 'test -s /probe && grep -qE "^[[:space:]]*SUPABASE_URL=..*" /probe'; then
            echo "FATAL: '${RUNTIME_ENV_FILE}' is missing or incomplete on the host."
            echo "       Deploy would start the new container without credentials."
            exit 1
          fi
          echo "Host env file verified at ${RUNTIME_ENV_FILE}"
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
          #    --env-file supplies the Supabase credentials verified in the
          #    previous stage; without it the app serves demo data.
          docker run -d --name ${CONTAINER_NAME} \
            --restart unless-stopped \
            --env-file '${RUNTIME_ENV_FILE}' \
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
