# MJUClaw OpenClaw 에이전트 — Discord 직접 연결
#
# NemoClaw sandbox 없이 plain Docker에서 OpenClaw + mju-cli + mju-news를 실행.
# 프록시 없이 Discord WebSocket이 직접 연결됨.
#
# 사전 준비 (./setup.sh로 자동화 가능):
#   git clone https://github.com/university-claw/mju-cli.git
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
RUN npm install -g openclaw@2026.4.11

# 작업 유저 생성
RUN groupadd -r agent && useradd -r -g agent -m -d /home/agent agent

# ── mju-cli 빌드 ────────────────────────────────────────────────
COPY mju-cli/package.json mju-cli/package-lock.json /opt/mju-cli/
WORKDIR /opt/mju-cli
RUN npm ci --include=dev
COPY mju-cli/ /opt/mju-cli/
RUN npx tsc
# skill의 requires.bins: ["mju"]에 매핑 — view-server 자동 연동 wrapper
COPY bin/mju /usr/local/bin/mju
RUN chmod +x /usr/local/bin/mju

# ── mju-news 빌드 ───────────────────────────────────────────────
COPY mju-news/package.json mju-news/package-lock.json /opt/mju-news/
WORKDIR /opt/mju-news
RUN npm ci --include=dev
COPY mju-news/ /opt/mju-news/
RUN npx tsc
# skill의 requires.bins: ["mju-news"]에 매핑 — node wrapper script
RUN printf '#!/bin/sh\nexec node /opt/mju-news/dist/main.js --data-dir /opt/mju-news/data "$@"\n' > /usr/local/bin/mju-news \
    && chmod +x /usr/local/bin/mju-news

# mju-news-alert — 유저별 뉴스 알림 구독/해제/전달 helper
COPY bin/mju-news-alert /usr/local/bin/mju-news-alert
RUN chmod +x /usr/local/bin/mju-news-alert

# mju-attendance-alert — 출석 체크 누락 선제 알림 helper
COPY bin/mju-attendance-alert /usr/local/bin/mju-attendance-alert
RUN chmod +x /usr/local/bin/mju-attendance-alert

# mju-login — 비밀번호 특수문자 안전 로그인 (heredoc stdin)
COPY bin/mju-login /usr/local/bin/mju-login
RUN chmod +x /usr/local/bin/mju-login

# ── view-server 빌드 ─────────────────────────────────────────────
COPY package.json package-lock.json* /opt/view-server/
WORKDIR /opt/view-server
RUN npm install --include=dev
COPY src/ /opt/view-server/src/
RUN npx tsc -p src/tsconfig.json

# ── 유저 데이터 디렉토리 (root에서 생성 후 agent에게 소유권) ────
RUN mkdir -p /data/users && chown agent:agent /data/users

# ── OpenClaw 디렉토리 구조 ──────────────────────────────────────
USER agent
WORKDIR /home/agent

RUN mkdir -p /home/agent/.openclaw/workspace/skills

# ── SKILL.md 설치 ───────────────────────────────────────────────
# mju-cli 기본 skills → 에이전트 전용 skills로 오버라이드 (mju-shared, mju-onboarding)
COPY --chown=agent:agent mju-cli/skills/ /home/agent/.openclaw/workspace/skills/
COPY --chown=agent:agent mju-news/skills/ /home/agent/.openclaw/workspace/skills/
COPY --chown=agent:agent skills/ /home/agent/.openclaw/workspace/skills/

# ── 에이전트 시스템 프롬프트 (BOOTSTRAP, IDENTITY, SOUL) ─────────
COPY --chown=agent:agent workspace/*.md /home/agent/.openclaw/workspace/

# ── entrypoint ───────────────────────────────────────────────────
COPY --chown=agent:agent entrypoint.sh /home/agent/entrypoint.sh

EXPOSE 18789 3001

ENTRYPOINT ["/bin/bash", "/home/agent/entrypoint.sh"]
