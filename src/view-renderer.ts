import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";
import type { ViewEntry } from "./types";

/**
 * mjuclaw 웹뷰 렌더러 v2 — Coinbase-inspired.
 *
 * 디자인 원칙:
 *   - 순백 배경 (다크는 #0A0B0D). 블루(#0052FF feel)는 액센트에만.
 *   - 큰 bold sans 숫자 (28-32px, tabular-nums). 그라데이션/과장된 display 금지.
 *   - 원형 주제 아이콘 칩 (2글자) + hairline 리스트. 카드 반복 지양.
 *   - pill-shape CTA, 섹션 타이틀 중심 ("Today's briefing" 감각).
 *   - 졸업요건은 동심원 ring (막대그래프 아님).
 *   - green ↗ / red ↘ 변동 표시 (남용 X).
 *   - system-following dark/light.
 */

const DATA_TYPE_META: Record<string, { kicker: string; detail: string }> = {
  timetable: { kicker: "TIMETABLE", detail: "시간표" },
  grades: { kicker: "GRADES", detail: "성적" },
  "grade-history": { kicker: "GRADE HISTORY", detail: "학기별 성적" },
  graduation: { kicker: "GRADUATION", detail: "졸업요건" },
  courses: { kicker: "COURSES", detail: "수강과목" },
  "action-items": { kicker: "TODAY'S BRIEFING", detail: "지금 할 일" },
  unsubmitted: { kicker: "ASSIGNMENTS", detail: "미제출 과제" },
  "due-assignments": { kicker: "DUE SOON", detail: "마감 임박" },
  "unread-notices": { kicker: "NOTICES", detail: "LMS 공지" },
  attendance: { kicker: "ATTENDANCE", detail: "출석" },
  news: { kicker: "PUBLIC NOTICES", detail: "학교 공지" },
  "news-detail": { kicker: "NOTICE DETAIL", detail: "공지 상세" },
  cafeteria: { kicker: "CAFETERIA", detail: "학식" },
};

function metaFor(dataType: string): { kicker: string; detail: string } {
  return (
    DATA_TYPE_META[dataType] ?? {
      kicker: dataType.toUpperCase().replace(/-/g, " "),
      detail: "상세 정보",
    }
  );
}

export function renderViewHtml(entry: ViewEntry): string {
  const dataHtml = renderData(entry.dataType, entry.rawData);
  const aiResponseEffective = entry.aiResponse?.trim()
    ? entry.aiResponse
    : generateFallbackSummary(entry.dataType, entry.rawData);
  const aiSummaryHtml = renderMarkdown(aiResponseEffective);
  const created = new Date(entry.createdAt);
  const time = created.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const meta = metaFor(entry.dataType);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0A0B0D" media="(prefers-color-scheme: dark)">
<title>${esc(entry.title)} · 묭묭이</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
${pageStyles()}
</head>
<body>
<main class="page">
  <header class="topbar">
    <div class="brand">
      <div class="brand-chip" aria-hidden="true">M</div>
      <span class="brand-name">묭묭이</span>
    </div>
    <div class="topbar-meta">
      <span class="kicker">${esc(meta.kicker)}</span>
    </div>
  </header>

  <section class="hero">
    <div class="hero-eyebrow">${esc(meta.detail)}</div>
    <h1 class="hero-title">${esc(entry.title)}</h1>
    <div class="hero-sub">
      <time datetime="${esc(created.toISOString())}">${esc(time)}</time>
      <span class="sep">·</span>
      <span>30분 후 만료</span>
    </div>
  </section>

  <section class="briefing">
    <div class="briefing-label">AI 요약</div>
    <div class="briefing-body">${aiSummaryHtml}</div>
  </section>

  ${dataHtml}

  <footer class="footer">
    <span>묭묭이 · 명지대 학사 도우미</span>
  </footer>
</main>
</body>
</html>`;
}

export function renderExpiredHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0A0B0D" media="(prefers-color-scheme: dark)">
<title>만료 · 묭묭이</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
${pageStyles()}
</head>
<body>
<main class="page page-center">
  <div class="expired">
    <div class="brand-chip" style="width:44px;height:44px;font-size:20px;margin-bottom:20px">M</div>
    <div class="hero-eyebrow">EXPIRED · 만료</div>
    <h1 class="hero-title">이 링크의 유효 시간이 지났어요</h1>
    <p class="expired-body">이 웹뷰는 조회 시점부터 30분간만 열람할 수 있어요.<br>Discord에서 묭묭이에게 다시 물어보면 새 링크를 보내드려요.</p>
  </div>
</main>
</body>
</html>`;
}

