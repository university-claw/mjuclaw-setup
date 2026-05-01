// OpenClaw plugin: mjuclaw onboarding gate.
//
// Discord에서 들어오는 inbound 메시지를 dispatch 단계에서 가로채, 사용자가 아직
// 온보딩(SSO 로그인)되지 않았으면 LLM/agent 호출 없이 deterministic하게 로그인 modal을
// 발사한다. 온보딩 완료 사용자는 그대로 통과해 기존 LLM agent 흐름이 동작한다.
//
// 동작 요약
// ─ ctx.channelId !== "discord" → 통과 (다른 채널은 정책 미정, 보수적으로 패스)
// ─ vault 존재 (= 온보딩 완료)  → 통과
// ─ vault 없음 + DM             → modal 발사 후 { handled: true } (LLM/agent abort)
// ─ vault 없음 + 길드           → 안내 텍스트만 + { handled: true }
//
// 이 hook이 잡지 못하는 케이스(senderId 추출 실패 등)는 통과로 두고 LLM 측 BOOTSTRAP
// 안내가 fallback 역할을 한다 — 미온보딩 사용자가 LLM을 호출하는 일은 fallback 경로에서만
// 가능하므로 비용 누수 영향 작다.

import { existsSync, readdirSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const VAULT_DIR = (id) => `/data/users/${id}/vault`;
// Discord snowflake (17~20자리 숫자)만 허용 — vault 경로 traversal 방어.
const DISCORD_ID_RE = /^[0-9]{17,20}$/;

const ONBOARDING_TEXT =
  "🦁 명지대 학사 서비스를 이용하려면 로그인이 필요합니다.\n\n" +
  "아래 **로그인하기** 버튼을 눌러 학번과 비밀번호를 입력해주세요.\n" +
  "⚠️ 비밀번호는 AES-256-GCM으로 암호화되어 저장되고 평문 로깅되지 않습니다.";

const GUILD_REDIRECT_TEXT =
  "🦁 명지대 봇을 사용하려면 DM에서 로그인이 필요합니다.\n" +
  "좌측 봇 프로필 → 메시지 보내기로 DM에서 다시 시도해주세요.";

function isOnboarded(senderId) {
  if (!DISCORD_ID_RE.test(senderId)) return false;
  const dir = VAULT_DIR(senderId);
  try {
    const stat = statSync(dir);
    if (!stat.isDirectory()) return false;
  } catch {
    return false;
  }
  try {
    return readdirSync(dir).some((name) => name.endsWith(".enc"));
  } catch {
    return false;
  }
}

function buildModalComponents(discordUserId) {
  return {
    blocks: [{ type: "text", text: ONBOARDING_TEXT }],
    modal: {
      title: "명지대 로그인",
      triggerLabel: "로그인하기",
      triggerStyle: "primary",
      allowedUsers: [discordUserId],
      fields: [
        {
          name: "studentId",
          label: "학번",
          type: "text",
          style: "short",
          required: true,
          placeholder: "예: 60212158",
        },
        {
          name: "password",
          label: "비밀번호",
          type: "text",
          style: "short",
          required: true,
          placeholder: "포털 비밀번호",
        },
      ],
    },
    reusable: false,
  };
}

// child process로 `openclaw message send` 호출. stdout 본문은 무시(send 결과 JSON
// 가능성), 실패 시 stderr와 exit code 캡처해 stderr 로깅. throw 안 하고 boolean 반환.
function sendOnboardingModal(discordUserId) {
  return new Promise((resolve) => {
    const components = JSON.stringify(buildModalComponents(discordUserId));
    const child = spawn(
      "openclaw",
      [
        "message",
        "send",
        "--channel",
        "discord",
        "--target",
        `user:${discordUserId}`,
        "--message",
        "🦁 명지대 학사 서비스를 이용하려면 로그인이 필요합니다.",
        "--components",
        components,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      console.error(`[onboarding-gate] spawn error for ${discordUserId}: ${err.message}`);
      resolve(false);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        console.error(
          `[onboarding-gate] modal send failed for ${discordUserId} (code=${code}): ${stderr.trim()}`,
        );
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

function isGuildEvent(event) {
  // openclaw discord channel은 group/guild 채널을 isGroup=true로 표시.
  if (event && event.isGroup === true) return true;
  // event.channel 형식이 'guild:...' 또는 channelId 가 guild prefix 인 경우 보완.
  const channel = (event && event.channel) || "";
  if (typeof channel === "string" && channel.startsWith("guild:")) return true;
  return false;
}

function pluginEnabled(config) {
  if (!config || typeof config !== "object") return true; // 기본 enabled
  return config.enabled !== false;
}

export default definePluginEntry({
  id: "onboarding-gate",
  name: "MJU Onboarding Gate",
  description:
    "Discord 미온보딩 사용자의 메시지를 LLM 호출 전에 가로채 로그인 modal을 발사한다.",
  register(api) {
    const config = api.pluginConfig;

    api.on("before_dispatch", async (event, ctx) => {
      try {
        if (!pluginEnabled(config)) return;
        if (!ctx || ctx.channelId !== "discord") return;

        // senderId 추출 — context 우선, event는 fallback.
        const senderId =
          (ctx && ctx.senderId) || (event && event.senderId) || "";
        if (!senderId) return;

        if (isOnboarded(senderId)) return; // 통과 → LLM/agent 진행

        // 미온보딩.
        if (isGuildEvent(event)) {
          // 길드: modal 안 띄우고 안내 텍스트만 — DM 유도.
          return { handled: true, text: GUILD_REDIRECT_TEXT };
        }

        // DM: modal 발사 + abort. modal 발사 실패해도 LLM은 abort
        // (실패한 채로 LLM에 통과시키는 것보다 retry 유도가 안전).
        const ok = await sendOnboardingModal(senderId);
        if (!ok) {
          return {
            handled: true,
            text:
              "🦁 명지대 로그인 안내를 보내는 중 오류가 발생했어요. 잠시 후 다시 메시지를 보내주세요.",
          };
        }
        return { handled: true };
      } catch (err) {
        // hook 자체 예외는 LLM/agent 흐름을 깨지 않도록 통과 처리.
        // 미온보딩 사용자가 LLM에 도달하는 fallback 비용은 BOOTSTRAP의 안내가 흡수.
        console.error(
          `[onboarding-gate] unexpected error: ${err && err.message ? err.message : err}`,
        );
        return;
      }
    });
  },
});
