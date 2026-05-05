#!/bin/bash
# MJUClaw Agent — 원클릭 셋업 스크립트
#
# 사용법:
#   ./setup.sh
#
# 동작:
#   1. mju-cli, mju-news를 gitignore된 디렉토리에 clone (또는 이미 있으면 pull)
#   2. .env 파일이 없으면 .env.example을 복사하고 유저에게 편집 안내
#   3. docker compose build + up
#
# 주의: 토폴로지 A(하이브리드) 전제.
#   - Postgres는 호스트에 직접 설치되어 있어야 한다 (Homebrew / apt 등).
#   - mju-public-data-worker는 별도 레포를 호스트에서 직접 돌린다
#     (이 setup은 clone 하지 않는다). 참고: ../mju-public-data-worker

set -e
cd "$(dirname "$0")"

echo "┌─────────────────────────────────────────────┐"
echo "│  MJUClaw Agent — 자동 셋업                  │"
echo "└─────────────────────────────────────────────┘"
echo ""

# ── 1. 사전 요건 확인 ───────────────────────────────────────────
echo "[1/4] 사전 요건 확인..."
for cmd in git docker; do
  if ! command -v $cmd >/dev/null 2>&1; then
    echo "  ✗ $cmd 미설치. 먼저 설치하세요." >&2
    exit 1
  fi
done
if ! docker compose version >/dev/null 2>&1; then
  echo "  ✗ docker compose 미설치 (docker v2)." >&2
  exit 1
fi
echo "  ✓ git, docker, docker compose 모두 준비됨"

# ── 2. 도구 레포 clone/pull ─────────────────────────────────────
echo ""
echo "[2/4] 도구 레포 준비..."

clone_or_pull() {
  local DIR="$1"
  local REPO="$2"
  if [ -d "$DIR/.git" ]; then
    echo "  → $DIR 이미 있음, pull 중..."
    (cd "$DIR" && git pull --ff-only) || echo "  ⚠ $DIR pull 실패 (수동 해결 필요)"
  else
    echo "  → $DIR clone 중..."
    git clone "$REPO" "$DIR"
  fi
}

clone_or_pull mju-cli https://github.com/university-claw/mju-cli.git
# mju-news v2.0.0+ : Reader CLI (worker DB 읽어서 JSON 제공).
# dev 브랜치에 변경이 진행 중이면 아래 한 줄을 `git checkout dev`로 교체.
clone_or_pull mju-news https://github.com/university-claw/mju-news.git
# mjuclaw-router : Discord WS 입구 + 온보딩 게이트 + cron alert 우회 HTTP 서버.
# OpenClaw 측 Discord 채널은 비활성화되며, 봇 토큰은 router가 단독 소유한다.
clone_or_pull mjuclaw-router https://github.com/university-claw/mjuclaw-router.git
# mju-public-data-worker : 공지/학식 정본 생성 worker (Postgres + tesseract.js OCR).
# private 레포 — 다른 호스트에서 setup.sh 실행 시 GitHub 인증(gh auth login 또는 SSH)
# 필요. compose에 worker service로 통합되어 호스트 launchd 의존이 제거된다.
clone_or_pull mju-public-data-worker https://github.com/university-claw/mju-public-data-worker.git

# intent-classifier : KcELECTRA-base 15-class 한국어 의도 분류 모델 + serving.
# 모델 가중치(420MB)는 git이 아니라 HuggingFace Hub(kbsooo/mjuclaw-intent-classifier)에서
# Dockerfile이 빌드 시 huggingface_hub.snapshot_download 로 자동 download. 따라서
# 다른 sub-repo와 동일한 clone_or_pull 패턴으로 충분하다 (호스트에 model/ 없어도 빌드 가능).
clone_or_pull intent-classifier https://github.com/university-claw/intent-classifier.git

# ── 3. .env 확인 ────────────────────────────────────────────────
echo ""
echo "[3/4] 환경변수 파일 확인..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  ⚠ .env 파일을 방금 생성했습니다. 아래 값을 채워주세요:"
  echo ""
  echo "    - DISCORD_BOT_TOKEN"
  echo "    - GEMINI_API_KEY"
  echo "    - DISCORD_SERVER_ID, DISCORD_USER_ID (관리자용)"
  echo "    - VIEW_BASE_URL (ngrok 또는 공개 도메인)"
  echo ""
  echo "  편집 후 다시 ./setup.sh 를 실행하세요."
  exit 0
fi
echo "  ✓ .env 존재"

# 필수값 체크
missing=()
for key in DISCORD_BOT_TOKEN GEMINI_API_KEY PGPASSWORD STORAGE_LOCAL_ROOT MJUCLAW_ROUTER_TOKEN; do
  val=$(grep "^$key=" .env | cut -d= -f2-)
  if [ -z "$val" ] || [[ "$val" == your_* ]] || [[ "$val" == "change-me" ]] || [[ "$val" == /absolute/* ]] || [[ "$val" == replace-me-* ]]; then
    missing+=("$key")
  fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "  ✗ 다음 환경변수를 .env에 채워주세요: ${missing[*]}" >&2
  exit 1
fi

# ── 4. 빌드 + 실행 ──────────────────────────────────────────────
echo ""
echo "[4/4] Docker 빌드 + 기동..."
docker compose build
docker compose up -d

echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│  ✅ 셋업 완료                                │"
echo "│                                             │"
echo "│  로그 확인:   docker logs -f mjuclaw-agent  │"
echo "│              docker logs -f mjuclaw-router  │"
echo "│  컨테이너 진입: docker exec -it mjuclaw-agent bash │"
echo "│  정지:       docker compose down            │"
echo "└─────────────────────────────────────────────┘"
echo ""
echo "ngrok 터널이 아직 안 떠있으면 별도 터미널에서:"
echo "  ngrok http --domain=\$NGROK_DOMAIN 3001"
echo ""
