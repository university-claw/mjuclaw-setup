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
clone_or_pull mju-news https://github.com/university-claw/mju-news.git
clone_or_pull mju-public-data-worker https://github.com/university-claw/mju-public-data-worker.git

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
for key in DISCORD_BOT_TOKEN GEMINI_API_KEY; do
  val=$(grep "^$key=" .env | cut -d= -f2-)
  if [ -z "$val" ] || [[ "$val" == your_* ]]; then
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
echo "│  로그 확인:   docker logs -f mjuclaw-agent   │"
echo "│  컨테이너 진입: docker exec -it mjuclaw-agent bash │"
echo "│  정지:       docker compose down            │"
echo "└─────────────────────────────────────────────┘"
echo ""
echo "ngrok 터널이 아직 안 떠있으면 별도 터미널에서:"
echo "  ngrok http --domain=\$NGROK_DOMAIN 3001"
echo ""
