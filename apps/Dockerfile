# The demo API as an image. It installs the other soltoolkit packages from npm, so it builds once they are
# published. Build from the repository root:
#
#   docker build -f apps/Dockerfile --build-arg APP=demo-api     -t soltoolkit-demo-api .

FROM node:22-bookworm-slim
ARG APP
RUN test -n "$APP" || (echo "pass --build-arg APP=demo-api" && false)
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY packages packages
COPY apps/${APP} apps/${APP}
# Installs the app with the workspace packages it uses, then builds those packages.
RUN pnpm install --frozen-lockfile --filter "@soltoolkit/${APP}..." \
 && pnpm --filter "@soltoolkit/${APP}^..." build
WORKDIR /repo/apps/${APP}
# The bots keep their settings file in a volume, so it survives a new image.
ENV STORE_PATH=/data/store.json
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
CMD ["node", "--import", "tsx", "src/main.ts"]
