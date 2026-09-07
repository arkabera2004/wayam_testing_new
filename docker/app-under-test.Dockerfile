# Image for an application under test.
#
# Deliberately not built from this repository's tree. The container gets the
# application's own directory and a manifest naming what it needs, and nothing
# else - no Parikshan source, no .env.local, no node_modules hoisted from a
# workspace root. If the image could see the repository, containing the build
# would achieve nothing, because everything worth protecting is in it.
#
# The manifest is written by the driver rather than copied, because an
# application in a monorepo often declares no dependencies of its own:
# apps/shopstack has an empty package.json and resolves next and react from the
# workspace root. Copying that root is exactly what this exists to avoid, so
# the driver synthesises a manifest holding what the application actually
# imports.
FROM node:22-bookworm-slim

# Non-root from here down. A build script that runs as root inside a container
# is one misconfigured mount away from being root outside it.
RUN groupadd --system app && useradd --system --gid app --create-home app

WORKDIR /workspace
RUN chown app:app /workspace
USER app

# Dependencies first, so a source change does not reinstall them.
COPY --chown=app:app package.json ./
RUN npm install --no-audit --no-fund --loglevel=error

COPY --chown=app:app . .

# Built at image build time. The driver rebuilds the image when source changes,
# so "the image exists" and "the build succeeded" are the same fact - a broken
# build cannot produce a runnable container that serves stale output.
RUN npm run build

EXPOSE 4000
CMD ["npm", "run", "start"]