function pageStyles(): string {
  return `<style>
:root {
  --bg: #FFFFFF;
  --bg-alt: #F7F8FA;
  --ink: #0A0B0D;
  --ink-2: #5B616E;
  --ink-3: #8A919E;
  --rule: #EFF0F3;
  --rule-strong: #E5E7EB;
  --accent: #0052FF;
  --accent-deep: #0156A6;
  --accent-bright: #3498DB;
  --accent-soft: #EEF3FE;
  --accent-soft-2: #DDE6FD;
  --chip-bg: #F2F3F5;
  --green: #05B169;
  --red: #CF202F;
  --warn: #B07300;
  --warn-soft: #FFF3D6;
  --green-soft: #E9F7EE;
  --red-soft: #FAE8E8;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 999px;

  --font-sans: 'Inter', 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', system-ui, sans-serif;
  --font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0A0B0D;
    --bg-alt: #16171D;
    --ink: #FFFFFF;
    --ink-2: #A6ACB9;
    --ink-3: #6C7280;
    --rule: #22242B;
    --rule-strong: #2B2E36;
    --accent: #3498DB;
    --accent-deep: #3498DB;
    --accent-bright: #5AB0E6;
    --accent-soft: rgba(52, 152, 219, 0.16);
    --accent-soft-2: rgba(52, 152, 219, 0.24);
    --chip-bg: #1D1F26;
    --green: #4EDB97;
    --red: #F07070;
    --warn: #E8C575;
    --warn-soft: rgba(232, 197, 117, 0.14);
    --green-soft: rgba(78, 219, 151, 0.14);
    --red-soft: rgba(240, 112, 112, 0.14);
  }
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  background: var(--bg);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.55;
  letter-spacing: -0.005em;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 0 20px 60px;
}

.page { max-width: 560px; margin: 0 auto; }
.page-center { min-height: 80vh; display: flex; align-items: center; justify-content: center; }

/* Topbar */
.topbar {
  padding: 20px 0 16px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.brand { display: flex; align-items: center; gap: 10px; }
.brand-chip {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; letter-spacing: -0.02em;
}
.brand-name {
  font-size: 15px; font-weight: 700; color: var(--ink);
  letter-spacing: -0.01em;
}
.kicker {
  font-size: 11px; font-weight: 600;
  color: var(--ink-3);
  letter-spacing: 0.12em; text-transform: uppercase;
}

/* Hero */
.hero { padding: 10px 0 24px; border-bottom: 1px solid var(--rule); }
.hero-eyebrow {
  font-size: 12px; color: var(--ink-2); font-weight: 500; margin-bottom: 8px;
}
.hero-title {
  font-size: 28px; font-weight: 700; color: var(--ink);
  letter-spacing: -0.02em; line-height: 1.2; word-break: keep-all;
  text-wrap: balance; margin-bottom: 10px;
}
.hero-sub {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  font-size: 12.5px; color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}
.hero-sub .sep { color: var(--rule-strong); }

/* Briefing (AI summary) */
.briefing {
  padding: 20px 0; border-bottom: 1px solid var(--rule);
}
.briefing-label {
  font-size: 11px; font-weight: 700;
  color: var(--accent); letter-spacing: 0.14em;
  text-transform: uppercase; margin-bottom: 10px;
}
.briefing-body {
  font-size: 15px; line-height: 1.7; color: var(--ink-2);
  word-break: keep-all;
}
.briefing-body p { margin-bottom: 8px; }
.briefing-body p:last-child { margin-bottom: 0; }
.briefing-body strong { color: var(--ink); font-weight: 600; }
.briefing-body em { color: var(--ink-3); font-style: italic; }
.briefing-body ul, .briefing-body ol { padding-left: 18px; margin: 8px 0; }
.briefing-body li { margin-bottom: 4px; }
.briefing-body h1, .briefing-body h2, .briefing-body h3 {
  font-size: 15px; font-weight: 700; color: var(--ink); margin: 12px 0 6px;
}
.briefing-body code {
  font-family: var(--font-mono); font-size: 0.88em;
  background: var(--chip-bg); color: var(--ink);
  padding: 1px 6px; border-radius: var(--radius-sm);
}
.briefing-body a { color: var(--accent); text-decoration: none; border-bottom: 1px solid var(--rule); }

/* Section */
.section { padding: 26px 0 4px; }
.section-title {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 4px;
}
.section-title h2 {
  font-size: 17px; font-weight: 700; color: var(--ink);
  letter-spacing: -0.01em;
}
.section-title .count {
  color: var(--ink-3); font-weight: 500; margin-left: 6px;
  font-variant-numeric: tabular-nums;
}
.section-sub { font-size: 12.5px; color: var(--ink-3); margin-bottom: 10px; }

/* Row (asset-style list) */
.row {
  display: grid; grid-template-columns: 36px 1fr auto;
  gap: 12px; align-items: center;
  padding: 14px 0; border-bottom: 1px solid var(--rule);
}
.row:last-child { border-bottom: none; }
.row-icon {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--chip-bg); color: var(--ink-2);
  display: flex; align-items: center; justify-content: center;
  font-size: 11.5px; font-weight: 700; letter-spacing: -0.01em;
  flex: 0 0 36px;
}
.row-icon.accent { background: var(--accent-soft); color: var(--accent); }
.row-icon.green { background: var(--green-soft); color: var(--green); }
.row-icon.red { background: var(--red-soft); color: var(--red); }
.row-icon.warn { background: var(--warn-soft); color: var(--warn); }
.row-main { min-width: 0; }
.row-title {
  font-size: 14.5px; font-weight: 600; color: var(--ink);
  letter-spacing: -0.005em; line-height: 1.35;
  display: flex; align-items: center; gap: 6px;
}
.row-title a {
  color: inherit; text-decoration: none;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  min-width: 0;
}
.row-title a:hover { color: var(--accent); }
.row-title .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent); flex: 0 0 6px;
}
.row-sub {
  font-size: 12px; color: var(--ink-3); margin-top: 3px;
  font-variant-numeric: tabular-nums;
}
.row-value {
  text-align: right; font-size: 13px; font-weight: 600;
  color: var(--ink-2); font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.row-value.accent { color: var(--accent); }
.row-value.green { color: var(--green); }
.row-value.red { color: var(--red); }
.row-value.warn { color: var(--warn); }

.row-preview {
  font-size: 12.5px; color: var(--ink-3); line-height: 1.55;
  margin-top: 6px; padding-left: 10px;
  border-left: 2px solid var(--rule);
  grid-column: 1 / -1;
  word-break: keep-all;
}

/* Urgent hero card */
.urgent-card {
  background: var(--bg-alt); border-radius: var(--radius-lg);
  padding: 14px; margin-top: 12px;
  display: flex; flex-direction: column; gap: 10px;
}
.urgent-head { display: flex; align-items: center; gap: 10px; }
.urgent-badge {
  font-size: 11px; font-weight: 700;
  color: var(--red); letter-spacing: 0.06em; text-transform: uppercase;
}
.urgent-title {
  font-size: 14.5px; font-weight: 600; color: var(--ink);
  letter-spacing: -0.005em; margin-top: 2px;
}
.urgent-meta { font-size: 12px; color: var(--ink-3); }

/* Badge (chip) */
.badge {
  display: inline-flex; align-items: center;
  font-size: 11px; font-weight: 600;
  padding: 3px 9px; border-radius: var(--radius-pill);
  white-space: nowrap;
}
.badge-red { color: var(--red); background: var(--red-soft); }
.badge-green { color: var(--green); background: var(--green-soft); }
.badge-warn { color: var(--warn); background: var(--warn-soft); }
.badge-blue { color: var(--accent); background: var(--accent-soft); }
.badge-gray { color: var(--ink-2); background: var(--chip-bg); }

/* Day pills (timetable) */
.day-pills {
  display: flex; gap: 6px; margin: 12px 0 18px;
}
.day-pill {
  flex: 1; padding: 10px 0; border-radius: var(--radius-md);
  background: var(--chip-bg); color: var(--ink-2);
  text-align: center;
}
.day-pill.today { background: var(--ink); color: var(--bg); }
.day-pill-label {
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.05em; opacity: 0.75;
}
.day-pill-date {
  font-size: 15px; font-weight: 700;
  margin-top: 3px; letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

/* Day group */
.day-group { margin-bottom: 18px; }
.day-group:last-child { margin-bottom: 0; }
.day-group-head {
  display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px;
}
.day-group-label {
  font-size: 14px; font-weight: 700; color: var(--ink);
  letter-spacing: -0.005em;
}
.day-group-today { font-size: 11.5px; color: var(--accent); font-weight: 600; }

/* Metrics row (GPA / earned / etc) */
.metric-hero {
  padding-top: 4px;
}
.metric-label {
  font-size: 12.5px; color: var(--ink-3); font-weight: 500;
}
.metric-value {
  font-size: 30px; font-weight: 700; color: var(--ink);
  letter-spacing: -0.02em; margin-top: 6px; line-height: 1.05;
  font-variant-numeric: tabular-nums;
}
.metric-value .unit {
  font-size: 18px; color: var(--ink-3); font-weight: 500;
}
.metric-trend { margin-top: 6px; font-size: 12.5px; color: var(--ink-3); }
.metric-trend .up { color: var(--green); font-weight: 600; }
.metric-trend .down { color: var(--red); font-weight: 600; }

.metric-row {
  display: flex; gap: 24px; margin-top: 20px;
}
.metric-cell .k { font-size: 11px; color: var(--ink-3); font-weight: 500; }
.metric-cell .v {
  font-size: 16px; font-weight: 700; color: var(--ink);
  margin-top: 3px; letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}

/* Graduation rings */
.grad-hero {
  display: flex; align-items: center; gap: 20px; padding-top: 4px;
}
.ring { position: relative; flex: 0 0 auto; }
.ring svg { display: block; transform: rotate(-90deg); }
.ring-track { fill: none; stroke: var(--chip-bg); }
.ring-fill { fill: none; stroke: var(--accent); stroke-linecap: round; }
.ring-fill.done { stroke: var(--green); }
.ring-text {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.ring-pct {
  font-size: 28px; font-weight: 700; color: var(--ink);
  letter-spacing: -0.02em; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.ring-pct .u { font-size: 16px; color: var(--ink-3); font-weight: 600; }
.ring-cap {
  font-size: 10px; color: var(--ink-3); margin-top: 4px;
  letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600;
}

.ring-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px;
}
.ring-card {
  background: var(--bg-alt); border-radius: var(--radius-md); padding: 14px;
  display: flex; flex-direction: column; gap: 10px;
}
.ring-card-head {
  display: flex; justify-content: space-between; align-items: center;
}
.ring-card-pct {
  font-size: 11px; font-weight: 600; color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}
.ring-card-pct.done { color: var(--green); }
.ring-card-title {
  font-size: 13px; font-weight: 600; color: var(--ink);
  letter-spacing: -0.005em; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.ring-card-meta {
  font-size: 11.5px; color: var(--ink-3);
  margin-top: 3px; font-variant-numeric: tabular-nums;
}

/* Progress bar (generic) */
.progress-bar {
  height: 6px; background: var(--chip-bg);
  border-radius: var(--radius-pill); overflow: hidden;
}
.progress-fill {
  height: 100%; border-radius: var(--radius-pill);
  background: var(--accent);
}
.progress-fill.done { background: var(--green); }
.progress-foot {
  display: flex; justify-content: space-between;
  margin-top: 8px; font-size: 11.5px; color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

/* Dot grid (attendance contribution) */
.dot-grid {
  display: grid; grid-template-columns: repeat(14, 1fr); gap: 4px;
  margin-top: 12px;
}
.dot-cell { aspect-ratio: 1 / 1; border-radius: 3px; background: var(--chip-bg); }
.dot-cell.present { background: var(--accent); }
.dot-cell.tardy { background: var(--warn); }
.dot-cell.absent { background: var(--red); }
.dot-legend {
  display: flex; gap: 12px; margin-top: 12px;
  font-size: 11px; color: var(--ink-3);
}
.dot-legend-item { display: flex; align-items: center; gap: 5px; }
.dot-legend-sq { width: 8px; height: 8px; border-radius: 2px; }

/* Grade distribution bar */
.dist-bar {
  display: flex; height: 6px; border-radius: var(--radius-pill);
  overflow: hidden; margin-top: 14px;
}
.dist-legend {
  display: flex; justify-content: space-between;
  margin-top: 10px; font-size: 12px; color: var(--ink-2);
}

/* CTAs (pills) */
.cta-row { display: flex; gap: 8px; margin-top: 24px; }
.cta-pill {
  flex: 1; padding: 13px 0; border-radius: var(--radius-pill);
  font-size: 14px; font-weight: 600; text-align: center;
  letter-spacing: -0.005em; text-decoration: none;
}
.cta-pill.primary { background: var(--accent); color: #fff; }
.cta-pill.secondary { background: var(--accent-soft); color: var(--accent); }

/* Raw JSON fallback */
.raw-json {
  font-family: var(--font-mono); font-size: 12px; line-height: 1.55;
  color: var(--ink-2); background: var(--chip-bg);
  border-radius: var(--radius-md); padding: 14px 16px;
  overflow-x: auto; white-space: pre-wrap; word-break: break-all;
}

/* Footer */
.footer {
  margin-top: 48px; padding-top: 20px;
  border-top: 1px solid var(--rule);
  text-align: center; font-size: 12px; color: var(--ink-3);
  letter-spacing: 0.02em;
}

/* Expired */
.expired { text-align: left; max-width: 380px; }
.expired-body {
  font-size: 14.5px; line-height: 1.7; color: var(--ink-3);
  word-break: keep-all; margin-top: 8px;
}

::selection { background: var(--accent-soft); color: var(--ink); }
</style>`;
}

