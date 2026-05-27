import express from "express";
import path from "node:path";
import { execFile } from "node:child_process";
import { getView, storeView, startViewCleanup, updateViewSummary } from "./view-store";
import { renderViewHtml, renderExpiredHtml } from "./view-renderer";
import type { ViewEntry } from "./types";

const app = express();
const JSON_BODY_LIMIT = process.env.VIEW_JSON_LIMIT || "10mb";
app.use(express.json({ limit: JSON_BODY_LIMIT }));

// 정적 자산 (마스코트 로고 등). Dockerfile이 public/ 를 /opt/view-server/public/ 로 복사.
const STATIC_DIR = process.env.VIEW_STATIC_DIR || path.join(__dirname, "..", "public");
app.use(
  "/static",
  express.static(STATIC_DIR, {
    maxAge: "30d",
    immutable: true,
    fallthrough: false,
  }),
);

const ALLOWED_DATA_TYPES = new Set<ViewEntry["dataType"]>([
  "timetable",
  "timetable-planner",
  "course-scores",
  "grades",
  "grade-history",
  "graduation",
  "action-items",
  "unsubmitted",
  "unread-notices",
  "attendance",
  "news",
  "news-detail",
  "cafeteria",
]);

// ── 웹 뷰 엔드포인트 ───────────────────────────────────────────

app.get("/view/:id", (req, res) => {
  const { id } = req.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    res.status(400).send("Invalid ID");
    return;
  }

  const entry = getView(id);
  if (!entry) {
    res.status(410).send(renderExpiredHtml());
    return;
  }

  res.send(renderViewHtml(entry));
});

// ── 뷰 저장 API (OpenClaw skill에서 호출) ───────────────────────

app.post("/api/view", (req, res) => {
  // Only accept local callers: loopback plus RFC1918 private ranges for Docker/LAN setups.
  if (!isAllowedClient(req.ip) && !isAllowedClient(req.socket.remoteAddress)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const parsed = validateViewPayload(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const { dataType, title, summary, rawData, aiResponse } = parsed.value;

  const id = storeView({
    dataType,
    title,
    summary: summary || "",
    rawData: rawData || null,
    aiResponse: aiResponse || "",
  });

  const baseUrl = process.env.VIEW_BASE_URL || `http://localhost:${PORT}`;
  res.json({ id, url: `${baseUrl}/view/${id}` });
});

// ── 헬스체크 ────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── 온보딩 후속 트리거 (router → agent) ────────────────────────
// router의 OnboardingLoginRunner가 mju auth login 성공 직후 호출.
// agent 컨테이너 안에서 mju-attendance-alert subscribe + mju-onboarding-
// survey start 를 비-블로킹으로 실행해 출석 알림 cron + 공지 알림 설문
// Poll 두 건을 등록한다. helper들이 router HTTP로 Discord 호출을 위임
// 하므로 agent에 Discord 토큰이 없어도 정상 동작한다.
app.post("/internal/onboarding-postlogin", (req, res) => {
  const expected = process.env.MJUCLAW_ROUTER_TOKEN || "";
  if (!expected) {
    res.status(503).json({ ok: false, reason: "router_token_unset" });
    return;
  }
  const auth = req.headers["authorization"];
  if (typeof auth !== "string" || !constantTimeBearerEqual(auth, expected)) {
    res.status(401).json({ ok: false, reason: "unauthorized" });
    return;
  }

  const body = req.body as { discordUserId?: unknown };
  const discordUserId =
    typeof body?.discordUserId === "string" ? body.discordUserId.trim() : "";
  if (!/^\d{17,20}$/.test(discordUserId)) {
    res.status(400).json({ ok: false, reason: "invalid_discordUserId" });
    return;
  }

  // 두 helper를 동시 실행. 한 쪽이 실패해도 다른 쪽 결과는 유지.
  Promise.allSettled([
    runHelper("mju-attendance-alert", ["subscribe", discordUserId]),
    runHelper("mju-onboarding-survey", ["start", discordUserId]),
  ]).then(([attendanceResult, surveyResult]) => {
    res.json({
      ok: true,
      attendance: settledToJson(attendanceResult),
      survey: settledToJson(surveyResult),
    });
  });
});

function runHelper(
  bin: string,
  args: string[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      bin,
      args,
      { timeout: 60_000, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        const exitCode =
          (err as NodeJS.ErrnoException | null)?.code === "ETIMEDOUT"
            ? 124
            : err
              ? typeof (err as { code?: number }).code === "number"
                ? ((err as { code: number }).code as number)
                : 1
              : 0;
        resolve({
          exitCode,
          stdout: stdout?.slice(0, 8 * 1024) ?? "",
          stderr: stderr?.slice(0, 8 * 1024) ?? "",
        });
      },
    );
  });
}

