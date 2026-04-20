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

# ── Workspace 프롬프트·스킬 동기화 (volume shadow 회피) ───────────
# agent-data named volume이 /home/agent/.openclaw를 덮어써서 이미지의
# workspace/*.md와 skills/ 업데이트가 그대로는 반영되지 않는다.
# Dockerfile이 image의 source of truth를 /opt/mjuclaw-workspace-template/ 에
# 두므로, 시작할 때마다 여기서 volume 쪽으로 밀어넣는다.
# --delete로 이미지에서 삭제된 항목까지 반영하되, 그 외 runtime 파일
# (openclaw.json, cron/, canvas/, sessions/, view-store.json 등)은 건드리지 않는다.
TEMPLATE_DIR="/opt/mjuclaw-workspace-template/workspace"
WORKSPACE_DIR="/home/agent/.openclaw/workspace"
if [ -d "$TEMPLATE_DIR" ]; then
  mkdir -p "$WORKSPACE_DIR/skills"
  # -rlt: 재귀+심볼릭링크+mtime만 보존. --no-owner/--no-group로 chgrp 시도 회피
  # (agent 유저는 다른 UID로 올라간 파일의 group을 바꿀 권한이 없다).
  rsync -rlt --delete --no-owner --no-group \
    "$TEMPLATE_DIR/skills/" "$WORKSPACE_DIR/skills/" || {
      echo "WARN: skills rsync failed, falling back to cp" >&2
      rm -rf "$WORKSPACE_DIR/skills"
      cp -r "$TEMPLATE_DIR/skills" "$WORKSPACE_DIR/"
    }
  # 루트 *.md (BOOTSTRAP/IDENTITY/SOUL 등)는 skills와 별도로 덮어쓰기.
  # (rsync 최상위에 --delete를 걸면 skills/ 밖의 runtime 파일이 지워질 수 있어 분리)
  for src in "$TEMPLATE_DIR"/*.md; do
    [ -f "$src" ] && cp -f "$src" "$WORKSPACE_DIR/"
  done
  echo "Synced workspace template → $WORKSPACE_DIR"
fi

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

# ── 구 mju-news-scrape cron 제거 ─────────────────────────────────
# v2.0.0에서 스크래핑 책임은 호스트의 mju-public-data-worker가 가져갔다.
# 예전 버전 위에서 업그레이드한 설치본이면 남아있을 수 있으므로 정리한다.
openclaw cron rm "mju-news-scrape" > /dev/null 2>&1 || true

# ── 온보딩된 유저에 대한 출석 알림 자동 backfill (백그라운드) ────
# 온보딩 완료 = /data/users/<id>/vault/*.enc 존재.
# 이미 구독 중이면 refresh로 시간표 재스냅, 아니면 subscribe로 신규 등록.
# 각 유저당 timetable 조회 + cron 등록이 5~7초 들 수 있어 gateway 기동을 막지 않도록
# 백그라운드로 돌린다. 실패(시간표 미제공, SSO 만료 등)는 stderr로만 남김.
attendance_backfill() {
  shopt -s nullglob 2>/dev/null || true
  for user_dir in /data/users/*/; do
    discord_id=$(basename "$user_dir")
    [[ "$discord_id" =~ ^[0-9]{17,20}$ ]] || continue
    # vault에 크리덴셜 있는지로 "온보딩 완료" 판정
    vault_any=("$user_dir"vault/*.enc)
    [ -e "${vault_any[0]}" ] || continue

    status_out=$(mju-attendance-alert status "$discord_id" 2>/dev/null || printf '%s' '{"enabled":false}')
    if printf '%s' "$status_out" | grep -q '"courses"'; then
      mju-attendance-alert refresh "$discord_id" >/dev/null 2>&1 \
        || echo "WARN entrypoint: attendance refresh failed for $discord_id" >&2
    else
      mju-attendance-alert subscribe "$discord_id" >/dev/null 2>&1 \
        || echo "WARN entrypoint: attendance subscribe failed for $discord_id" >&2
    fi
  done
}
attendance_backfill &
echo "Started attendance alert backfill in background (PID $!)"

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
