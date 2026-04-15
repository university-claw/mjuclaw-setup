import express from "express";
import { getView, storeView, startViewCleanup } from "./view-store";
import { renderViewHtml, renderExpiredHtml } from "./view-renderer";
import type { ViewEntry } from "./types";

const app = express();
app.use(express.json({ limit: "500kb" }));

const ALLOWED_DATA_TYPES = new Set<ViewEntry["dataType"]>([
  "timetable",
  "grades",
  "graduation",
  "courses",
  "action-items",
  "unsubmitted",
  "due-assignments",
  "unread-notices",
  "attendance",
  "news",
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

// ── 서버 시작 ───────────────────────────────────────────────────

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