// ── dataType별 렌더러 ─────────────────────────────────

function renderData(dataType: string, data: unknown): string {
  if (!data) return "";
  const renderers: Record<string, (d: unknown) => string> = {
    timetable: renderTimetable,
    grades: renderGrades,
    "grade-history": renderGradeHistory,
    graduation: renderGraduation,
    courses: renderCourses,
    "action-items": renderActionItems,
    unsubmitted: renderAssignmentList,
    "due-assignments": renderAssignmentList,
    "unread-notices": renderNoticeList,
    attendance: renderAttendanceText,
    news: renderNewsList,
    "news-detail": renderNewsDetail,
    cafeteria: renderCafeteriaMenus,
  };
  const renderer = renderers[dataType];
  if (renderer) return renderer(data);
  return renderGeneric(data);
}

type AssignmentItem = {
  title?: string;
  courseTitle?: string;
  statusLabel?: string;
  statusText?: string;
  dueLabel?: string;
  dueAt?: string;
  isExpired?: boolean;
  isSubmitted?: boolean;
  weekLabel?: string;
  priority?: string;
};

type NoticeItem = {
  title?: string;
  courseTitle?: string;
  postedAt?: string;
  previewText?: string;
  viewCount?: number;
  isUnread?: boolean;
};

function codeChip(title: string): string {
  return esc((title || "").slice(0, 2));
}

// ── 시간표 ────────────────────────────────────────────

function renderTimetable(data: unknown): string {
  const d = data as { entries?: Array<{ dayOfWeek: number; dayLabel?: string; courseTitle: string; location?: string; timeRange?: string; professor?: string }> };
  if (!d.entries?.length) return "";

  const days = ["월", "화", "수", "목", "금"];
  const todayIdx = new Date().getDay() - 1; // 월=0
  const byDay = new Map<string, NonNullable<typeof d.entries>>();
  for (const e of d.entries) {
    const day = e.dayLabel || days[e.dayOfWeek - 1] || "?";
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(e);
  }

  // Date pills (Mon-Fri this week)
  const today = new Date();
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  let html = `<section class="section"><div class="section-title"><h2>이번 주</h2></div>`;
  html += `<div class="section-sub">수업 ${d.entries.length}개</div>`;
  html += `<div class="day-pills">`;
  for (let i = 0; i < 5; i++) {
    const dt = new Date(mon); dt.setDate(mon.getDate() + i);
    const isToday = i === todayIdx;
    html += `<div class="day-pill${isToday ? " today" : ""}"><div class="day-pill-label">${days[i]}</div><div class="day-pill-date">${dt.getDate()}</div></div>`;
  }
  html += `</div>`;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const entries = byDay.get(day);
    if (!entries) continue;
    entries.sort((a, b) => (a.timeRange || "").localeCompare(b.timeRange || ""));
    const isToday = i === todayIdx;
    html += `<div class="day-group"><div class="day-group-head"><div class="day-group-label">${day}요일</div><div class="day-group-today">${isToday ? "TODAY · " : ""}${entries.length}개</div></div>`;
    for (const e of entries) {
      const [start, end] = (e.timeRange || " – ").split(" – ");
      html += `<div class="row"><div class="row-icon">${codeChip(e.courseTitle)}</div><div class="row-main"><div class="row-title">${esc(e.courseTitle)}</div><div class="row-sub">${joinMeta([e.location, e.professor])}</div></div><div class="row-value"><div>${esc(start)}</div><div style="font-size:11px;color:var(--ink-3);margin-top:2px">${esc(end)}</div></div></div>`;
    }
    html += `</div>`;
  }
  return html + `</section>`;
}

