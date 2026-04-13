#!/bin/bash
set -e

# ── 환경변수 검증 ────────────────────────────────────────────────
if [ -z "$DISCORD_BOT_TOKEN" ]; then
  echo "ERR: DISCORD_BOT_TOKEN is required" >&2
  exit 1
fi

if [ -z "$GEMINI_API_KEY" ]; then
  echo "ERR: GEMINI_API_KEY is required" >&2
  exit 1
fi

MODEL="${OPENCLAW_MODEL:-gemini-2.5-flash}"
DISCORD_SERVER_ID="${DISCORD_SERVER_ID:-1492100109997969499}"
DISCORD_USER_ID="${DISCORD_USER_ID:-415349075274104832}"

# ── openclaw.json 생성 (이미 있으면 스킵 — 유저 수정 보존) ─────────
if [ -f /home/agent/.openclaw/openclaw.json ]; then
  echo "Existing openclaw.json found, skipping config generation"
else
python3 -c "
import json, secrets, os

model = os.environ.get('OPENCLAW_MODEL', 'gemini-2.5-flash')

config = {
    'models': {
        'mode': 'merge',
        'providers': {
            'gemini': {
                'baseUrl': 'https://generativelanguage.googleapis.com/v1beta/openai',
                'apiKey': os.environ['GEMINI_API_KEY'],
                'api': 'openai-completions',
                'models': [{
                    'id': model,
                    'name': 'gemini/' + model,
                    'reasoning': False,
                    'input': ['text'],
                    'cost': {'input': 0, 'output': 0, 'cacheRead': 0, 'cacheWrite': 0},
                    'contextWindow': 131072,
                    'maxTokens': 8192,
                }]
            }
        }
    },
    'agents': {
        'defaults': {
            'model': {
                'primary': 'gemini/' + model
            }
        }
    },
    'commands': {
        'native': 'auto',
        'nativeSkills': 'auto',
        'restart': True,
        'ownerDisplay': 'raw',
    },
    # multi-user 환경: DM을 유저별로 격리 (기본값 'main'은 모든 DM 공유)
    'session': {
        'dmScope': 'per-channel-peer',
    },
    'channels': {
        'defaults': {},
        'discord': {
            'enabled': True,
            'token': os.environ['DISCORD_BOT_TOKEN'],
            # DM 오픈 — 누구나 DM 가능 (온보딩이 실질적 방어선)
            'dmPolicy': 'open',
            'allowFrom': ['*'],
            # 길드는 allowlist — MJU 서버 멤버만 사용 가능
            'groupPolicy': 'allowlist',
            'guilds': {
                os.environ.get('DISCORD_SERVER_ID', '1492100109997969499'): {
                    # @멘션한 경우에만 응답 (채널 노이즈 방지)
                    'requireMention': True,
                    # users 목록 없음 → 길드 멤버 전체 허용
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
with open(path, 'w') as f:
    json.dump(config, f, indent=2)
os.chmod(path, 0o600)
print('Config written to', path)
"
fi

# ── 초기 doctor 실행 ────────────────────────────────────────────
openclaw doctor --fix > /dev/null 2>&1 || true

echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  MJUClaw OpenClaw Agent                     │"
echo "  │  Model: $MODEL (Gemini)"
echo "  │  Discord: enabled                           │"
echo "  └─────────────────────────────────────────────┘"
echo ""

# ── view-server 시작 (백그라운드) ─────────────────────────────────
node /opt/view-server/dist/view-server.js &
VIEW_PID=$!
echo "  view-server: http://localhost:${VIEW_PORT:-3001} (PID $VIEW_PID)"

# ── gateway 시작 (포그라운드) ─────────────────────────────────────
exec openclaw gateway
