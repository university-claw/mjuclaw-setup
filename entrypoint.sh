#!/bin/bash
set -e

# ── 환경변수 검증 ────────────────────────────────────────────────
if [ -z "$DISCORD_BOT_TOKEN" ]; then
  echo "ERR: DISCORD_BOT_TOKEN is required" >&2
  exit 1
fi

if [ -z "$NVIDIA_API_KEY" ]; then
  echo "ERR: NVIDIA_API_KEY is required" >&2
  exit 1
fi

MODEL="${OPENCLAW_MODEL:-google/gemma-4-31b-it}"
DISCORD_SERVER_ID="${DISCORD_SERVER_ID:-1492100109997969499}"
DISCORD_USER_ID="${DISCORD_USER_ID:-415349075274104832}"

# ── openclaw.json 생성 ──────────────────────────────────────────
python3 -c "
import json, secrets, os

config = {
    'models': {
        'mode': 'merge',
        'providers': {
            'nvidia': {
                'baseUrl': 'https://integrate.api.nvidia.com/v1',
                'apiKey': os.environ['NVIDIA_API_KEY'],
                'api': 'openai-completions',
                'models': [{
                    'id': os.environ.get('OPENCLAW_MODEL', 'google/gemma-4-31b-it'),
                    'name': 'nvidia/' + os.environ.get('OPENCLAW_MODEL', 'google/gemma-4-31b-it'),
                    'reasoning': False,
                    'input': ['text'],
                    'cost': {'input': 0, 'output': 0, 'cacheRead': 0, 'cacheWrite': 0},
                    'contextWindow': 131072,
                    'maxTokens': 4096,
                }]
            }
        }
    },
    'agents': {
        'defaults': {
            'model': {
                'primary': 'nvidia/' + os.environ.get('OPENCLAW_MODEL', 'google/gemma-4-31b-it')
            }
        }
    },
    'commands': {
        'native': 'auto',
        'nativeSkills': 'auto',
        'restart': True,
        'ownerDisplay': 'raw',
    },
    'channels': {
        'defaults': {},
        'discord': {
            'enabled': True,
            'token': os.environ['DISCORD_BOT_TOKEN'],
            'groupPolicy': 'allowlist',
            'guilds': {
                os.environ.get('DISCORD_SERVER_ID', '1492100109997969499'): {
                    'requireMention': True,
                    'users': [os.environ.get('DISCORD_USER_ID', '415349075274104832')],
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
        'lastTouchedVersion': '2026.3.11',
    }
}

path = os.path.expanduser('~/.openclaw/openclaw.json')
with open(path, 'w') as f:
    json.dump(config, f, indent=2)
os.chmod(path, 0o600)
print('Config written to', path)
"

# ── 초기 doctor 실행 ────────────────────────────────────────────
openclaw doctor --fix > /dev/null 2>&1 || true

echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  MJUClaw OpenClaw Agent                     │"
echo "  │  Model: $MODEL"
echo "  │  Discord: enabled                           │"
echo "  └─────────────────────────────────────────────┘"
echo ""

# ── gateway 시작 ─────────────────────────────────────────────────
exec openclaw gateway