// ── 성적 ──────────────────────────────────────────────

function renderGrades(data: unknown): string {
  const d = data as {
    items?: Array<{ courseTitle: string; credits?: number; grade?: string; score?: number; statusMessage?: string }>;
    gpa?: number; maxGpa?: number; totalCredits?: number;
  };
  if (!d.items?.length) return "";

  let html = "";

  // Hero metric
  if (typeof d.gpa === "number") {
    html += `<section class="section"><div class="metric-hero"><div class="metric-label">이번 학기 GPA</div><div class="metric-value">${d.gpa.toFixed(2)}${d.maxGpa ? `<span class="unit"> / ${d.maxGpa.toFixed(2)}</span>` : ""}</div>`;
    if (d.totalCredits) html += `<div class="metric-trend">${d.totalCredits}학점</div>`;
    html += `</div></section>`;
  }

  // Courses list
  html += `<section class="section"><div class="section-title"><h2>수강 과목<span class="count">${d.items.length}</span></h2></div>`;
  for (const it of d.items) {
    const grade = it.grade || it.statusMessage || "-";
    const top = grade === "A+";
    const iconCls = top ? "accent" : "";
    html += `<div class="row"><div class="row-icon ${iconCls}">${codeChip(it.courseTitle)}</div><div class="row-main"><div class="row-title">${esc(it.courseTitle)}</div><div class="row-sub">${joinMeta([it.credits != null ? `${it.credits}학점` : null, it.score != null ? `${it.score}점` : null])}</div></div><div class="row-value">${esc(grade)}</div></div>`;
  }
  html += `</section>`;

  // Distribution
  const dist: Record<string, number> = {};
  for (const it of d.items) {
    const g = it.grade || "";
    dist[g] = (dist[g] || 0) + 1;
  }
  const gradeKeys = Object.keys(dist).sort();
  if (gradeKeys.length > 0) {
    const total = d.items.length;
    html += `<section class="section"><div class="section-title"><h2>성적 분포</h2></div><div class="section-sub">이번 학기 기준</div>`;
    html += `<div class="dist-bar">`;
    const palette = ["var(--accent)", "var(--accent-soft-2)", "var(--rule-strong)", "var(--chip-bg)"];
    gradeKeys.forEach((g, i) => {
      const w = (dist[g] / total) * 100;
      html += `<div style="flex:${dist[g]};background:${palette[Math.min(i, palette.length - 1)]}"></div>`;
    });
    html += `</div><div class="dist-legend">`;
    for (const g of gradeKeys) {
      html += `<span><strong style="color:var(--ink);font-weight:600">${esc(g)} ${dist[g]}</strong></span>`;
    }
    html += `</div></section>`;
  }

  return html;
}

// ── 학기별 성적 (grade-history) ──────────────────────
// MsiGradeHistoryResult 형태: termRecords[] (학기별), overview (누적), creditsByCategory.
// renderGrades는 단일 학기(MsiCurrentGradesResult)만 처리하므로,
// "지난 학기" 같은 과거 성적 조회는 이 렌더러로 분리. 학기 정렬은 최신순.

function renderGradeHistory(data: unknown): string {
  const d = data as {
    overview?: Record<string, string>;
    termRecords?: Array<{
      title?: string;
      year?: number;
      termLabel: string;
      requestedCredits?: number;
      earnedCredits?: number;
      totalPoints?: number;
      gpa?: number;
      courses: Array<{
        category?: string;
        courseCode?: string;
        courseTitle: string;
        credits?: number;
        grade: string;
      }>;
    }>;
  };
  if (!d.termRecords?.length) return "";

  let html = "";

  // Hero — 누적 평점/취득 학점 (있으면)
  const overview = d.overview ?? {};
  const totalGpa =
    overview["전체평점"] || overview["누적평점"] || overview["평점"] || "";
  const totalCredits =
    overview["전체취득학점"] || overview["취득학점"] || "";
  if (totalGpa || totalCredits) {
    html += `<section class="section"><div class="metric-hero">`;
    html += `<div class="metric-label">누적 평점</div>`;
    if (totalGpa) html += `<div class="metric-value">${esc(totalGpa)}</div>`;
    if (totalCredits)
      html += `<div class="metric-trend">전체 취득 ${esc(totalCredits)}학점</div>`;
    html += `</div></section>`;
  }

  // 학기 정렬: year DESC, term DESC (2학기 > 1학기 > 계절)
  const termWeight = (label: string): number => {
    if (label.includes("2")) return 2;
    if (label.includes("1")) return 1;
    if (label.includes("동계")) return 0.5;
    if (label.includes("하계")) return 1.5;
    return 0;
  };
  const sorted = [...d.termRecords].sort((a, b) => {
    const ay = a.year ?? 0;
    const by = b.year ?? 0;
    if (ay !== by) return by - ay;
    return termWeight(b.termLabel) - termWeight(a.termLabel);
  });

  // 학기별 섹션
  for (const term of sorted) {
    if (!term.courses?.length) continue;
    const title = term.title || `${term.year ?? ""} ${term.termLabel}`.trim();

    html += `<section class="section">`;
    html += `<div class="section-title"><h2>${esc(title)}<span class="count">${term.courses.length}</span></h2></div>`;

    const sub: string[] = [];
    if (typeof term.gpa === "number") sub.push(`평점 ${term.gpa.toFixed(2)}`);
    if (term.earnedCredits != null) sub.push(`${term.earnedCredits}학점`);
    if (sub.length) html += `<div class="section-sub">${sub.join(" · ")}</div>`;

    for (const c of term.courses) {
      const top = c.grade === "A+";
      const iconCls = top ? "accent" : "";
      html += `<div class="row"><div class="row-icon ${iconCls}">${codeChip(c.courseTitle)}</div><div class="row-main"><div class="row-title">${esc(c.courseTitle)}</div><div class="row-sub">${joinMeta([c.credits != null ? `${c.credits}학점` : null, c.category])}</div></div><div class="row-value">${esc(c.grade || "-")}</div></div>`;
    }
    html += `</section>`;
  }

  return html;
}

// ── 졸업요건 (동심원 ring) ────────────────────────────

