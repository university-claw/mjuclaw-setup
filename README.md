# MJUClaw Agent Setup

명지대학교 학사 AI 에이전트. [OpenClaw](https://openclaw.ai)를 Docker 컨테이너에서 실행하여 Discord로 서비스합니다.

## 구조

```
Discord 유저 ↔ OpenClaw gateway (Docker) ↔ NVIDIA Endpoints (LLM)
                    │
                    ├─ mju-cli   → LMS / MSI / UCheck / 도서관
                    └─ mju-news  → 학교 공개 공지 스크래퍼
```

OpenClaw가 Discord에 직접 연결되어 에이전트로 동작합니다. 유저 메시지를 받으면 자율적으로 skill(mju-cli, mju-news)을 호출하고, LLM으로 응답을 생성합니다.

## 사전 준비

### 1. Discord Bot

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**
2. **Bot** → Privileged Gateway Intents 3개 켜기 (Message Content, Server Members, Presence)
3. **Bot Token** 복사
4. **OAuth2** → Scopes: `bot`, `applications.commands` / Permissions: View Channels, Send Messages, Read Message History, Embed Links, Attach Files, Add Reactions → 생성된 URL로 서버에 봇 초대
5. Developer Mode 켜고 **Server ID**, **User ID** 복사

### 2. NVIDIA API Key

[NVIDIA Build](https://build.nvidia.com/settings/api-keys)에서 API 키 발급 (`nvapi-` 시작).

## 설치 및 실행

```bash
git clone https://github.com/university-claw/mjuclaw-setup.git
cd mjuclaw-setup

# 도구 레포 clone (gitignore 됨)
git clone https://github.com/nullhyeon/mju-cli.git
git clone https://github.com/university-claw/mju-news.git

# 환경변수 설정
cp .env.example .env
# .env 파일 편집 — 토큰/키 입력

# 빌드 & 실행
docker compose build
docker compose up -d

# 로그 확인
docker logs -f mjuclaw-agent
```

`[discord] logged in to discord as ... (봇이름)` 이 나오면 성공.

## 페어링

Discord에서 봇에 DM을 보내면 페어링 코드가 옵니다.

```bash
docker exec mjuclaw-agent openclaw pairing approve discord <CODE>
```

## 환경변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `DISCORD_BOT_TOKEN` | O | Discord Bot Token |
| `NVIDIA_API_KEY` | O | NVIDIA Endpoints API 키 |
| `OPENCLAW_MODEL` | | LLM 모델 (기본: `google/gemma-4-31b-it`) |
| `DISCORD_SERVER_ID` | | Discord 서버 ID (guild allowlist) |
| `DISCORD_USER_ID` | | 관리자 Discord User ID |

## 영속 데이터

Docker volume으로 컨테이너를 재생성해도 유지됩니다.

| Volume | 경로 | 내용 |
|---|---|---|
| `agent-data` | `/home/agent/.openclaw` | 에이전트 세션, 페어링, config |
| `news-data` | `/opt/mju-news/data` | 스크래핑된 공지 데이터 |

## Skill 목록

이미지에 13개 SKILL.md가 포함되어 있습니다.

| Skill | 도구 | 설명 |
|---|---|---|
| `mju-lms` | mju-cli | LMS 강의/공지/자료/과제 |
| `mju-lms-action-items` | mju-cli | 미제출 과제, 미수강 온라인 등 요약 |
| `mju-msi` | mju-cli | 학적 정보 (성적, 졸업요건) |
| `mju-ucheck` | mju-cli | 출석 조회 |
| `mju-library` | mju-cli | 도서관 좌석/대출 |
| `mju-library-seat-*` | mju-cli | 좌석 조회/예약 |
| `mju-library-my-*` | mju-cli | 내 예약 관리 |
| `recipe-mju-*` | mju-cli | 복합 레시피 (일일 요약 등) |
| `getting-mju-news` | mju-news | 학교 공개 공지 조회 |

## 도구 업데이트

mju-cli 또는 mju-news를 수정했으면 이미지를 다시 빌드합니다.

```bash
cd mju-cli && git pull    # 또는 로컬 수정
cd ../mju-news && git pull
cd ..
docker compose build
docker compose up -d
```

## 관련 레포

- [mju-cli](https://github.com/nullhyeon/mju-cli) — 명지대 서비스 CLI
- [mju-news](https://github.com/university-claw/mju-news) — 공개 공지 스크래퍼
- [mju-server](https://github.com/university-claw/mjuclaw-server) — 카카오톡 브릿지 (deprecated)
