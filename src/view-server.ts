import express from "express";
import { getView, storeView, startViewCleanup } from "./view-store";
import { renderViewHtml, renderExpiredHtml } from "./view-renderer";

const app = express();
app.use(express.json());

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
  const { dataType, title, summary, rawData, aiResponse } = req.body;
  if (!dataType || !title) {
    res.status(400).json({ error: "dataType and title are required" });
    return;
  }

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