function renderGraduation(data: unknown): string {
  const d = data as {
    creditGaps?: Array<{ label: string; earned?: number; required?: number; gap?: number }>;
    overall?: { earned?: number; required?: number; pct?: number };
  };
  if (!d.creditGaps?.length) return "";

  const totalEarned = d.overall?.earned ?? d.creditGaps.reduce((a, g) => a + (g.earned ?? 0), 0);
  const totalReq = d.overall?.required ?? d.creditGaps.reduce((a, g) => a + (g.required ?? 0), 0);
  const pct = d.overall?.pct ?? (totalReq > 0 ? Math.round((totalEarned / totalReq) * 100) : 0);
  const doneCount = d.creditGaps.filter((g) => (g.gap ?? 0) === 0).length;

  // Hero ring
  const size = 128, stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);

  let html = `<section class="section"><div class="grad-hero">`;
  html += `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/><circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${dash} ${c - dash}"/></svg><div class="ring-text"><div class="ring-pct">${pct}<span class="u">%</span></div><div class="ring-cap">완료</div></div></div>`;
  html += `<div style="flex:1;min-width:0"><div class="metric-label">총 취득 학점</div><div class="metric-value" style="font-size:26px;margin-top:4px">${totalEarned}<span class="unit"> / ${totalReq}</span></div><div class="metric-trend" style="margin-top:8px">남은 <strong style="color:var(--ink);font-weight:600">${Math.max(0, totalReq - totalEarned)}학점</strong></div></div>`;
  html += `</div></section>`;

  // Breakdown rings
  html += `<section class="section"><div class="section-title"><h2>영역별<span class="count">${d.creditGaps.length}</span></h2></div><div class="section-sub">완료 ${doneCount} · 진행 ${d.creditGaps.length - doneCount}</div><div class="ring-grid">`;
  for (const g of d.creditGaps) {
    const earned = g.earned ?? 0;
    const required = g.required ?? 1;
    const perc = Math.min(100, Math.round((earned / required) * 100));
    const done = (g.gap ?? 0) === 0;
    const rs = 40, rstroke = 4;
    const rr = (rs - rstroke) / 2;
    const rc = 2 * Math.PI * rr;
    const rdash = rc * (perc / 100);
    html += `<div class="ring-card"><div class="ring-card-head"><div class="ring" style="width:${rs}px;height:${rs}px"><svg width="${rs}" height="${rs}"><circle class="ring-track" cx="${rs / 2}" cy="${rs / 2}" r="${rr}" stroke-width="${rstroke}"/><circle class="ring-fill ${done ? "done" : ""}" cx="${rs / 2}" cy="${rs / 2}" r="${rr}" stroke-width="${rstroke}" stroke-dasharray="${rdash} ${rc - rdash}"/></svg></div><div class="ring-card-pct ${done ? "done" : ""}">${done ? "✓ 완료" : `${perc}%`}</div></div><div><div class="ring-card-title">${esc(g.label)}</div><div class="ring-card-meta">${earned} / ${required} 학점</div></div></div>`;
  }
  html += `</div></section>`;

  return html;
}

// ── 수강과목 ──────────────────────────────────────────

function renderCourses(data: unknown): string {
  const d = data as { courses?: Array<{ title: string; professor?: string; code?: string }> };
  if (!d.courses?.length) return "";

  let html = `<section class="section"><div class="section-title"><h2>수강 과목<span class="count">${d.courses.length}</span></h2></div>`;
  for (const c of d.courses) {
    html += `<div class="row"><div class="row-icon">${codeChip(c.title)}</div><div class="row-main"><div class="row-title">${esc(c.title)}</div><div class="row-sub">${joinMeta([c.professor, c.code])}</div></div><div class="row-value" style="color:var(--ink-3);font-weight:500">›</div></div>`;
  }
  return html + `</section>`;
}

// ── 할 일 (Today's briefing) ──────────────────────────

function renderActionItems(data: unknown): string {
  const d = data as Record<string, unknown>;
  const unsub = (d.unsubmittedAssignments as AssignmentItem[] | undefined) ?? [];
  const due = (d.dueAssignments as AssignmentItem[] | undefined) ?? [];
  const notices = (d.unreadNotices as NoticeItem[] | undefined) ?? [];
  const online = (d.incompleteOnlineWeeks as Array<{ courseTitle?: string; weekLabel?: string; lectureTitle?: string }> | undefined) ?? [];
  const total = unsub.length + due.length + notices.length + online.length;
  if (total === 0) return `<section class="section"><div class="section-title"><h2>Today's briefing</h2></div><div class="section-sub">지금 해야 할 일이 없어요. 훌륭해요.</div></section>`;

  const urgent = unsub.find((a) => a.priority === "high" || !isAssignmentExpired(a));
  const urgentCount = unsub.filter((a) => a.priority === "high").length;

  let html = `<section class="section"><div class="section-title"><h2>Today's briefing</h2></div><div class="section-sub">총 ${total}건${urgentCount ? ` · 오늘 마감 <span style="color:var(--red);font-weight:600">${urgentCount}건</span>` : ""}</div>`;

  // Urgent hero
  if (urgent) {
    html += `<div class="urgent-card"><div class="urgent-head"><div class="row-icon red">${codeChip(urgent.courseTitle || "")}</div><div style="flex:1;min-width:0"><div class="urgent-badge">${urgent.priority === "high" ? "오늘 마감" : "진행중"}</div><div class="urgent-title">${esc(urgent.title || "")}</div></div><div class="row-value red">${esc(urgent.dueLabel || urgent.dueAt || "")}</div></div><div class="urgent-meta">${joinMeta([urgent.courseTitle, urgent.weekLabel])}</div></div>`;
  }
  html += `</section>`;

  if (unsub.length) {
    html += `<section class="section"><div class="section-title"><h2>미제출 과제<span class="count">${unsub.length}</span></h2></div>`;
    for (const a of unsub.slice(0, 5)) {
      const exp = isAssignmentExpired(a);
      const valCls = exp ? "red" : a.priority === "high" ? "red" : "";
      html += `<div class="row"><div class="row-icon">${codeChip(a.courseTitle || "")}</div><div class="row-main"><div class="row-title">${esc(a.title || "")}</div><div class="row-sub">${esc(a.courseTitle || "")}</div></div><div class="row-value ${valCls}">${esc(a.dueLabel || a.dueAt || (exp ? "만료" : ""))}</div></div>`;
    }
    html += `</section>`;
  }

  if (due.length) {
    html += `<section class="section"><div class="section-title"><h2>마감 임박<span class="count">${due.length}</span></h2></div>`;
    for (const a of due.slice(0, 5)) {
      html += `<div class="row"><div class="row-icon">${codeChip(a.courseTitle || "")}</div><div class="row-main"><div class="row-title">${esc(a.title || "")}</div><div class="row-sub">${esc(a.courseTitle || "")}</div></div><div class="row-value">${esc(a.dueLabel || a.dueAt || a.statusText || "")}</div></div>`;
    }
    html += `</section>`;
  }

  if (notices.length) {
    html += `<section class="section"><div class="section-title"><h2>안 읽은 공지<span class="count">${notices.length}</span></h2></div>`;
    for (const n of notices.slice(0, 5)) {
      html += `<div class="row"><div class="row-icon accent">${codeChip(n.courseTitle || "")}</div><div class="row-main"><div class="row-title"><span class="dot"></span><span>${esc(n.title || "")}</span></div><div class="row-sub">${esc(n.courseTitle || "")}</div></div><div class="row-value" style="color:var(--ink-3);font-weight:500">${esc(n.postedAt || "")}</div></div>`;
    }
    html += `</section>`;
  }

  if (online.length) {
    html += `<section class="section"><div class="section-title"><h2>미수강 온라인<span class="count">${online.length}</span></h2></div>`;
    for (const o of online.slice(0, 5)) {
      html += `<div class="row"><div class="row-icon">${codeChip(o.courseTitle || "")}</div><div class="row-main"><div class="row-title">${esc(o.lectureTitle || o.weekLabel || "")}</div><div class="row-sub">${joinMeta([o.courseTitle, o.weekLabel])}</div></div><div class="row-value accent">시청</div></div>`;
    }
    html += `</section>`;
  }

  return html;
}

