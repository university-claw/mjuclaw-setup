#!/bin/bash
set -euo pipefail

# ── 환경변수 검증 ────────────────────────────────────────────────
if [ -z "${DISCORD_BOT_TOKEN:-}" ]; then
  echo "ERR: DISCORD_BOT_TOKEN is required" >&2
  exit 1
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "ERR: GEMINI_API_KEY is required" >&2
  exit 1
fi

MODEL="${OPENCLAW_MODEL:-gemini-2.5-flash}"
DISCORD_SERVER_ID="${DISCORD_SERVER_ID:-1492100109997969499}"
DISCORD_USER_ID="${DISCORD_USER_ID:-415349075274104832}"

# Config 스키마 버전. 변경되면 기존 config를 백업하고 재생성한다.
CONFIG_SCHEMA_VERSION="3"
CONFIG_PATH="/home/agent/.openclaw/openclaw.json"
VERSION_MARKER="/home/agent/.openclaw/.mjuclaw-schema-version"

# ── 디렉토리 + 퍼미션 보장 ───────────────────────────────────────
mkdir -p /home/agent/.openclaw
chmod 700 /home/agent/.openclaw

# ── Config 버전 체크 ────────────────────────────────────────────
regenerate_config=true
if [ -f "$CONFIG_PATH" ] && [ -f "$VERSION_MARKER" ]; then
  current_version=$(cat "$VERSION_MARKER" 2>/dev/null || echo "0")
  if [ "$current_version" = "$CONFIG_SCHEMA_VERSION" ]; then
    echo "Existing openclaw.json matches schema v$CONFIG_SCHEMA_VERSION, keeping."
    regenerate_config=false
  else
    echo "Schema changed ($current_version → $CONFIG_SCHEMA_VERSION), regenerating config."
    cp "$CONFIG_PATH" "$CONFIG_PATH.bak.$(date +%s)" 2>/dev/null || true
  fi
fi

if [ "$regenerate_config" = true ]; then
python3 <<'PYEOF'
import json, secrets, os

model = os.environ.get('OPENCLAW_MODEL', 'gemini-2.5-flash')

config = {
    'models': {
        'mode': 'merge',
        'providers': {
            # Gemini 네이티브 API — OpenAI 호환 엔드포인트 tool-schema 400 회피
            'google': {
                'baseUrl': 'https://generativelanguage.googleapis.com',
                'apiKey': os.environ['GEMINI_API_KEY'],
                'api': 'google-generative-ai',
                'models': [{
                    'id': model,
                    'name': 'google/' + model,
                    'reasoning': False,
                    'input': ['text'],
                    'cost': {'input': 0, 'output': 0, 'cacheRead': 0, 'cacheWrite': 0},
                    'contextWindow': 1048576,
                    'maxTokens': 8192,
                }]
            }
        }
    },
    'agents': {
        'defaults': {
            'model': {
                'primary': 'google/' + model
            }
        }
    },
    'commands': {
        'native': 'auto',
        'nativeSkills': 'auto',
        'restart': True,
        'ownerDisplay': 'raw',
    },
    # multi-user: DM 유저별 세션 격리
    'session': {
        'dmScope': 'per-channel-peer',
    },
    'channels': {
        'defaults': {},
        'discord': {
            'enabled': True,
            'token': os.environ['DISCORD_BOT_TOKEN'],
            # DM open — 누구나 DM 가능 (온보딩이 실질적 방어선)
            'dmPolicy': 'open',
            'allowFrom': ['*'],
            # 길드는 allowlist — MJU 서버 멤버만 사용 가능
            'groupPolicy': 'allowlist',
            'guilds': {
                os.environ.get('DISCORD_SERVER_ID', '1492100109997969499'): {
                    'requireMention': True,
                    'users': [],  # 빈 배열 = 길드 멤버 전체 허용
                }
            }
        }
    },
    'gateway': {
        'mode': 'local',
        'controlUi': {
            'allowedOrigins': ['http://127.0.0.1:18789'],
            'allowInsecureAuth': True,
            'dangerouslyDisableDeviceAuth': True,
        },
        'auth': {'token': secrets.token_hex(32)},
        'trustedProxies': ['127.0.0.1', '::1'],
    },
    'meta': {
        'lastTouchedVersion': '2026.4.11',
    }
}

path = os.path.expanduser('~/.openclaw/openclaw.json')
# 원자적 쓰기
tmp = path + '.tmp'
with open(tmp, 'w') as f:
    json.dump(config, f, indent=2)
os.chmod(tmp, 0o600)
os.replace(tmp, path)
print(f'Config v{os.environ.get("CONFIG_SCHEMA_VERSION","?")} written to', path)
PYEOF

  echo "$CONFIG_SCHEMA_VERSION" > "$VERSION_MARKER"
  chmod 600 "$VERSION_MARKER"
fi

# ── 불필요한 플러그인 비활성화 (tool-schema 간소화) ──────────────
# Gemini native API는 tool schema에 관대하지만 최소화로 안정성 유지
for plugin in browser phone-control talk-voice device-pair; do
  openclaw plugins disable "$plugin" > /dev/null 2>&1 || true
done

# ── 초기 doctor 실행 ────────────────────────────────────────────
openclaw doctor --fix > /dev/null 2>&1 || true

# ── 공용 mju-news scrape cron 자동 등록 ─────────────────────────
# 이미 있으면 스킵 (ID는 다를 수 있으니 이름 기준)
if ! openclaw cron list --json 2>/dev/null | grep -q '"mju-news-scrape"'; then
  openclaw cron add \
    --name "mju-news-scrape" \
    --every "30m" \
    --session isolated \
    --message "mju-news scrape --format json 실행해서 최신 공지 수집. 내부 기록용이므로 응답 불필요." \
    --no-deliver \
    --tools "exec" \
    --timeout-seconds 120 > /dev/null 2>&1 || true
  echo "Registered mju-news-scrape cron (every 30m)"
fi

echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  MJUClaw OpenClaw Agent                     │"
echo "  │  Model: $MODEL (Gemini native)"
echo "  │  Discord: enabled                           │"
echo "  └─────────────────────────────────────────────┘"
echo ""

# ── view-server 시작 (백그라운드) ─────────────────────────────────
node /opt/view-server/dist/view-server.js &
VIEW_PID=$!
echo "  view-server: http://localhost:${VIEW_PORT:-3001} (PID $VIEW_PID)"

# view-server가 죽으면 컨테이너도 죽게 (docker restart 유도)
check_view_server() {
  while true; do
    sleep 30
    if ! kill -0 $VIEW_PID 2>/dev/null; then
      echo "ERR: view-server died (PID $VIEW_PID)" >&2
      kill $$ 2>/dev/null
      exit 1
    fi
  done
}
check_view_server &

# ── gateway 시작 (포그라운드) ─────────────────────────────────────
exec openclaw gateway
