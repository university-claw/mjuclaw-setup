# MJUClaw Agent Setup

명지대학교 학사 AI 에이전트 "묭묭이" 의 도커 기반 운영 설정. Discord DM/길드에서 학사
서비스(LMS·MSI·UCheck·도서관·공지·학식)를 자연어로 사용한다.

**최신 release: [v1.1.0](https://github.com/university-claw/mjuclaw-setup/releases/tag/v1.1.0)**
— PaddleOCR 통합 + portability(다른 컴퓨터에서 한 번에 설치) 완성.

---

## 1. 아키텍처 한눈에

```
              Discord DM/Guild
                    │ WebSocket
        ┌───────────▼───────────┐
        │   mjuclaw-router      │  ← Discord 봇 토큰 단독 소유
        │   (Node 22)           │     - 온보딩 modal/login
        │                       │     - intent classifier 게이트
        │                       │     - cross-user session 격리
        └───┬───────────────────┘
            │ openclaw agent --json (gateway WS)
            ▼
        ┌───────────────────────┐    ┌───────────────────────┐
        │   mjuclaw-agent       │←──▶│ mjuclaw-classifier    │
        │   (OpenClaw + LLM)    │HTTP│ (KcELECTRA-base FastAPI│
        │   - mju-cli wrapper   │    │  abuse 차단 + 의도 분류) │
        │   - mju-news Reader   │    └───────────────────────┘
        │   - view-server :3001 │
        │   - cron alert helpers│              ▲
        └───┬─────────┬─────────┘              │
            │         │                         │
       host PG       host PG                    │
       (user_data)   (public_data)              │
            ▲         ▲                         │
            │         │                         │
            │         │  ┌──────────────────────┴┐
            │         └──│  mjuclaw-worker       │
            │            │  (Node + PaddleOCR)   │
            │            │  - 공지 스크래핑       │
            │            │  - 학식 OCR (PaddleOCR)│
            │            │  - 매 600s schedule:tick│
            │            └───────────────────────┘
            │
        Discord 사용자별 vault (mju-cli SSO 크리덴셜)
```

**docker-compose가 띄우는 컨테이너 (default):**
- `mjuclaw-agent` — OpenClaw + view-server + LLM 호출 (Gemini)
- `mjuclaw-router` — Discord WS 입구 + onboarding modal + cron alert HTTP
- `mjuclaw-classifier` — 한국어 의도 분류 + abuse 차단 (KcELECTRA, HF Hub에서 모델 자동 download)
- `mjuclaw-worker` — 공지/학식 정본 생성 worker (PaddleOCR)

**옵션 profile (`--profile public-data`):**
- `mjuclaw-public-data-db` — Postgres 16-alpine (호스트 PG 없을 때 bundled DB)
- `mjuclaw-public-data-worker` — PaddleOCR 전용 분리 worker

---

## 2. 다른 컴퓨터에 설치 — 단계별

### 2-1. 사전 준비물 (각자 발급)

| # | 항목 | 어디서 | 비고 |
|---|---|---|---|
| 1 | **Discord Bot Token** | [Discord Developer Portal](https://discord.com/developers/applications) | New Application → Bot → Privileged Gateway Intents 3개 ON (Message Content, Server Members, Presence) → Reset Token으로 토큰 복사 |
| 2 | **Discord Server / User ID** | Discord 클라이언트 (Developer Mode ON) | 서버명 우클릭 → Copy ID. 본인 닉 우클릭 → Copy User ID |
| 3 | **Bot 초대 URL** | Discord OAuth2 URL Generator | Scopes: `bot` + `applications.commands`. Permissions: Send Messages / Embed Links / Read Message History / Add Reactions / Use Slash Commands. 생성된 URL로 본인 서버에 초대 |
| 4 | **Google Gemini API Key** | [Google AI Studio](https://aistudio.google.com/apikey) | Free tier OK |
| 5 | **명지대 SSO 학번/비밀번호** | 본인 학교 계정 | 처음 사용자가 봇 modal에 입력 (사전 준비 X — 운영자 본인 계정도 봇에서 입력) |
| 6 | **호스트 시스템 요구사항** | — | Docker Desktop (macOS/Windows) 또는 Docker Engine + Compose v2 (Linux). 최소 4GB RAM (PaddleOCR + Gemini 호출 동시) |
| 7 | **(선택) ngrok account + reserved domain** | [ngrok.com](https://ngrok.com) | view-server `:3001` 외부 노출용. 학식·과제 webview 링크가 사용자 브라우저에 열리려면 공인 URL 필요. Cloudflare Tunnel 등 다른 reverse proxy도 OK |
| 8 | **(선택) 호스트 Postgres** | brew/apt 등 직접 설치 | 옵션 A. 컨테이너 안 bundled PG 안 쓸 때 사용. **옵션 B**(bundled)도 가능 — 아래 PG 옵션 참고 |

### 2-2. clone + 환경변수

```bash
# 최신 release tag로 고정 (안정)
git clone -b v1.1.0 https://github.com/university-claw/mjuclaw-setup.git
cd mjuclaw-setup

# 또는 최신 main을 추적하려면
git clone https://github.com/university-claw/mjuclaw-setup.git
cd mjuclaw-setup
```

```bash
cp .env.example .env
# 편집 — 아래 "필수 채워야 할 변수" 참고
${EDITOR:-vi} .env
```

#### 필수 채워야 할 변수 (`.env`)

| 변수 | 채울 값 |
|---|---|
| `DISCORD_BOT_TOKEN` | 위 1번에서 받은 토큰 |
| `DISCORD_SERVER_ID` | 위 2번 server ID |
| `DISCORD_USER_ID` | 위 2번 본인 user ID (관리자 표시용) |
| `GEMINI_API_KEY` | 위 4번 Gemini API 키 |
| `VIEW_BASE_URL` | `https://<your-domain>.ngrok-free.dev` (위 7번) — ngrok 안 쓰면 `http://localhost:3001` (외부 사용자는 webview 링크 못 봄) |
| `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD` / `PGSCHEMA` | 호스트 Postgres 접속 정보 (옵션 A) 또는 bundled PG의 default 값 (옵션 B). schema는 `public_data` |
| `MJU_PGHOST` / `MJU_PGPORT` / `MJU_PGDATABASE` / `MJU_PGUSER` / `MJU_PGPASSWORD` / `MJU_PGSCHEMA` | mju-cli SSO 크리덴셜 저장용 PG (보통 위와 같은 클러스터). schema는 `user_data`. **`PGUSER`와 다른 ROLE이어야 함** (보안: public_data ROLE은 user_data 못 읽고, user_data ROLE은 public_data 못 씀) |
| `MJU_VAULT_KEY` | `openssl rand -hex 32` 로 생성. **이 키 잃으면 SSO 비밀번호 복호화 불가** — password manager에 백업 |
| `STORAGE_LOCAL_ROOT` | 호스트 절대경로 (예: `/Users/yourname/mjuclaw-data/assets`). worker가 공지 첨부/이미지 저장, agent는 read-only 마운트 |
| `MJUCLAW_ROUTER_TOKEN` | `openssl rand -hex 32` (router HTTP /discord/send 인증) |
| `OPENCLAW_GATEWAY_TOKEN` | `openssl rand -hex 32` (router → agent gateway 인증) |
| `CLASSIFIER_AUTH_TOKEN` | `openssl rand -hex 32` (router → classifier HTTP 인증) |

`.env.example`에 각 변수의 의미와 예시가 한국어 주석으로 적혀있다. 그대로 따라 채우면 됨.

### 2-3. Postgres 옵션 — 두 가지 중 선택

#### 옵션 A. 호스트 PG 사용 (운영 권장)

호스트에 Postgres 직접 설치 + DB/스키마/ROLE 미리 생성:

```bash
# 호스트에 Postgres 설치 (예: macOS)
brew install postgresql@17 && brew services start postgresql@17

# DB + 스키마 + ROLE
psql postgres <<'SQL'
CREATE DATABASE mjuclaw;
\c mjuclaw
CREATE SCHEMA public_data;
CREATE SCHEMA user_data;
CREATE ROLE mjuclaw_app WITH LOGIN PASSWORD 'change-me';
CREATE ROLE mjuclaw_user_app WITH LOGIN PASSWORD 'change-me';
GRANT USAGE, CREATE ON SCHEMA public_data TO mjuclaw_app;
GRANT USAGE, CREATE ON SCHEMA user_data TO mjuclaw_user_app;
SQL
```

`.env`의 `PGHOST=host.docker.internal` (Docker Desktop 기본) 그대로 두면 컨테이너에서 호스트 PG 접근 가능.

#### 옵션 B. compose 안 bundled PG 사용 (빠른 시작)

`--profile public-data` 켜면 `mjuclaw-public-data-db` (Postgres 16-alpine) 컨테이너가 같이 시작된다. `.env`의 `PUBLIC_DATA_PGUSER/PASSWORD` 등을 원하는 값으로.

```bash
docker compose --profile public-data up -d --build
```

이 경우 `PGHOST=public-data-db` (compose 내부 hostname) 으로 설정.

### 2-4. 실행

```bash
./setup.sh
```

setup.sh가 자동으로:
1. git/docker 의존성 검증
2. 5개 sub-repo clone (`mju-cli`, `mju-public-data-reader` → 로컬 경로 `mju-news`, `mjuclaw-router`, `mju-public-data-worker`, `intent-classifier`)
3. `.env` 필수값 검증 (누락이면 abort + 어떤 변수인지 표시)
4. `docker compose build` (intent-classifier는 빌드 시 HF Hub에서 모델 download, worker는 PaddleOCR 설치 — 첫 빌드 5~15분)
5. `docker compose up -d`

### 2-5. 정상 작동 검증

```bash
# 4개 컨테이너 모두 Up
docker compose ps

# 헬스체크
docker exec mjuclaw-router curl -sS http://localhost:3100/healthz
docker exec mjuclaw-agent  curl -sS http://localhost:3001/health
docker exec mjuclaw-classifier curl -sS http://localhost:3200/healthz
docker logs mjuclaw-worker --tail 20    # schedule:tick 로그
```

Discord에서 본인 서버의 봇에게 DM 한 번:
- 첫 메시지 → router가 onboarding modal 발사 (학번/비번 입력)
- 입력 완료 → 환영 카드 + 카테고리 Poll 1건 (공지 알림 카테고리 선택)
- 출석 알림은 시간표 기반 cron이 자동 등록됨 (수업 시작 + 5분 후 미체크 시 DM)

### 2-6. 외부 노출 (ngrok)

view-server :3001 을 사용자가 브라우저로 열려면 외부 URL 필요. 가장 단순:

```bash
ngrok http --domain=<your-reserved-domain>.ngrok-free.dev 3001
```

ngrok도 Docker Compose로 관리하려면 자동 로드되는 로컬 override 대신 명시 파일을 같이 지정한다:

```bash
docker compose -f docker-compose.yml -f docker-compose.ngrok.yml --profile ngrok up -d ngrok
```

`.env`의 `VIEW_BASE_URL=https://<your-reserved-domain>.ngrok-free.dev` 일치시킬 것. ngrok 외에 Cloudflare Tunnel/Caddy/Nginx + 도메인도 OK.

---

## 3. 환경변수 reference

전체 변수는 `.env.example`에 한국어 주석으로 설명되어 있다. 분류:

| 분류 | 변수 |
|---|---|
| Discord/AI | `DISCORD_BOT_TOKEN`, `GEMINI_API_KEY`, `OPENCLAW_MODEL`, `DISCORD_SERVER_ID`, `DISCORD_USER_ID`, `VIEW_PORT`, `VIEW_BASE_URL` |
| 공개 데이터 PG | `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSCHEMA` |
| 사용자 데이터 PG | `MJU_PGHOST`, `MJU_PGPORT`, `MJU_PGDATABASE`, `MJU_PGUSER`, `MJU_PGPASSWORD`, `MJU_PGSCHEMA`, `MJU_STORAGE`, `MJU_VAULT_KEY` |
| 자산 저장 | `STORAGE_LOCAL_ROOT` |
| Router/Gateway | `MJUCLAW_ROUTER_TOKEN`, `MJUCLAW_ROUTER_URL`, `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`, `ROUTER_LOG_LEVEL` |
| Classifier | `CLASSIFIER_ENABLED`, `CLASSIFIER_URL`, `CLASSIFIER_AUTH_TOKEN`, `CLASSIFIER_TIMEOUT_MS`, `CLASSIFIER_ABUSE_THRESHOLD`, `CLASSIFIER_LOG_LEVEL` |
| Worker | `WORKER_LOG_LEVEL`, `PUBLIC_DATA_*`, `CAFETERIA_OCR_COMMAND`, `PADDLE_OCR_REC_MODEL_NAME`, `PUBLIC_DATA_WORKER_TICK_INTERVAL_SECONDS`, `OPENAI_API_KEY`, `NOTICE_NORMALIZATION_*` |
| Sub-repo branch (release 고정용) | `MJU_CLI_BRANCH`, `MJU_NEWS_BRANCH`, `MJUCLAW_ROUTER_BRANCH`, `MJU_PUBLIC_DATA_WORKER_BRANCH`, `INTENT_CLASSIFIER_BRANCH` |
| 외부 터널 | `NGROK_DOMAIN` |

`setup.sh`는 현재 `mju-cli`를 main branch로 고정해 기존 clone도 배포 기준 branch로 동기화한다. 수동 준비 시 동일한 기준은 다음과 같다:

```bash
git clone --branch main https://github.com/university-claw/mju-cli.git
```

---

## 4. 운영

### 로그 확인

```bash
docker compose logs -f                    # 전 service
docker logs -f mjuclaw-router             # 사용자 메시지 흐름
docker logs -f mjuclaw-agent              # LLM + tool call
docker logs -f mjuclaw-worker             # 공지/학식 수집
docker logs -f mjuclaw-classifier         # abuse 분류 latency
```

### cron 작업

```bash
docker exec mjuclaw-agent openclaw cron list
```

- `attend-<discord_id>-<gen>-<dow>-<hhmm>-<lecture>` — 사용자별 수업 시간 + 5분 후 출석 체크
- `news-<discord_id>` — 사용자별 정기 공지 알림 (default 매일 8시)
- `onboarding-collect-<discord_id>` — 카테고리 Poll 답변 수거 (1회성)

### 사용자 데이터 위치

```
/data/users/<discord_id>/
├── vault/                          # AES-256-GCM 암호화 비밀번호 (envelope encryption)
├── state/
│   ├── profile.json                # 학번 + authMode
│   └── lms-session.json            # SSO 쿠키
├── attendance-alert.json           # 출석 알림 시간표 + cron 매핑
├── news-subscription.json          # 뉴스 알림 cron 식 + 카테고리
└── onboarding-survey.json          # 온보딩 설문 진행 상태
```

> `MJU_STORAGE=postgres`이면 위 vault/profile은 Postgres `user_data` 스키마에 저장 (디렉토리는 빈 상태).

### Docker volume

| Volume | 컨테이너 경로 | 내용 |
|---|---|---|
| `agent-data` | `/home/agent/.openclaw` | OpenClaw config / 세션 / cron jobs / view-store |
| `user-data` | `/data/users` | 사용자별 vault/state (옵션 A 사용 시) |
| `router-data` | `/home/router/.openclaw` | router의 device pairing key (재시작 시 재페어링 회피) |
| `${STORAGE_LOCAL_ROOT}` (host mount) | `/data/assets` | worker가 저장한 공지 첨부/이미지 (agent ro 마운트) |
| `public-data-db` | (profile 활성 시) | bundled Postgres 데이터 |

### 사용자 reset

특정 사용자를 처음부터 다시 onboarding하게 만들고 싶을 때:

```bash
UID=415349075274104832
docker exec mjuclaw-agent mju-news-alert unsubscribe $UID
docker exec mjuclaw-agent mju-attendance-alert unsubscribe $UID
docker exec mjuclaw-agent mju-onboarding-survey reset $UID
docker exec mjuclaw-agent mju --app-dir /data/users/$UID --format json auth forget
docker exec mjuclaw-agent rm -rf /data/users/$UID
docker exec mjuclaw-agent rm -f /home/agent/.openclaw/agents/main/sessions/discord-$UID.jsonl
```

---

## 5. 환경 이전 (Migration) — 같은 secrets/계정 그대로 새 호스트로

본인이 호스트만 옮길 때 (Discord bot token, Gemini API key, ngrok reserved domain 모두 그대로). 다른 사용자에게 넘기는 게 아니라 본인 운영 환경 이전.

### 옮길 데이터 7가지

| # | 항목 | 보관 위치 | 비고 |
|---|---|---|---|
| 1 | `.env` | mjuclaw-setup 루트 | 모든 secrets — `MJU_VAULT_KEY` 동일해야 vault 복호화 |
| 2 | Docker volume `user-data` | `/data/users` | 사용자 vault + state (옵션 A `MJU_STORAGE=postgres`이면 PG에 저장 — 이 항목 skip) |
| 3 | Docker volume `agent-data` | `/home/agent/.openclaw` | OpenClaw config / cron jobs / view-store / 세션 |
| 4 | Docker volume `router-data` | `/home/router/.openclaw` | router의 device pairing key (없어도 자동 재페어링되지만 startup 지연 회피) |
| 5 | `STORAGE_LOCAL_ROOT` 호스트 path | 호스트 절대경로 | worker가 저장한 공지 첨부/이미지 (큰 사이즈 가능) |
| 6 | 호스트 Postgres `mjuclaw` DB (옵션 A) | 호스트 PG | `public_data` + `user_data` 스키마 모두. `pg_dump -Fc` |
| 7 | bundled PG volume `public-data-db` (옵션 B) | Docker volume | `pg_dump` 또는 volume tar export |

### Export — 본인 호스트 (이전 출발지)

```bash
cd ~/Codes/projects/mjuclaw/mjuclaw-setup
docker compose down                                       # 일관성을 위해 잠시 stop

# .env + STORAGE_LOCAL_ROOT 자산 + Docker volume 3개 + PG 덤프
EXPORT=/tmp/mjuclaw-export && mkdir -p $EXPORT
cp .env $EXPORT/
rsync -a "$(grep ^STORAGE_LOCAL_ROOT .env | cut -d= -f2)/" $EXPORT/assets/
for v in mjuclaw-setup_user-data mjuclaw-setup_agent-data mjuclaw-setup_router-data; do
  docker run --rm -v "$v:/data" -v $EXPORT:/backup alpine \
    tar czf /backup/$v.tar.gz -C /data .
done
# 호스트 Postgres 옵션 A
pg_dump -h localhost -U mjuclaw_app -Fc mjuclaw > $EXPORT/mjuclaw.dump

# 묶어서 새 호스트로 전송
tar czf ~/mjuclaw-export.tar.gz -C $EXPORT .
scp ~/mjuclaw-export.tar.gz NEW_HOST:~/

docker compose up -d                                      # 본인 호스트 다시 켜기 (이전 후엔 stop 권장)
```

### Import — 새 호스트 (이전 도착지)

```bash
# 1. 사전 준비: Docker Desktop / docker-compose / Postgres(옵션 A) / ngrok 설치
# (호스트 OS별 설치는 README의 "사전 준비물" 섹션 참고)

# 2. export 풀기
mkdir -p ~/mjuclaw-import && tar xzf ~/mjuclaw-export.tar.gz -C ~/mjuclaw-import

# 3. setup clone + .env 복사
git clone -b v1.1.0 https://github.com/university-claw/mjuclaw-setup.git
cd mjuclaw-setup
cp ~/mjuclaw-import/.env .env

# 4. STORAGE_LOCAL_ROOT 새 호스트 path로 변경 + 자산 복사
NEW_STORAGE=$HOME/mjuclaw-data/assets
mkdir -p $NEW_STORAGE
rsync -a ~/mjuclaw-import/assets/ $NEW_STORAGE/
sed -i.bak "s|^STORAGE_LOCAL_ROOT=.*|STORAGE_LOCAL_ROOT=$NEW_STORAGE|" .env

# 5. (옵션 A) 호스트 Postgres 새로 설치 + restore
brew install postgresql@17 && brew services start postgresql@17     # 또는 apt-get install postgresql-17
psql postgres <<'SQL'
CREATE DATABASE mjuclaw;
CREATE ROLE mjuclaw_app LOGIN PASSWORD 'change-me';
CREATE ROLE mjuclaw_user_app LOGIN PASSWORD 'change-me';
SQL
pg_restore -h localhost -U mjuclaw_app -d mjuclaw ~/mjuclaw-import/mjuclaw.dump

# 6. 컨테이너 build (sub-repo 자동 clone + 4 image build)
./setup.sh    # 마지막에 docker compose up -d 자동 실행

# 7. Docker volume 복원 (반드시 위 setup.sh 후, 컨테이너 stop 상태에서)
docker compose down
for v in mjuclaw-setup_user-data mjuclaw-setup_agent-data mjuclaw-setup_router-data; do
  docker run --rm -v "$v:/data" -v ~/mjuclaw-import:/backup alpine \
    sh -c "cd /data && tar xzf /backup/$v.tar.gz"
done
docker compose up -d

# 8. ngrok 다시 시작 (같은 reserved domain → VIEW_BASE_URL 그대로 작동)
NGROK_DOMAIN=$(grep ^VIEW_BASE_URL .env | sed 's|.*//||; s|/.*||')
ngrok http --domain=$NGROK_DOMAIN 3001
```

### 주의사항

- **`MJU_VAULT_KEY` 절대 새로 생성 금지** — `.env`에 있는 그 값과 동일해야 기존 사용자 vault 복호화 가능. 잃으면 모든 사용자 재 onboarding 필요.
- **PG 비밀번호** 도 `.env`와 새 호스트 PG의 ROLE password가 같아야 (위 SQL의 `change-me` 부분을 `.env`의 `PGPASSWORD` 값으로).
- **Discord bot은 한 번에 한 토큰만 connect** — 이전 중에는 본인 호스트 컨테이너를 반드시 `docker compose down` (위에 포함됨).
- **호스트 launchd worker** (com.mjuclaw.worker.plist)도 본인 호스트에서 unload — 새 호스트에선 컨테이너 worker가 대체:
  ```bash
  launchctl unload ~/Library/LaunchAgents/com.mjuclaw.worker.plist
  ```
- **ngrok reserved domain**은 ngrok account 자체에 묶여있어 새 호스트에서 같은 account로 ngrok 띄우면 그대로 사용 가능. account 정보는 `~/.config/ngrok/ngrok.yml` 또는 ngrok dashboard에서.

---

## 6. 업데이트 (이미 설치된 호스트)

```bash
cd mjuclaw-setup
git pull
./setup.sh           # sub-repo 자동 pull + image rebuild + restart
```

또는 release tag 변경:

```bash
git fetch --tags && git checkout v1.1.1   # 새 release 나오면
./setup.sh
```

---

## 7. 트러블슈팅

| 증상 | 원인 / 조치 |
|---|---|
| `setup.sh: ERR: DISCORD_BOT_TOKEN must NOT be set in agent container` | docker-compose 의 agent service에 `DISCORD_BOT_TOKEN` env가 들어갔음. 보안상 router 단독 소유 정책. 해당 라인 삭제. |
| 봇이 메시지에 응답 안 함 | router 로그에서 `Discord 클라이언트 ready` 확인. 없으면 token/intent 권한 점검. agent 로그에 LLM timeout이면 Gemini quota/연결. |
| 학식/공지가 비어있음 | worker 로그에서 `schedule:tick` 결과 확인. PaddleOCR 첫 호출 시 모델 download(~30s) 필요. PG 연결 OK인지 `docker exec mjuclaw-worker node dist/main.js doctor`. |
| 같은 schedule cron이 여러 개 | `mju-news-alert` / `mju-attendance-alert` 가 user-level flock + post-add dedupe로 자동 정리. 그래도 남으면 `openclaw cron remove <id>` 수동. |
| onboarding modal 누르면 "This interaction failed" | router/agent 두 봇이 동시에 같은 토큰으로 connect 됐는지 확인. agent 컨테이너 안에 `DISCORD_BOT_TOKEN` env 없어야 함. |
| 다른 사용자 데이터가 본인 응답에 섞임 | router가 `--session-id discord-<id>`를 넘기고 `--to`를 넘기지 않는지, 메시지에 `[현재 사용자 컨텍스트]`의 `discordUserId`가 붙는지 검증. agent sessions는 `agent:main:explicit:discord-<id>` 형태로 사용자별 분리되어야 함. |

---

## 8. 관련 레포

- [mju-cli](https://github.com/university-claw/mju-cli) — 명지대 서비스 CLI (LMS/MSI/UCheck/Library, SSO 기반)
- [mju-public-data-reader](https://github.com/university-claw/mju-public-data-reader) — Reader CLI (worker DB → JSON, 로컬 빌드 경로 `mju-news`)
- [mju-public-data-worker](https://github.com/university-claw/mju-public-data-worker) — 공지/학식 정본 worker (private)
- [mjuclaw-router](https://github.com/university-claw/mjuclaw-router) — Discord WS 입구 + 온보딩 게이트
- [intent-classifier](https://github.com/university-claw/intent-classifier) — KcELECTRA-base 한국어 의도 분류

---

## 9. 라이선스 / 기여

내부 프로젝트. 외부 contribution은 별도 계약 후. 보안 취약점 발견 시 GitHub Security Advisory.