// ── 과제 리스트 ───────────────────────────────────────

function isAssignmentExpired(a: AssignmentItem): boolean {
  if (a.isExpired === true) return true;
  if (typeof a.statusText === "string" && a.statusText.trim() === "만료됨") return true;
  return false;
}

function renderAssignmentList(data: unknown): string {
  const items: AssignmentItem[] = Array.isArray(data)
    ? (data as AssignmentItem[])
    : ((data as { assignments?: AssignmentItem[]; items?: AssignmentItem[] }).assignments
      || (data as { items?: AssignmentItem[] }).items
      || []);
  if (!items.length) return "";

  let html = `<section class="section"><div class="section-title"><h2>과제<span class="count">${items.length}</span></h2></div>`;
  for (const a of items) {
    const expired = isAssignmentExpired(a);
    const valCls = expired ? "red" : a.priority === "high" ? "red" : "";
    const val = a.dueLabel || a.dueAt || (expired ? "만료" : a.statusText || "");
    html += `<div class="row"><div class="row-icon">${codeChip(a.courseTitle || "")}</div><div class="row-main"><div class="row-title">${esc(a.title || "")}</div><div class="row-sub">${joinMeta([a.courseTitle, a.weekLabel])}</div></div><div class="row-value ${valCls}">${esc(val)}</div></div>`;
  }
  return html + `</section>`;
}

// ── 공지 리스트 (LMS) ──────────────────────────────────

function renderNoticeList(data: unknown): string {
  const items: NoticeItem[] = Array.isArray(data)
    ? (data as NoticeItem[])
    : ((data as { notices?: NoticeItem[]; items?: NoticeItem[] }).notices
      || (data as { items?: NoticeItem[] }).items
      || []);
  if (!items.length) return "";

  let html = `<section class="section"><div class="section-title"><h2>공지<span class="count">${items.length}</span></h2></div>`;
  for (const n of items) {
    html += `<div class="row"><div class="row-icon accent">${codeChip(n.courseTitle || "")}</div><div class="row-main"><div class="row-title">${n.isUnread ? '<span class="dot"></span>' : ""}<span>${esc(n.title || "")}</span></div><div class="row-sub">${esc(n.courseTitle || "")}</div></div><div class="row-value" style="color:var(--ink-3);font-weight:500">${esc(n.postedAt || "")}</div></div>`;
    if (n.previewText) {
      html += `<div class="row" style="padding-top:0;padding-bottom:14px;border-bottom:1px solid var(--rule);display:block"><div class="row-preview" style="grid-column:unset;margin-left:48px">${esc(n.previewText.slice(0, 220))}</div></div>`;
    }
  }
  return html + `</section>`;
}

// ── 학교 공지 ────────────────────────────────────────

const NEWS_SOURCE_LABEL: Record<string, string> = {
  general: "일반공지",
  scholarship: "장학공지",
  event: "행사공지",
  career: "진로공지",
};

function renderNewsList(data: unknown): string {
  const d = data as { items?: Array<{ title: string; url: string; source: string; postedAt?: string; author?: string; publishedAt?: string; sourceName?: string }> };
  if (!d.items?.length) return "";

  let html = `<section class="section"><div class="section-title"><h2>학교 공지<span class="count">${d.items.length}</span></h2></div>`;
  for (const n of d.items) {
    const label = n.sourceName || NEWS_SOURCE_LABEL[n.source] || n.source;
    const dateRaw = n.publishedAt || n.postedAt;
    const dateLabel = dateRaw
      ? new Date(dateRaw).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" })
      : "";
    html += `<div class="row"><div class="row-icon accent">${codeChip(label || "")}</div><div class="row-main"><div class="row-title"><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a></div><div class="row-sub">${joinMeta([label, n.author])}</div></div><div class="row-value" style="color:var(--ink-3);font-weight:500">${esc(dateLabel)}</div></div>`;
  }
  return html + `</section>`;
}

type NoticeDetailAttachment = {
  fileName?: string; downloadUrl?: string; contentType?: string; sizeBytes?: number;
  extraction?: { status?: string; extractorType?: string | null; text?: string | null; charCount?: number | null; error?: string | null } | null;
};
type NoticeDetailImage = {
  imageUrl?: string; altText?: string | null;
  ocr?: { status?: string; text?: string | null; confidence?: number | null; language?: string | null; error?: string | null } | null;
};

