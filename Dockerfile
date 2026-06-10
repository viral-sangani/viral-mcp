# node:24 on Debian trixie ships python3.13 — the engine needs python >= 3.12.
FROM node:24-trixie-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip git curl ca-certificates jq \
    && pip3 install --break-system-packages yt-dlp \
    && (curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        > /usr/share/keyrings/githubcli-archive-keyring.gpg \
      && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list \
      && apt-get update && apt-get install -y --no-install-recommends gh) \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Engine source. In the container the submodule content is a plain directory;
# /admin/sync turns it back into a real clone so it can pull upstream.
COPY upstream ./upstream
RUN if [ ! -d upstream/.git ]; then \
      cd upstream && git init -q -b main \
      && git remote add origin https://github.com/mvanhorn/last30days-skill \
      && git fetch -q --depth 1 origin main \
      && git reset -q --hard origin/main; \
    fi

ENV PORT=3030 PYTHON_BIN=python3
EXPOSE 3030

HEALTHCHECK --interval=30s --timeout=5s CMD curl -fsS http://localhost:3030/healthz || exit 1

CMD ["node", "dist/index.js"]
