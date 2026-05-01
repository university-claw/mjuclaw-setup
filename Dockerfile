# MJUClaw OpenClaw 에이전트 — Discord 직접 연결
#
# plain Docker에서 OpenClaw + mju-cli + mju-news(v2 Reader)를 실행한다.
# 공개 정보(공지/학식) 데이터는 호스트의 Postgres(mju-public-data-worker 공유)에서 읽는다.
#
# 사전 준비 (./setup.sh로 자동화 가능):
#   git clone https://github.com/university-claw/mju-cli.git
#   git clone https://github.com/university-claw/mju-news.git   # v2.0.0+: Reader CLI
#   # 호스트에 Postgres 설치 + mju-public-data-worker를 한 번 이상 실행
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

# ── mju-news 빌드 (v2.0.0+ Reader: Postgres에서 읽어 JSON 반환) ──
COPY mju-news/package.json mju-news/package-lock.json /opt/mju-news/
WORKDIR /opt/mju-news
RUN npm ci --include=dev
COPY mju-news/ /opt/mju-news/
RUN npx tsc
# skill의 requires.bins: ["mju-news"]에 매핑 — view-server 자동 POST wrapper
# (mju 래퍼와 동일 패턴: notices/cafeterias 결과를 view-server에 POST 후 viewUrl 주입).
# v2에서는 --data-dir 플래그가 사라졌고, DB 연결은 PG* 환경변수로 자동 구성된다.
COPY bin/mju-news /usr/local/bin/mju-news
RUN chmod +x /usr/local/bin/mju-news

# mju-news-alert — 유저별 뉴스 알림 구독/해제/전달 helper
COPY bin/mju-news-alert /usr/local/bin/mju-news-alert
RUN chmod +x /usr/local/bin/mju-news-alert

# mju-attendance-alert — 출석 체크 누락 선제 알림 helper
COPY bin/mju-attendance-alert /usr/local/bin/mju-attendance-alert
RUN chmod +x /usr/local/bin/mju-attendance-alert

# mju-login — 비밀번호 특수문자 안전 로그인 (heredoc stdin)
COPY bin/mju-login /usr/local/bin/mju-login
RUN chmod +x /usr/local/bin/mju-login

# mju-onboarding-survey — 로그인 직후 Discord Poll로 알림 선호 수집 (LLM 비관여)
COPY bin/mju-onboarding-survey /usr/local/bin/mju-onboarding-survey
RUN chmod +x /usr/local/bin/mju-onboarding-survey

# ── mjuclaw OpenClaw plugins ────────────────────────────────────
# onboarding-gate: Discord 미온보딩 사용자의 메시지를 LLM 호출 전에 가로채 로그인 modal을
# 발사하는 plugin. entrypoint.sh가 시작 시 `openclaw plugins install --link`로 등록한다.
# `--link` 옵션이 source path를 그대로 참조하므로 이 디렉토리가 안정적이어야 한다.
RUN mkdir -p /opt/mjuclaw-plugins
COPY --chown=agent:agent plugins/ /opt/mjuclaw-plugins/

# ── view-server 빌드 ─────────────────────────────────────────────
COPY package.json package-lock.json* /opt/view-server/
WORKDIR /opt/view-server
RUN npm install --include=dev
COPY src/ /opt/view-server/src/
RUN npx tsc -p src/tsconfig.json
# 정적 자산 (마스코트 로고 등). view-server의 /static/* 라우트로 서빙.
COPY public/ /opt/view-server/public/

# ── 유저 데이터 디렉토리 (root에서 생성 후 agent에게 소유권) ────
RUN mkdir -p /data/users && chown agent:agent /data/users

# ── worker 자산 디렉토리 (docker-compose에서 호스트 경로 read-only 마운트) ──
# /data/assets는 mju-public-data-worker의 STORAGE_LOCAL_ROOT를 그대로 비춘다.
# agent가 공지 상세 조회 시 원본 첨부/이미지를 on-demand로 읽을 때 사용.
RUN mkdir -p /data/assets

# ── Workspace 프롬프트/스킬 template (volume shadow 회피) ─────────
# /home/agent/.openclaw는 named volume(agent-data)이 마운트되는 경로라서
# 이미지의 workspace/*.md 변경이 빌드 후에도 볼륨에 반영되지 않는다 (shadow).
# 그래서 이미지의 source of truth를 /opt/mjuclaw-workspace-template/ 에 따로 두고,
# entrypoint.sh가 컨테이너 시작마다 volume 내 workspace/로 rsync한다.
RUN mkdir -p /opt/mjuclaw-workspace-template/workspace/skills \
    && chown -R agent:agent /opt/mjuclaw-workspace-template
COPY --chown=agent:agent mju-cli/skills/ /opt/mjuclaw-workspace-template/workspace/skills/
COPY --chown=agent:agent mju-news/skills/ /opt/mjuclaw-workspace-template/workspace/skills/
COPY --chown=agent:agent skills/ /opt/mjuclaw-workspace-template/workspace/skills/
COPY --chown=agent:agent workspace/*.md /opt/mjuclaw-workspace-template/workspace/

# rsync: entrypoint가 template → volume 복사할 때 사용
RUN apt-get update && apt-get install -y --no-install-recommends rsync \
    && rm -rf /var/lib/apt/lists/*

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