function renderNewsDetail(data: unknown): string {
  const d = data as {
    title?: string; source?: string; sourceName?: string; categoryLabel?: string | null;
    author?: string | null; url?: string; publishedAt?: string;
    bodyText?: string | null; attachments?: NoticeDetailAttachment[]; images?: NoticeDetailImage[];
  };

  let html = "";
  const source = d.sourceName || (d.source && NEWS_SOURCE_LABEL[d.source]) || d.source || "";
  const dateLabel = d.publishedAt
    ? new Date(d.publishedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" })
    : "";
  const meta = joinMeta([source, dateLabel, d.author, d.categoryLabel]);

  html += `<section class="section"><div class="section-title"><h2>공지 정보</h2></div>`;
  if (meta) html += `<div class="section-sub">${meta}</div>`;
  if (d.url) html += `<div class="row" style="grid-template-columns:1fr"><div class="row-title"><a href="${esc(d.url)}" target="_blank" rel="noopener" style="color:var(--accent)">원문 페이지 열기 ↗</a></div></div>`;
  html += `</section>`;

  if (d.bodyText && d.bodyText.trim()) {
    html += `<section class="section"><div class="section-title"><h2>본문</h2></div><div class="briefing-body">${esc(d.bodyText).replace(/\n/g, "<br>")}</div></section>`;
  }

  if (d.attachments && d.attachments.length > 0) {
    html += `<section class="section"><div class="section-title"><h2>첨부<span class="count">${d.attachments.length}</span></h2></div>`;
    for (const a of d.attachments) {
      const size = a.sizeBytes != null ? formatBytes(a.sizeBytes) : null;
      const metaLine = joinMeta([a.contentType, size]);
      const name = a.fileName || "파일";
      html += `<div class="row"><div class="row-icon">📎</div><div class="row-main"><div class="row-title">${a.downloadUrl ? `<a href="${esc(a.downloadUrl)}" target="_blank" rel="noopener">${esc(name)}</a>` : esc(name)}</div>${metaLine ? `<div class="row-sub">${metaLine}</div>` : ""}</div><div class="row-value" style="color:var(--ink-3);font-weight:500">↓</div>`;
      const ex = a.extraction;
      if (ex?.status === "succeeded" && ex.text) {
        const preview = ex.text.length > 400 ? ex.text.slice(0, 400) + " …" : ex.text;
        html += `<div class="row-preview">${esc(preview)}</div>`;
      } else if (ex?.status && ex.status !== "pending") {
        const label = { failed: "추출 실패", unsupported: "추출 미지원" }[ex.status] || ex.status;
        html += `<div class="row-preview" style="color:var(--ink-3)">[${esc(label)}]</div>`;
      }
      html += `</div>`;
    }
    html += `</section>`;
  }

  const ocrImages = (d.images || []).filter((im) => im.ocr?.status === "succeeded" && im.ocr.text);
  if (ocrImages.length > 0) {
    html += `<section class="section"><div class="section-title"><h2>본문 이미지 텍스트<span class="count">${ocrImages.length}</span></h2></div>`;
    for (const im of ocrImages) {
      const text = im.ocr?.text ?? "";
      const preview = text.length > 400 ? text.slice(0, 400) + " …" : text;
      html += `<div class="row" style="grid-template-columns:1fr"><div class="row-preview" style="grid-column:unset;margin-left:0">${esc(preview)}</div></div>`;
    }
    html += `</section>`;
  }

  return html || renderGeneric(data);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ── 학식 ──────────────────────────────────────────────

type CafeteriaEntry = {
  sourceId?: string; sourceName?: string; serviceDate?: string; mealType?: string;
  isClosed?: boolean; menuText?: string; menuItems?: unknown; confidence?: number | null; price?: number;
};

const MEAL_LABEL: Record<string, string> = { breakfast: "아침", lunch: "점심", dinner: "저녁" };
const MEAL_CHIP: Record<string, string> = { breakfast: "아침", lunch: "점심", dinner: "저녁" };

function renderCafeteriaMenus(data: unknown): string {
  const d = data as { items?: CafeteriaEntry[] };
  if (!d.items?.length) return "";

  type DayBucket = { date: string; meals: CafeteriaEntry[] };
  const bySource = new Map<string, { name: string; days: Map<string, DayBucket> }>();

  for (const e of d.items) {
    const sid = e.sourceId || "unknown";
    const sname = e.sourceName || sid;
    const date = e.serviceDate || "";
    if (!bySource.has(sid)) bySource.set(sid, { name: sname, days: new Map() });
    const sGroup = bySource.get(sid)!;
    if (!sGroup.days.has(date)) sGroup.days.set(date, { date, meals: [] });
    sGroup.days.get(date)!.meals.push(e);
  }

  const mealOrder = ["breakfast", "lunch", "dinner"];
  let html = "";
  for (const [, sGroup] of bySource) {
    html += `<section class="section"><div class="section-title"><h2>${esc(sGroup.name)}</h2></div>`;
    const sortedDays = Array.from(sGroup.days.values()).sort((a, b) => a.date.localeCompare(b.date));
    const multiDay = sortedDays.length > 1;
    for (const day of sortedDays) {
      if (multiDay) {
        const dl = day.date
          ? new Date(`${day.date}T00:00:00+09:00`).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" })
          : day.date;
        html += `<div class="day-group"><div class="day-group-head"><div class="day-group-label">${esc(dl)}</div></div>`;
      }
      day.meals.sort((a, b) => mealOrder.indexOf(a.mealType || "") - mealOrder.indexOf(b.mealType || ""));
      for (const m of day.meals) {
        const mealLabel = MEAL_LABEL[m.mealType || ""] || m.mealType || "";
        const chip = MEAL_CHIP[m.mealType || ""] || "";
        if (m.isClosed) {
          html += `<div class="row"><div class="row-icon">${esc(chip)}</div><div class="row-main"><div class="row-title">${esc(mealLabel)}</div><div class="row-sub">휴무</div></div><div class="row-value" style="color:var(--ink-3);font-weight:500"><span class="badge badge-gray">휴무</span></div></div>`;
          continue;
        }
        let items: string[] = [];
        if (Array.isArray(m.menuItems)) {
          items = (m.menuItems as unknown[]).map((x) => String(x)).filter((s) => s.trim());
        } else if (m.menuText) {
          items = m.menuText.split(/\n+/).map((s) => s.trim()).filter(Boolean);
        }
        const priceLabel = m.price ? `${m.price.toLocaleString("ko-KR")}원` : "";
        html += `<div class="row"><div class="row-icon accent">${esc(chip)}</div><div class="row-main"><div class="row-title">${esc(mealLabel)}</div><div class="row-sub">${items.map((x) => esc(x)).join(" · ")}</div></div><div class="row-value">${esc(priceLabel)}</div></div>`;
      }
      if (multiDay) html += `</div>`;
    }
    html += `</section>`;
  }
  return html;
}

// ── 출석 ──────────────────────────────────────────────

function renderAttendanceText(data: unknown): string {
  if (typeof data === "string") {
    return `<section class="section"><div class="section-title"><h2>출석</h2></div><div class="briefing-body">${esc(data)}</div></section>`;
  }
  const d = data as {
    course?: { courseTitle?: string; professor?: string; scheduleSummary?: string };
    summary?: { attendedCount?: number; tardyCount?: number; earlyLeaveCount?: number; absentCount?: number };
    totalSessions?: number; completedSessions?: number;
    sessions?: Array<{
      week?: number; classNo?: number; sessionLabel?: string;
      date?: string; dateLabel?: string; timeRange?: string; classroom?: string;
      isPast?: boolean; statusLabel?: string; attendAt?: string;
    }>;
  };

  let html = "";

  // Hero rate
  if (d.summary && d.completedSessions) {
    const rate = Math.round(((d.summary.attendedCount ?? 0) / d.completedSessions) * 100);
    html += `<section class="section"><div class="metric-hero"><div class="metric-label">출석률</div><div class="metric-value">${rate}<span class="unit">%</span></div><div class="metric-trend"><span class="up">출석 ${d.summary.attendedCount ?? 0}</span> · 지각 ${d.summary.tardyCount ?? 0} · 결석 ${d.summary.absentCount ?? 0}</div></div></section>`;
  }

  // Dot grid
  if (d.sessions && d.totalSessions) {
    html += `<section class="section"><div class="section-title"><h2>출결 현황</h2></div><div class="dot-grid">`;
    const statusByIdx = new Map<number, string>();
    const past = d.sessions.filter((s) => s.isPast).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    past.forEach((s, i) => statusByIdx.set(i, s.statusLabel || "출석"));
    for (let i = 0; i < d.totalSessions; i++) {
      const st = statusByIdx.get(i);
      let cls = "";
      if (st === "출석") cls = "present";
      else if (st === "지각" || st === "조퇴") cls = "tardy";
      else if (st === "결석") cls = "absent";
      html += `<div class="dot-cell ${cls}"></div>`;
    }
    html += `</div><div class="dot-legend">`;
    html += `<div class="dot-legend-item"><span class="dot-legend-sq" style="background:var(--accent)"></span>출석</div>`;
    html += `<div class="dot-legend-item"><span class="dot-legend-sq" style="background:var(--warn)"></span>지각</div>`;
    html += `<div class="dot-legend-item"><span class="dot-legend-sq" style="background:var(--red)"></span>결석</div>`;
    html += `<div class="dot-legend-item"><span class="dot-legend-sq" style="background:var(--chip-bg)"></span>예정</div>`;
    html += `</div></section>`;
  }

  // Recent sessions
  if (d.sessions && d.sessions.length > 0) {
    const past = d.sessions.filter((s) => s.isPast).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (past.length > 0) {
      html += `<section class="section"><div class="section-title"><h2>최근 출결</h2></div>`;
      for (const s of past) {
        const st = s.statusLabel || "-";
        let iconCls = "green"; let valCls = "green";
        if (st === "결석") { iconCls = "red"; valCls = "red"; }
        else if (st === "지각" || st === "조퇴") { iconCls = "warn"; valCls = "warn"; }
        const icon = st === "결석" ? "✕" : st === "지각" || st === "조퇴" ? "!" : "✓";
        html += `<div class="row"><div class="row-icon ${iconCls}">${icon}</div><div class="row-main"><div class="row-title">${esc(s.sessionLabel || "")}</div><div class="row-sub">${joinMeta([s.dateLabel || s.date, s.attendAt])}</div></div><div class="row-value ${valCls}">${esc(st)}</div></div>`;
      }
      html += `</section>`;
    }
  }

  return html || renderGeneric(data);
}

// ── 기본 (JSON) ───────────────────────────────────────

function renderGeneric(data: unknown): string {
  const json = JSON.stringify(data, null, 2);
  return `<section class="section"><div class="section-title"><h2>원본 데이터</h2></div><pre class="raw-json">${esc(json)}</pre></section>`;
}

function renderMarkdown(markdown: string): string {
  const rendered = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(rendered);
}

function generateFallbackSummary(dataType: string, rawData: unknown): string {
  if (!rawData || typeof rawData !== "object") {
    return "_에이전트 요약이 아직 도착하지 않았어요. 아래 데이터를 참고해주세요._";
  }
  const d = rawData as Record<string, unknown>;
  const pickItems = (...keys: string[]): unknown[] => {
    for (const k of keys) { const v = d[k]; if (Array.isArray(v)) return v; }
    return [];
  };
  const countLine = (label: string, items: unknown[]): string => items.length ? `- **${label}**: ${items.length}건` : "";

  switch (dataType) {
    case "unsubmitted":
    case "due-assignments": {
      const items = pickItems("assignments", "items");
      if (!items.length) return "_미제출·마감 임박 과제가 없습니다._";
      const expired = (items as AssignmentItem[]).filter(isAssignmentExpired).length;
      const pending = items.length - expired;
      return [`총 **${items.length}건**의 과제가 있어요.`,
        pending ? `- 진행중: ${pending}건` : "",
        expired ? `- 만료: ${expired}건` : "",
        "", "아래 목록에서 자세한 내용을 확인하세요."].filter(Boolean).join("\n");
    }
    case "unread-notices": {
      const items = pickItems("notices", "items");
      if (!items.length) return "_안 읽은 공지가 없습니다._";
      return `안 읽은 공지 **${items.length}건**이 있어요.`;
    }
    case "action-items": {
      const unsub = pickItems("unsubmittedAssignments");
      const due = pickItems("dueAssignments");
      const notices = pickItems("unreadNotices");
      const online = pickItems("incompleteOnlineWeeks");
      const lines = [countLine("미제출 과제", unsub), countLine("마감 임박", due), countLine("안 읽은 공지", notices), countLine("미수강 온라인", online)].filter(Boolean);
      if (!lines.length) return "_지금 해야 할 일이 없어요. 훌륭해요._";
      return ["**지금 해야 할 일**", "", ...lines].join("\n");
    }
    case "timetable": {
      const entries = pickItems("entries");
      if (!entries.length) return "_등록된 시간표가 없습니다._";
      return `이번 학기 **${entries.length}개 수업**이 등록되어 있어요.`;
    }
    case "courses": {
      const items = pickItems("courses", "items");
      if (!items.length) return "_수강 과목이 없습니다._";
      return `총 **${items.length}개 과목**을 수강 중입니다.`;
    }
    case "grades": {
      const items = pickItems("items", "grades");
      const gpa = (d as { gpa?: number }).gpa;
      if (!items.length) return "_성적 정보가 없습니다._";
      return gpa != null ? `**${items.length}개 과목** · GPA **${gpa.toFixed(2)}**` : `**${items.length}개 과목**의 성적이 있습니다.`;
    }
    case "grade-history": {
      const terms = pickItems("termRecords");
      const overview = (d as { overview?: Record<string, string> }).overview ?? {};
      const totalGpa = overview["전체평점"] || overview["누적평점"] || overview["평점"];
      if (!terms.length) return "_성적 이력이 없습니다._";
      return totalGpa
        ? `**${terms.length}개 학기** · 누적 평점 **${totalGpa}**`
        : `**${terms.length}개 학기**의 성적 이력이 있습니다.`;
    }
    case "graduation": {
      const gaps = pickItems("creditGaps");
      if (!gaps.length) return "_졸업요건 정보가 없습니다._";
      const shortages = (gaps as Array<{ gap?: number }>).filter((g) => (g.gap ?? 0) > 0).length;
      return shortages ? `졸업요건 중 **${shortages}개 영역**이 부족합니다.` : `**모든 졸업요건을 충족**했습니다.`;
    }
    case "attendance": {
      const course = (d.course as { courseTitle?: string } | undefined)?.courseTitle;
      const s = d.summary as { attendedCount?: number; absentCount?: number } | undefined;
      if (!s) return "_출석 정보를 가져오지 못했습니다._";
      return [course ? `**${course}** 출석 현황` : "**출석 현황**", "", `- 출석: ${s.attendedCount ?? 0}회`, `- 결석: ${s.absentCount ?? 0}회`].join("\n");
    }
    case "news": {
      const items = pickItems("items");
      if (!items.length) return "_새 공지가 없습니다._";
      return `새 학교 공지 **${items.length}건**이 있어요.`;
    }
    default:
      return "_에이전트 요약이 아직 도착하지 않았어요. 아래 데이터를 참고해주세요._";
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function joinMeta(parts: Array<string | number | null | undefined>, sep = " · "): string {
  return parts
    .filter((x): x is string | number => x !== null && x !== undefined && x !== "")
    .map((x) => esc(String(x)))
    .join(sep);
}
