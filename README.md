# MJUClaw Agent Setup

명지대학교 학사 AI 에이전트. [OpenClaw](https://openclaw.ai)를 Docker 컨테이너에서 실행하여 Discord로 서비스합니다.

## 구조

```
Discord 유저 ↔ OpenClaw gateway (Docker) ↔ Gemini API (LLM)
                    │
                    ├─ mju-cli         → LMS / MSI / UCheck / 도서관
                    ├─ mju-news        → 학교 공개 공지 스크래퍼
                    ├─ view-server     → 학사 데이터 웹뷰 (링크 버튼)
                    ├─ mju-news-alert  → 유저별 뉴스 정기 알림 (cron)
                    └─ mju-attendance-alert → 수업 출석 누락 선제 알림 (cron)
```

OpenClaw가 Discord에 직접 연결되어 에이전트로 동작합니다. 유저 메시지를 받으면 자율적으로 skill과 CLI 도구를 호출하고, LLM으로 응답을 생성합니다. 카카오 시절과 달리 **봇이 먼저 DM을 보내는 푸시 알림**도 지원합니다 (출석 누락, 새 공지 등).

## 사전 준비

### 1. Discord Bot

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**
2. **Bot** → Privileged Gateway Intents 3개 켜기 (Message Content, Server Members, Presence)
3. **Bot Token** 복사
4. **OAuth2** → Scopes: `bot`, `applications.commands` / Permissions: View Channels, Send Messages, Read Message History, Embed Links, Attach Files, Add Reactions → 생성된 URL로 서버에 봇 초대
5. Developer Mode 켜고 **Server ID**, **User ID** 복사

### 2. Gemini API Key

[Google AI Studio](https://aistudio.google.com/apikey)에서 API 키 발급.

### 3. ngrok 터널 (웹뷰 공개 URL)

에이전트가 학사 데이터를 조회하면 view-server가 웹뷰 URL을 생성합니다. Discord 유저가 브라우저로 열 수 있도록 ngrok 터널이 필요합니다.

```bash
ngrok http --domain=<your-domain>.ngrok-free.dev 3001
```

## 설치 및 실행 (한 방에)

```bash
git clone https://github.com/university-claw/mjuclaw-setup.git
cd mjuclaw-setup

./setup.sh
```

첫 실행 시 `.env`가 자동 생성됩니다. 안내에 따라 값을 채우고 **다시 `./setup.sh`**를 실행하면 도구 레포 clone + Docker 빌드 + 기동까지 자동 완료됩니다.

`docker logs -f mjuclaw-agent`로 `[discord] client initialized as ... (봇이름)`이 나오면 성공.

### 수동 설치 (상세 제어)

```bash
# 도구 레포 clone (gitignore 됨)
git clone https://github.com/university-claw/mju-cli.git
git clone https://github.com/university-claw/mju-news.git

# 환경변수 설정
cp .env.example .env   # 편집 필요

# 빌드 & 실행
docker compose build
docker compose up -d
```

## 페어링 (선택 사항)

기본 설정은 DM open policy라 페어링 없이 바로 대화 가능합니다. 만약 `dmPolicy`를 `pairing`으로 바꿨다면 처음 DM 시 페어링 코드를 승인해야 합니다:

```bash
docker exec mjuclaw-agent openclaw pairing approve discord <CODE>
```

## 환경변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `DISCORD_BOT_TOKEN` | O | Discord Bot Token |
| `GEMINI_API_KEY` | O | Google Gemini API 키 |
| `OPENCLAW_MODEL` | | LLM 모델 (기본: `gemini-2.5-flash`) |
| `DISCORD_SERVER_ID` | | Discord 서버 ID (guild allowlist) |
| `DISCORD_USER_ID` | | 관리자 Discord User ID |
| `VIEW_PORT` | | view-server 포트 (기본: 3001) |
| `VIEW_BASE_URL` | | 웹뷰 공개 URL (ngrok 도메인) |

## 영속 데이터

Docker volume으로 컨테이너를 재생성해도 유지됩니다.

| Volume | 경로 | 내용 |
|---|---|---|
| `agent-data` | `/home/agent/.openclaw` | 에이전트 세션, 페어링, config, cron jobs |
| `news-data` | `/opt/mju-news/data` | 스크래핑된 공지 데이터 (공용) |
| `user-data` | `/data/users` | 유저별 크리덴셜 vault, 구독 설정 |

### 유저별 디렉토리 구조

```
/data/users/<discord_id>/
├── vault/                          # AES-256-GCM 암호화 비밀번호
├── state/
│   ├── profile.json                # 학번 + authMode
│   └── lms-session.json            # SSO 쿠키
├── news-subscription.json          # 뉴스 정기 알림 설정
└── attendance-alert.json           # 출석 누락 알림 설정
```

## 제공 기능

### 1. 학사 데이터 조회 (온보딩 필요)

유저가 대화로 요청:
- "시간표 보여줘"
- "내 성적 어때?"
- "남은 과제 알려줘"
- "캡스톤디자인 출석률"

에이전트가 `mju-cli`를 호출하고 결과를 **요약 + 웹뷰 링크 버튼**으로 전달합니다.

### 2. 학교 공지 조회 (로그인 불필요)

유저가 요청:
- "새 공지 있어?"
- "최근 장학금 공지"

에이전트가 `mju-news`를 호출 (또는 백그라운드 cron이 이미 갱신해둔 데이터 사용).

### 3. 뉴스 정기 알림 (cron 기반, 유저별)

유저가 구독하면 봇이 정해진 시간에 먼저 DM:
- "매일 아침 8시에 장학금 공지 알려줘"
- "평일 저녁 7시에 취업 공지"

`mju-news-alert` helper가 유저별 cron을 자동 생성.

### 4. 출석 누락 선제 알림 (cron 기반, 유저별)

유저가 구독하면 각 수업 시작 10분 후 출석 체크 여부 확인, **미체크면 자동 DM**:
- "출석 놓치지 않게 알려줘"

`mju-attendance-alert` helper가 시간표를 읽어서 수업별 cron을 자동 생성. 휴강/공휴일은 자동 건너뜀.

## 온보딩 & 로그인

신규 유저가 DM을 보내면 봇이 Discord 모달 폼으로 학번/비밀번호를 수집, `mju auth login`으로 검증 후 유저별 vault에 암호화 저장합니다.

**온보딩 전 상태:**
- 공개 데이터(mju-news, 뉴스 알림 구독) 사용 가능
- 학사 데이터 조회 불가

**온보딩 후:**
- 모든 기능 사용 가능

## 개인화: 유저별 격리

- **대화 세션**: `session.dmScope=per-channel-peer`로 유저별 독립 (다른 유저 대화가 섞이지 않음)
- **크리덴셜**: 유저별 디렉토리의 vault에 각자 암호화 저장
- **cron 알림**: 유저별 cron job 이름(`news-<id>`, `attend-<id>-*`)으로 격리
- **구독 설정**: 유저별 JSON 파일로 저장

## 내장 CLI 도구

컨테이너 안에 다음 도구가 설치됩니다:

| 도구 | 역할 |
|---|---|
| `mju` | mju-cli wrapper — 조회 결과를 view-server에 자동 저장하고 `viewUrl` 필드 주입 |
| `mju-news` | 학교 공지 스크래핑 CLI |
| `mju-news-alert` | 뉴스 정기 알림 subscribe/unsubscribe/status/deliver |
| `mju-attendance-alert` | 출석 누락 알림 subscribe/unsubscribe/refresh/check |
| `openclaw` | Gateway CLI (cron 관리, 채널 설정 등) |

## Skill 목록

이미지에 16개 SKILL.md가 포함됩니다 (mju-cli의 13개 + 에이전트 전용 3개).

| Skill | 설명 |
|---|---|
| `mju-shared` | 공통 인증/출력 규칙 (Discord User ID 기반 app-dir) |
| `mju-onboarding` | 로그인 흐름 |
| `mju-lms` / `mju-lms-action-items` | LMS 강의/공지/과제 |
| `mju-msi` | 시간표/성적/졸업요건 |
| `mju-ucheck` | 출석 조회 |
| `mju-library` / `mju-library-seat-*` / `mju-library-my-*` | 도서관 |
| `recipe-mju-*` | 복합 레시피 (일일 요약 등) |
| `getting-mju-news` | 학교 공개 공지 |

에이전트 시스템 프롬프트는 `workspace/BOOTSTRAP.md`, `workspace/SOUL.md`, `workspace/IDENTITY.md`에 있습니다.

## cron 작업 목록

```bash
docker exec mjuclaw-agent openclaw cron list
```

**시스템 cron (공용):**
- `mju-news-scrape` — 30분마다 공지 갱신

**유저별 cron (구독 시 자동 생성):**
- `news-<discord_id>` — 뉴스 정기 알림
- `attend-<discord_id>-<day>-<time>-<course>` — 수업별 출석 누락 알림

## 도구 업데이트

mju-cli 또는 mju-news를 수정했으면 이미지를 다시 빌드합니다.

```bash
cd mju-cli && git pull
cd ../mju-news && git pull
cd ..
docker compose build
docker compose up -d
```

## 관련 레포

- [mju-cli](https://github.com/university-claw/mju-cli) — 명지대 서비스 CLI (SSO 기반)
- [mju-news](https://github.com/university-claw/mju-news) — 공개 공지 스크래퍼
- [mju-server](https://github.com/university-claw/mjuclaw-server) — 카카오톡 브릿지 (deprecated)
