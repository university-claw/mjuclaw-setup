# MJUClaw OpenClaw 에이전트 — Discord 직접 연결
#
# NemoClaw sandbox 없이 plain Docker에서 OpenClaw + mju-cli + mju-news를 실행.
# 프록시 없이 Discord WebSocket이 직접 연결됨.
#
# 사전 준비:
#   git clone https://github.com/nullhyeon/mju-cli.git
#   git clone https://github.com/university-claw/mju-news.git
#
# Build:  docker compose build
# Run:    docker compose up

FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip curl git openssh-client \
    && rm -rf /var/lib/apt/lists/*

# OpenClaw CLI 설치
RUN npm install -g openclaw@2026.3.11

# 작업 유저 생성
RUN groupadd -r agent && useradd -r -g agent -m -d /home/agent agent

# ── mju-cli 빌드 ────────────────────────────────────────────────
COPY mju-cli/package.json mju-cli/package-lock.json /opt/mju-cli/
WORKDIR /opt/mju-cli
RUN npm ci --include=dev
COPY mju-cli/ /opt/mju-cli/
RUN npx tsc
# skill의 requires.bins: ["mju"]에 매핑
RUN ln -s /opt/mju-cli/dist/main.js /usr/local/bin/mju \
    && chmod +x /opt/mju-cli/dist/main.js

# ── mju-news 빌드 ───────────────────────────────────────────────
COPY mju-news/package.json mju-news/package-lock.json /opt/mju-news/
WORKDIR /opt/mju-news
RUN npm ci --include=dev
COPY mju-news/ /opt/mju-news/
RUN npx tsc
# skill의 requires.bins: ["mju-news"]에 매핑
RUN ln -s /opt/mju-news/dist/main.js /usr/local/bin/mju-news \
    && chmod +x /opt/mju-news/dist/main.js

# ── view-server 빌드 ─────────────────────────────────────────────
COPY package.json package-lock.json* /opt/view-server/
WORKDIR /opt/view-server
RUN npm install --include=dev
COPY src/ /opt/view-server/src/
RUN npx tsc -p src/tsconfig.json

# ── OpenClaw 디렉토리 구조 ──────────────────────────────────────
USER agent
WORKDIR /home/agent

RUN mkdir -p /home/agent/.openclaw/workspace/skills

# ── SKILL.md 설치 ───────────────────────────────────────────────
COPY --chown=agent:agent mju-cli/skills/ /home/agent/.openclaw/workspace/skills/
COPY --chown=agent:agent mju-news/skills/ /home/agent/.openclaw/workspace/skills/

# ── entrypoint ───────────────────────────────────────────────────
COPY --chown=agent:agent entrypoint.sh /home/agent/entrypoint.sh

EXPOSE 18789 3001

ENTRYPOINT ["/bin/bash", "/home/agent/entrypoint.sh"]