function settledToJson(
  r: PromiseSettledResult<{ exitCode: number; stdout: string; stderr: string }>,
): Record<string, unknown> {
  if (r.status === "fulfilled") {
    return { ok: r.value.exitCode === 0, ...r.value };
  }
  return { ok: false, error: String(r.reason) };
}

function constantTimeBearerEqual(header: string, expected: string): boolean {
  const m = /^Bearer\s+(.+)$/.exec(header);
  if (!m || !m[1]) return false;
  const a = m[1];
  if (a.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

// ── 서버 시작 ───────────────────────────────────────────────────

// PATCH: AI 요약 나중에 주입 (wrapper가 rawData만 먼저 저장, 에이전트가 요약 생성 후 호출)
app.patch("/api/view/:id/summary", (req, res) => {
  if (!isAllowedClient(req.ip) && !isAllowedClient(req.socket.remoteAddress)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const { id } = req.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const aiResponse = body?.aiResponse;
  const summary = body?.summary;

  if (typeof aiResponse !== "string" || aiResponse.length > 30000) {
    res.status(400).json({ error: "aiResponse must be a string up to 30000 chars" });
    return;
  }

  if (summary !== undefined && (typeof summary !== "string" || summary.length > 2000)) {
    res.status(400).json({ error: "summary must be a string up to 2000 chars" });
    return;
  }

  const ok = updateViewSummary(id, aiResponse, typeof summary === "string" ? summary : undefined);
  if (!ok) {
    res.status(404).json({ error: "not found or expired" });
    return;
  }

  res.json({ ok: true });
});

const PORT = parseInt(process.env.VIEW_PORT || "3001", 10);

startViewCleanup();

app.listen(PORT, () => {
  console.log(`[view-server] listening on port ${PORT}`);
});

function validateViewPayload(body: unknown):
  | { ok: true; value: Omit<ViewEntry, "id" | "createdAt" | "expiresAt"> }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid payload" };
  }

  const { dataType, title, summary, rawData, aiResponse } = body as Record<string, unknown>;

  if (typeof dataType !== "string" || !ALLOWED_DATA_TYPES.has(dataType)) {
    return { ok: false, error: "invalid dataType" };
  }

  if (typeof title !== "string" || title.length === 0 || title.length > 256) {
    return { ok: false, error: "title must be a non-empty string up to 256 chars" };
  }

  if (summary != null && (typeof summary !== "string" || summary.length > 2000)) {
    return { ok: false, error: "summary must be a string up to 2000 chars" };
  }

  if (aiResponse != null && (typeof aiResponse !== "string" || aiResponse.length > 30000)) {
    return { ok: false, error: "aiResponse must be a string up to 30000 chars" };
  }

  return {
    ok: true,
    value: {
      dataType,
      title,
      summary: typeof summary === "string" ? summary : "",
      rawData: rawData ?? null,
      aiResponse: typeof aiResponse === "string" ? aiResponse : "",
    },
  };
}

function isAllowedClient(address: string | undefined): boolean {
  if (!address) return false;

  const normalized = address.startsWith("::ffff:") ? address.slice(7) : address;
  if (normalized === "::1" || normalized === "127.0.0.1") {
    return true;
  }

  const parts = normalized.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  if (first === 10) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return false;
}
