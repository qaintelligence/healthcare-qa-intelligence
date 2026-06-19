# Mock patient-portal app — small, dependency-free runtime image.
# Used as the system under test locally, in CI, and in docker-compose.
FROM node:20-alpine

WORKDIR /app
COPY mock-app ./mock-app

ENV MOCK_PORT=4300
EXPOSE 4300

# Container healthcheck hits the same /health endpoint the test harness waits on.
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4300/health || exit 1

CMD ["node", "mock-app/server.mjs"]
