import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";
import type { ViewEntry } from "./types";

/**
 * mjuclaw 웹뷰 렌더러.
 *
 * 디자인 원칙은 `.impeccable.md` 참고. 요점:
 *   - 명지대 공식 블루(Pantone 2768 C · 300 C)를 메인 팔레트로
 *   - warm neutrals, Pretendard 한글 본문 + serif display accent
 *   - 카드 반복이 아니라 kicker-headline-body 타이포 위계 + hairline divider
 *   - 모바일 우선, system-following dark/light
 *   - 마스코트 로고는 히어로 한 곳에만 (없으면 wordmark fallback)
 */

// ── dataType → 섹션 kicker / 히어로 카테고리 라벨 ─────────────────
const DATA_TYPE_META: Record<string, { kicker: string; detail: string }> = {
  timetable: { kicker: "TIMETABLE", detail: "시간표" },
  grades: { kicker: "GRADES", detail: "성적" },
  graduation: { kicker: "GRADUATION", detail: "졸업요건" },
  courses: { kicker: "COURSES", detail: "수강과목" },
  "action-items": { kicker: "ACTION ITEMS", detail: "지금 할 일" },
  unsubmitted: { kicker: "ASSIGNMENTS", detail: "미제출 과제" },
  "due-assignments": { kicker: "DUE SOON", detail: "마감 임박 과제" },
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
<meta name="theme-color" content="#f6f4ee" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E1730" media="(prefers-color-scheme: dark)">
<title>${esc(entry.title)} · 묭묭이</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
${pageStyles()}
</head>
<body>
<main class="page">
  <header class="hero">
    <div class="hero-mark" aria-hidden="true">${logoMark()}</div>
    <div class="hero-copy">
      <div class="kicker">
        <span class="kicker-latin">${esc(meta.kicker)}</span>
        <span class="kicker-dot" aria-hidden="true"></span>
        <span class="kicker-ko">${esc(meta.detail)}</span>
      </div>
      <h1 class="display">${esc(entry.title)}</h1>
      <p class="hero-meta">
        <time datetime="${esc(created.toISOString())}">${esc(time)}</time>
        <span class="divider-dot" aria-hidden="true">·</span>
        <span>30분 후 만료</span>
      </p>
    </div>
  </header>

  <section class="summary" aria-label="AI 요약">
    <div class="summary-label">AI 요약</div>
    <div class="summary-body">${aiSummaryHtml}</div>
  </section>

  ${dataHtml}

  <footer class="footer">
    <span class="footer-brand">묭묭이 · 명지대 학사 도우미</span>
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
<meta name="theme-color" content="#f6f4ee" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E1730" media="(prefers-color-scheme: dark)">
<title>만료 · 묭묭이</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
${pageStyles()}
</head>
<body>
<main class="page page-center">
  <div class="expired">
    <div class="expired-mark" aria-hidden="true">${logoMark()}</div>
    <div class="kicker"><span class="kicker-latin">EXPIRED</span><span class="kicker-dot" aria-hidden="true"></span><span class="kicker-ko">만료된 링크</span></div>
    <h1 class="display">이 링크의 유효 시간이 지났어요</h1>
    <p class="expired-body">이 웹뷰는 조회 시점부터 30분간만 열람할 수 있어요.<br>Discord에서 묭묭이에게 다시 물어보면 새 링크를 보내드려요.</p>
  </div>
</main>
</body>
</html>`;
}

// ── 로고 마크 ───────────────────────────────────────────────────
// 캐릭터 로고 `public/myongmyong.png`가 view-server `/static/`로 서빙됨.
// 이미지 로드 실패 시 브라우저 기본 alt 표시, JS 없이 순수 HTML로.
function logoMark(): string {
  return `<img src="/static/myongmyong.png" alt="묭묭이" width="56" height="56" decoding="async" loading="eager">`;
}

// ── CSS ─────────────────────────────────────────────────────────
function pageStyles(): string {
  return `<style>
:root {
  /* 명지대 블루 (Pantone 2768 C / 300 C) */
  --mj-ink: #1A2E5C;
  --mj-blue: #005EB8;

  /* Light 기본 */
  --bg: #F6F4EE;
  --bg-sub: #FFFDF7;
  --surface: #FFFFFF;
  --ink: var(--mj-ink);
  --ink-2: #3F4C70;
  --ink-3: #6A738F;
  --ink-4: #8E95AE;
  --rule: rgba(26, 46, 92, 0.14);
  --rule-strong: rgba(26, 46, 92, 0.26);
  --accent: var(--mj-blue);
  --accent-soft: rgba(0, 94, 184, 0.10);
  --danger: #B11D1D;
  --danger-soft: rgba(177, 29, 29, 0.10);
  --warn: #8B6914;
  --warn-soft: rgba(139, 105, 20, 0.14);
  --success: #236B3A;
  --success-soft: rgba(35, 107, 58, 0.12);
  --muted-chip-bg: rgba(26, 46, 92, 0.07);
  --muted-chip-fg: var(--ink-2);

  --grain: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1  0 0 0 0 0.18  0 0 0 0 0.36  0 0 0 0.055 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;

  --shadow-soft: 0 1px 0 rgba(26, 46, 92, 0.04), 0 12px 32px -24px rgba(26, 46, 92, 0.35);

  --font-sans: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', system-ui, sans-serif;
  --font-serif: 'Iowan Old Style', 'Apple Garamond', Garamond, 'Times New Roman', Georgia, serif;
  --font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0E1730;
    --bg-sub: #121E3C;
    --surface: #152349;
    --ink: #ECE7D5;
    --ink-2: #C8CFE2;
    --ink-3: #9AA3BC;
    --ink-4: #6E7794;
    --rule: rgba(236, 231, 213, 0.14);
    --rule-strong: rgba(236, 231, 213, 0.26);
    --accent: #7FB1E6;
    --accent-soft: rgba(127, 177, 230, 0.16);
    --danger: #F39292;
    --danger-soft: rgba(243, 146, 146, 0.16);
    --warn: #E8C575;
    --warn-soft: rgba(232, 197, 117, 0.14);
    --success: #8BD6A5;
    --success-soft: rgba(139, 214, 165, 0.14);
    --muted-chip-bg: rgba(236, 231, 213, 0.08);
    --muted-chip-fg: var(--ink-2);
    --shadow-soft: 0 1px 0 rgba(0, 0, 0, 0.2), 0 12px 32px -20px rgba(0, 0, 0, 0.55);
    --grain: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.78  0 0 0 0.04 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
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
  font-size: 15.5px;
  line-height: 1.55;
  letter-spacing: -0.005em;
  min-height: 100vh;
  min-height: 100dvh;
  background-image: var(--grain);
  background-size: 160px 160px;
  background-attachment: fixed;
  padding: clamp(20px, 5vw, 40px) clamp(16px, 5vw, 28px) clamp(40px, 8vw, 80px);
}

.page {
  max-width: 620px;
  margin: 0 auto;
  position: relative;
}

.page-center {
  min-height: 80vh;
  min-height: 80dvh;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Kicker (카테고리 + 한글 라벨) ─────────────────────── */
.kicker {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-3);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  margin-bottom: 14px;
}
.kicker-latin { color: var(--mj-blue); }
@media (prefers-color-scheme: dark) { .kicker-latin { color: var(--accent); } }
.kicker-ko { color: var(--ink-3); letter-spacing: 0.02em; font-weight: 500; }
.kicker-dot {
  width: 4px; height: 4px; border-radius: 999px;
  background: var(--rule-strong);
  display: inline-block;
}

/* ── Hero ────────────────────────────────────────────────── */
.hero {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: clamp(16px, 4vw, 24px);
  align-items: start;
  padding-bottom: clamp(28px, 6vw, 44px);
  margin-bottom: clamp(28px, 6vw, 44px);
  border-bottom: 1px solid var(--rule);
}
.hero-mark {
  color: var(--ink);
  width: 56px;
  height: 56px;
  flex: 0 0 56px;
}
.hero-mark svg { width: 100%; height: 100%; display: block; }
.hero-copy { min-width: 0; }
.display {
  font-family: var(--font-serif);
  font-weight: 500;
  color: var(--ink);
  font-size: clamp(26px, 6.4vw, 38px);
  line-height: 1.15;
  letter-spacing: -0.01em;
  margin-bottom: 14px;
  word-break: keep-all;
  text-wrap: balance;
}
.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 12.5px;
  color: var(--ink-4);
  font-variant-numeric: tabular-nums;
}
.divider-dot { color: var(--rule-strong); }

/* ── AI 요약 (pull quote 스타일) ────────────────────────── */
.summary {
  position: relative;
  padding: clamp(16px, 4vw, 22px) 0 clamp(18px, 4vw, 24px) clamp(18px, 4vw, 22px);
  border-left: 2px solid var(--mj-blue);
  margin-bottom: clamp(32px, 7vw, 48px);
}
.summary-label {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--mj-blue);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: 10px;
}
@media (prefers-color-scheme: dark) {
  .summary { border-left-color: var(--accent); }
  .summary-label { color: var(--accent); }
}
.summary-body {
  font-size: 16px;
  line-height: 1.7;
  color: var(--ink-2);
  word-break: keep-all;
}
.summary-body p { margin-bottom: 8px; }
.summary-body p:last-child { margin-bottom: 0; }
.summary-body strong { color: var(--ink); font-weight: 600; }
.summary-body em { color: var(--ink-3); font-style: italic; }
.summary-body ul, .summary-body ol { padding-left: 20px; margin: 8px 0; }
.summary-body li { margin-bottom: 4px; }
.summary-body li::marker { color: var(--ink-4); }
.summary-body h1, .summary-body h2, .summary-body h3 {
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  margin: 14px 0 6px;
}
.summary-body hr { border: none; border-top: 1px solid var(--rule); margin: 12px 0; }
.summary-body code {
  font-family: var(--font-mono);
  font-size: 0.88em;
  background: var(--muted-chip-bg);
  color: var(--ink);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}

/* ── 섹션 (카드 아님 — hairline 위계) ───────────────────── */
.card {
  padding: clamp(22px, 5vw, 28px) 0;
  border-top: 1px solid var(--rule);
}
.card:first-of-type { border-top: none; padding-top: 0; }
.card-title {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--ink-3);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  margin-bottom: 16px;
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.card-title::before {
  content: '';
  width: 20px; height: 1px;
  background: var(--mj-blue);
  display: inline-block;
  flex: 0 0 20px;
  transform: translateY(-3px);
}
@media (prefers-color-scheme: dark) {
  .card-title::before { background: var(--accent); }
}

/* ── 아이템 리스트 ────────────────────────────────────── */
.item {
  padding: 14px 0;
  border-bottom: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.item:last-child { border-bottom: none; }
.item-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--ink);
  line-height: 1.45;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
  word-break: keep-all;
}
.item-title a {
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid var(--rule);
  transition: border-color 160ms ease-out;
}
.item-title a:hover { border-color: var(--mj-blue); }
.item-sub {
  font-size: 12.5px;
  color: var(--ink-3);
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  word-break: keep-all;
}
.item-sub + .item-sub { margin-top: 2px; }
.item-preview {
  font-size: 13px;
  color: var(--ink-3);
  line-height: 1.55;
  margin-top: 6px;
  padding-left: 12px;
  border-left: 2px solid var(--rule);
  word-break: keep-all;
}

/* ── 배지 (chip with dot) ─────────────────────────────── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px 3px 8px;
  border-radius: 999px;
  letter-spacing: 0.01em;
  line-height: 1.5;
}
.badge::before {
  content: '';
  width: 6px; height: 6px;
  border-radius: 999px;
  background: currentColor;
  display: inline-block;
  opacity: 0.85;
}
.badge-red { color: var(--danger); background: var(--danger-soft); }
.badge-yellow { color: var(--warn); background: var(--warn-soft); }
.badge-green { color: var(--success); background: var(--success-soft); }
.badge-blue { color: var(--mj-blue); background: var(--accent-soft); }
@media (prefers-color-scheme: dark) {
  .badge-blue { color: var(--accent); }
}
.badge-gray { color: var(--muted-chip-fg); background: var(--muted-chip-bg); }
.badge-gray::before { opacity: 0.45; }

/* ── 요일 그룹 (시간표) ───────────────────────────────── */
.day-group { margin-bottom: 18px; }
.day-group:last-child { margin-bottom: 0; }
.day-label {
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 500;
  color: var(--mj-blue);
  letter-spacing: -0.005em;
  margin-bottom: 6px;
}
@media (prefers-color-scheme: dark) {
  .day-label { color: var(--accent); }
}

/* ── 진행 바 (졸업요건) ──────────────────────────────── */
.progress-wrap {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
  margin-top: 8px;
}
.progress-bar {
  height: 4px;
  background: var(--rule);
  border-radius: 999px;
  overflow: hidden;
  position: relative;
}
.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 520ms cubic-bezier(0.22, 1, 0.36, 1);
}
.progress-text {
  font-size: 12.5px;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  white-space: nowrap;
}

/* ── 테이블 (성적, 출석 세션) ─────────────────────────── */
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
  font-variant-numeric: tabular-nums;
}
th {
  text-align: left;
  font-weight: 600;
  color: var(--ink-4);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 8px 10px 10px;
  border-bottom: 1px solid var(--rule-strong);
}
td {
  padding: 11px 10px;
  color: var(--ink-2);
  border-bottom: 1px solid var(--rule);
  vertical-align: middle;
}
tr:last-child td { border-bottom: none; }
td:first-child, th:first-child { padding-left: 0; }
td:last-child, th:last-child { padding-right: 0; }

/* ── 배지 그룹 (출석 요약) ────────────────────────────── */
.badge-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* ── 원본 JSON fallback ─────────────────────────────── */
.raw-json {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.55;
  color: var(--ink-2);
  background: var(--muted-chip-bg);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ── Footer ────────────────────────────────────────── */
.footer {
  margin-top: clamp(40px, 8vw, 64px);
  padding-top: 20px;
  border-top: 1px solid var(--rule);
  text-align: center;
}
.footer-brand {
  font-family: var(--font-serif);
  font-size: 13px;
  color: var(--ink-4);
  letter-spacing: 0.02em;
  font-style: italic;
}

/* ── 만료 페이지 ───────────────────────────────────── */
.expired {
  text-align: left;
  max-width: 380px;
}
.expired-mark {
  color: var(--ink);
  width: 48px; height: 48px;
  margin-bottom: 24px;
  opacity: 0.7;
}
.expired-mark svg { width: 100%; height: 100%; display: block; }
.expired .display {
  font-size: clamp(24px, 5.5vw, 32px);
  margin-bottom: 12px;
}
.expired-body {
  font-size: 15px;
  line-height: 1.7;
  color: var(--ink-3);
  word-break: keep-all;
}

/* ── 접근성 / 모션 감소 ───────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .progress-fill { transition: none; }
  .item-title a { transition: none; }
}

::selection { background: var(--accent-soft); color: var(--ink); }
</style>`;
}

// ── dataType별 렌더러 ───────────────────────────────────────────

function renderData(dataType: string, data: unknown): string {
  if (!data) return "";
  const renderers: Record<string, (d: unknown) => string> = {
    timetable: renderTimetable,
    grades: renderGrades,
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

// ── 공통 타입 ───────────────────────────────────────────────────

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
};

type NoticeItem = {
  title?: string;
  courseTitle?: string;
  postedAt?: string;
  previewText?: string;
  viewCount?: number;
  isUnread?: boolean;
};

// ── 시간표 ──────────────────────────────────────────────────────

function renderTimetable(data: unknown): string {
  const d = data as { entries?: Array<{ dayOfWeek: number; dayLabel?: string; courseTitle: string; location?: string; timeRange?: string; professor?: string }> };
  if (!d.entries?.length) return "";

  const days = ["월", "화", "수", "목", "금"];
  const byDay = new Map<string, typeof d.entries>();
  for (const e of d.entries) {
    const day = e.dayLabel || days[e.dayOfWeek - 1] || "?";
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(e);
  }

  let html = `<section class="card"><div class="card-title">주간 시간표</div>`;
  for (const day of days) {
    const entries = byDay.get(day);
    if (!entries) continue;
    entries.sort((a, b) => (a.timeRange || "").localeCompare(b.timeRange || ""));
    html += `<div class="day-group"><div class="day-label">${day}요일</div>`;
    for (const e of entries) {
      const meta = joinMeta([e.timeRange, e.location, e.professor]);
      html += `<div class="item"><div class="item-title">${esc(e.courseTitle)}</div><div class="item-sub">${meta}</div></div>`;
    }
    html += `</div>`;
  }
  return html + `</section>`;
}

// ── 성적 ────────────────────────────────────────────────────────

function renderGrades(data: unknown): string {
  const d = data as { items?: Array<{ courseTitle: string; credits?: number; grade?: string; statusMessage?: string }> };
  if (!d.items?.length) return "";

  let html = `<section class="card"><div class="card-title">성적 상세</div><table><thead><tr><th>과목</th><th>학점</th><th>성적</th></tr></thead><tbody>`;
  for (const item of d.items) {
    const grade = item.grade || item.statusMessage || "-";
    html += `<tr><td>${esc(item.courseTitle)}</td><td>${item.credits ?? "-"}</td><td>${esc(grade)}</td></tr>`;
  }
  return html + `</tbody></table></section>`;
}

// ── 졸업요건 ────────────────────────────────────────────────────

function renderGraduation(data: unknown): string {
  const d = data as { creditGaps?: Array<{ label: string; earned?: number; required?: number; gap?: number }> };
  if (!d.creditGaps?.length) return "";

  let html = `<section class="card"><div class="card-title">졸업요건 상세</div>`;
  for (const g of d.creditGaps) {
    const earned = g.earned ?? 0;
    const required = g.required ?? 1;
    const pct = Math.min(100, Math.round((earned / required) * 100));
    const isShort = (g.gap ?? 0) > 0;
    const badgeCls = isShort ? "badge-red" : "badge-green";
    const badgeText = isShort ? `부족 ${g.gap}학점` : "충족";
    const fillColor = isShort ? "var(--danger)" : "var(--success)";
    html += `<div class="item">
      <div class="item-title">${esc(g.label)} <span class="badge ${badgeCls}">${esc(badgeText)}</span></div>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${fillColor}"></div></div>
        <div class="progress-text">${earned} / ${required}</div>
      </div>
    </div>`;
  }
  return html + `</section>`;
}

// ── 수강과목 ────────────────────────────────────────────────────

function renderCourses(data: unknown): string {
  const d = data as { courses?: Array<{ title: string; professor?: string; code?: string }> };
  if (!d.courses?.length) return "";

  let html = `<section class="card"><div class="card-title">수강과목 · ${d.courses.length}개</div>`;
  for (const c of d.courses) {
    const meta = joinMeta([c.professor, c.code]);
    html += `<div class="item"><div class="item-title">${esc(c.title)}</div>${meta ? `<div class="item-sub">${meta}</div>` : ""}</div>`;
  }
  return html + `</section>`;
}

// ── 할 일 목록 ──────────────────────────────────────────────────

function renderActionItems(data: unknown): string {
  const d = data as Record<string, unknown>;
  let html = "";

  const unsub = d.unsubmittedAssignments as AssignmentItem[] | undefined;
  if (unsub?.length) {
    html += `<section class="card"><div class="card-title">미제출 과제 · ${unsub.length}건</div>`;
    for (const a of unsub) {
      const expired = isAssignmentExpired(a);
      const badgeCls = expired ? "badge-red" : "badge-yellow";
      const badgeText = expired ? "만료" : "진행중";
      const rawDue = a.dueLabel || a.dueAt || (a.statusText !== "만료됨" ? a.statusText : "") || "";
      const sub = joinMeta([a.courseTitle, a.weekLabel, rawDue]);
      html += `<div class="item"><div class="item-title">${esc(a.title || "")} <span class="badge ${badgeCls}">${badgeText}</span></div>${sub ? `<div class="item-sub">${sub}</div>` : ""}</div>`;
    }
    html += `</section>`;
  }

  const due = d.dueAssignments as AssignmentItem[] | undefined;
  if (due?.length) {
    html += `<section class="card"><div class="card-title">마감 임박 · ${due.length}건</div>`;
    for (const a of due) {
      const dueLabel = a.dueLabel || a.dueAt || a.statusText || "";
      const sub = joinMeta([a.courseTitle, a.weekLabel, dueLabel]);
      html += `<div class="item"><div class="item-title">${esc(a.title || "")}</div>${sub ? `<div class="item-sub">${sub}</div>` : ""}</div>`;
    }
    html += `</section>`;
  }

  const notices = d.unreadNotices as NoticeItem[] | undefined;
  if (notices?.length) {
    html += `<section class="card"><div class="card-title">안 읽은 공지 · ${notices.length}건</div>`;
    for (const n of notices) {
      const sub = joinMeta([n.courseTitle, n.postedAt]);
      html += `<div class="item"><div class="item-title">${esc(n.title || "")}</div>${sub ? `<div class="item-sub">${sub}</div>` : ""}</div>`;
    }
    html += `</section>`;
  }

  const online = d.incompleteOnlineWeeks as Array<{ courseTitle?: string; weekLabel?: string; lectureTitle?: string }> | undefined;
  if (online?.length) {
    html += `<section class="card"><div class="card-title">미수강 온라인 · ${online.length}건</div>`;
    for (const o of online) {
      const sub = joinMeta([o.courseTitle, o.weekLabel]);
      html += `<div class="item"><div class="item-title">${esc(o.lectureTitle || o.weekLabel || "")}</div>${sub ? `<div class="item-sub">${sub}</div>` : ""}</div>`;
    }
    html += `</section>`;
  }

  return html;
}

// ── 과제 리스트 ─────────────────────────────────────────────────

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

  let html = `<section class="card"><div class="card-title">과제 상세 · ${items.length}건</div>`;
  for (const a of items) {
    const expired = isAssignmentExpired(a);
    const badgeCls = expired ? "badge-red" : "badge-yellow";
    const badgeText = expired ? "만료" : "진행중";
    const rawDue = a.dueLabel || a.dueAt || (a.statusText !== "만료됨" ? a.statusText : "") || "";
    const sub = joinMeta([a.courseTitle, a.weekLabel, rawDue]);
    html += `<div class="item"><div class="item-title">${esc(a.title || "")} <span class="badge ${badgeCls}">${badgeText}</span></div>${sub ? `<div class="item-sub">${sub}</div>` : ""}</div>`;
  }
  return html + `</section>`;
}

// ── 공지 리스트 (LMS) ──────────────────────────────────────────

function renderNoticeList(data: unknown): string {
  const items: NoticeItem[] = Array.isArray(data)
    ? (data as NoticeItem[])
    : ((data as { notices?: NoticeItem[]; items?: NoticeItem[] }).notices
        || (data as { items?: NoticeItem[] }).items
        || []);
  if (!items.length) return "";

  let html = `<section class="card"><div class="card-title">공지 상세 · ${items.length}건</div>`;
  for (const n of items) {
    const sub = joinMeta([n.courseTitle, n.postedAt]);
    html += `<div class="item"><div class="item-title">${esc(n.title || "")}</div>${sub ? `<div class="item-sub">${sub}</div>` : ""}`;
    if (n.previewText) {
      html += `<div class="item-preview">${esc(n.previewText.slice(0, 220))}</div>`;
    }
    html += `</div>`;
  }
  return html + `</section>`;
}

// ── 학교 공지 (mju-news) ────────────────────────────────────────

const NEWS_SOURCE_LABEL: Record<string, string> = {
  general: "일반공지",
  scholarship: "장학공지",
  event: "행사공지",
  career: "진로/취업공지",
};

function renderNewsList(data: unknown): string {
  const d = data as { items?: Array<{ title: string; url: string; source: string; postedAt?: string; author?: string; publishedAt?: string; sourceName?: string }> };
  if (!d.items?.length) return "";

  let html = `<section class="card"><div class="card-title">학교 공지 · ${d.items.length}건</div>`;
  for (const n of d.items) {
    const label = n.sourceName || NEWS_SOURCE_LABEL[n.source] || n.source;
    const dateRaw = n.publishedAt || n.postedAt;
    const dateLabel = dateRaw
      ? new Date(dateRaw).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" })
      : "";
    const meta = joinMeta([label, dateLabel, n.author]);
    html += `<div class="item"><div class="item-title"><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a></div>${meta ? `<div class="item-sub">${meta}</div>` : ""}</div>`;
  }
  return html + `</section>`;
}

// ── 학교 공지 상세 (mju-news notices get) ──────────────────────
type NoticeDetailAttachment = {
  fileName?: string;
  downloadUrl?: string;
  contentType?: string;
  sizeBytes?: number;
  extraction?: { status?: string; extractorType?: string | null; text?: string | null; charCount?: number | null; error?: string | null } | null;
};
type NoticeDetailImage = {
  imageUrl?: string;
  altText?: string | null;
  ocr?: { status?: string; text?: string | null; confidence?: number | null; language?: string | null; error?: string | null } | null;
};

function renderNewsDetail(data: unknown): string {
  const d = data as {
    title?: string;
    source?: string;
    sourceName?: string;
    categoryLabel?: string | null;
    author?: string | null;
    url?: string;
    publishedAt?: string;
    bodyText?: string | null;
    attachments?: NoticeDetailAttachment[];
    images?: NoticeDetailImage[];
  };

  let html = "";

  const source = d.sourceName || (d.source && NEWS_SOURCE_LABEL[d.source]) || d.source || "";
  const dateLabel = d.publishedAt
    ? new Date(d.publishedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" })
    : "";
  const meta = joinMeta([source, dateLabel, d.author, d.categoryLabel]);

  html += `<section class="card"><div class="card-title">공지 정보</div>`;
  if (meta) html += `<div class="item-sub">${meta}</div>`;
  if (d.url) html += `<div class="item-sub" style="margin-top:6px;"><a href="${esc(d.url)}" target="_blank" rel="noopener" style="color:var(--mj-blue);text-decoration:none;border-bottom:1px solid var(--rule);">원문 페이지 열기 ↗</a></div>`;
  html += `</section>`;

  if (d.bodyText && d.bodyText.trim()) {
    html += `<section class="card"><div class="card-title">본문</div><div class="summary-body">${esc(d.bodyText).replace(/\n/g, "<br>")}</div></section>`;
  }

  if (d.attachments && d.attachments.length > 0) {
    html += `<section class="card"><div class="card-title">첨부 · ${d.attachments.length}건</div>`;
    for (const a of d.attachments) {
      const size = a.sizeBytes != null ? formatBytes(a.sizeBytes) : null;
      const metaLine = joinMeta([a.contentType, size]);
      html += `<div class="item"><div class="item-title">${a.downloadUrl ? `<a href="${esc(a.downloadUrl)}" target="_blank" rel="noopener">${esc(a.fileName || "파일")}</a>` : esc(a.fileName || "파일")}</div>`;
      if (metaLine) html += `<div class="item-sub">${metaLine}</div>`;
      const ex = a.extraction;
      if (ex?.status === "succeeded" && ex.text) {
        const preview = ex.text.length > 400 ? ex.text.slice(0, 400) + " …" : ex.text;
        html += `<div class="item-preview">${esc(preview)}</div>`;
      } else if (ex?.status && ex.status !== "pending") {
        const label = { failed: "추출 실패", unsupported: "추출 미지원" }[ex.status] || ex.status;
        html += `<div class="item-sub" style="color:var(--ink-4);">[${esc(label)}]</div>`;
      }
      html += `</div>`;
    }
    html += `</section>`;
  }

  const ocrImages = (d.images || []).filter((im) => im.ocr?.status === "succeeded" && im.ocr.text);
  if (ocrImages.length > 0) {
    html += `<section class="card"><div class="card-title">본문 이미지 텍스트 · ${ocrImages.length}건</div>`;
    for (const im of ocrImages) {
      const text = im.ocr?.text ?? "";
      const preview = text.length > 400 ? text.slice(0, 400) + " …" : text;
      html += `<div class="item"><div class="item-preview">${esc(preview)}</div></div>`;
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

// ── 학식 (cafeteria_menu_entries) ──────────────────────────────
type CafeteriaEntry = {
  sourceId?: string;
  sourceName?: string;
  serviceDate?: string;
  mealType?: string;
  isClosed?: boolean;
  menuText?: string;
  menuItems?: unknown;
  confidence?: number | null;
};

const MEAL_LABEL: Record<string, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
};

function renderCafeteriaMenus(data: unknown): string {
  const d = data as { items?: CafeteriaEntry[] };
  if (!d.items?.length) return "";

  // 식당별 → 날짜별 → 끼니 순으로 그룹핑
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

  // 끼니 순서 (아침 → 점심 → 저녁)
  const mealOrder = ["breakfast", "lunch", "dinner"];

  let html = "";
  for (const [, sGroup] of bySource) {
    html += `<section class="card"><div class="card-title">${esc(sGroup.name)}</div>`;
    const sortedDays = Array.from(sGroup.days.values()).sort((a, b) => a.date.localeCompare(b.date));
    const multiDay = sortedDays.length > 1;
    for (const day of sortedDays) {
      if (multiDay) {
        const dl = day.date ? new Date(`${day.date}T00:00:00+09:00`).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" }) : day.date;
        html += `<div class="day-group"><div class="day-label">${esc(dl)}</div>`;
      }
      day.meals.sort((a, b) => mealOrder.indexOf(a.mealType || "") - mealOrder.indexOf(b.mealType || ""));
      for (const m of day.meals) {
        const mealLabel = MEAL_LABEL[m.mealType || ""] || m.mealType || "";
        if (m.isClosed) {
          html += `<div class="item"><div class="item-title">${esc(mealLabel)} <span class="badge badge-gray">휴무</span></div></div>`;
          continue;
        }
        // menuItems가 배열이면 그걸 우선, 없으면 menuText 줄단위
        let items: string[] = [];
        if (Array.isArray(m.menuItems)) {
          items = (m.menuItems as unknown[]).map((x) => String(x)).filter((s) => s.trim());
        } else if (m.menuText) {
          items = m.menuText.split(/\n+/).map((s) => s.trim()).filter(Boolean);
        }
        html += `<div class="item"><div class="item-title">${esc(mealLabel)}</div>`;
        if (items.length) {
          html += `<div class="item-sub">${items.map((x) => esc(x)).join(" · ")}</div>`;
        }
        html += `</div>`;
      }
      if (multiDay) html += `</div>`;
    }
    html += `</section>`;
  }

  return html;
}

// ── 출석 ────────────────────────────────────────────────────────

function renderAttendanceText(data: unknown): string {
  if (typeof data === "string") {
    return `<section class="card"><div class="card-title">출석 상세</div><div class="summary-body">${esc(data)}</div></section>`;
  }
  const d = data as {
    course?: { courseTitle?: string; professor?: string; scheduleSummary?: string };
    summary?: { attendedCount?: number; tardyCount?: number; earlyLeaveCount?: number; absentCount?: number };
    totalSessions?: number;
    completedSessions?: number;
    sessions?: Array<{
      week?: number;
      classNo?: number;
      sessionLabel?: string;
      date?: string;
      dateLabel?: string;
      timeRange?: string;
      classroom?: string;
      isPast?: boolean;
      statusLabel?: string;
      attendAt?: string;
    }>;
  };

  let html = "";

  // 과목 헤더
  if (d.course) {
    const c = d.course;
    html += `<section class="card"><div class="card-title">${esc(c.courseTitle || "출석")}</div>`;
    const subParts: string[] = [];
    if (c.professor) subParts.push(`${esc(c.professor)} 교수`);
    if (c.scheduleSummary) subParts.push(esc(c.scheduleSummary.replace(/\n/g, " · ")));
    if (subParts.length) html += `<div class="item-sub">${subParts.join(" · ")}</div>`;
    html += `</section>`;
  }

  // 요약 배지
  if (d.summary) {
    const s = d.summary;
    const total = d.completedSessions ?? 0;
    html += `<section class="card"><div class="card-title">출석 요약</div><div class="badge-group">`;
    html += `<span class="badge badge-blue">진행 ${total}회</span>`;
    html += `<span class="badge badge-green">출석 ${s.attendedCount ?? 0}</span>`;
    if ((s.tardyCount ?? 0) > 0) html += `<span class="badge badge-yellow">지각 ${s.tardyCount}</span>`;
    if ((s.earlyLeaveCount ?? 0) > 0) html += `<span class="badge badge-yellow">조퇴 ${s.earlyLeaveCount}</span>`;
    if ((s.absentCount ?? 0) > 0) html += `<span class="badge badge-red">결석 ${s.absentCount}</span>`;
    html += `</div></section>`;
  }

  // 세션 테이블
  if (d.sessions && d.sessions.length > 0) {
    const past = d.sessions.filter((s) => s.isPast).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (past.length > 0) {
      html += `<section class="card"><div class="card-title">세션별 출석</div>`;
      html += `<table><thead><tr><th>주차</th><th>날짜</th><th>상태</th><th>입실</th></tr></thead><tbody>`;
      for (const s of past) {
        const status = s.statusLabel || "-";
        let badgeCls = "badge-gray";
        if (status === "출석") badgeCls = "badge-green";
        else if (status === "결석") badgeCls = "badge-red";
        else if (status === "지각" || status === "조퇴") badgeCls = "badge-yellow";
        html += `<tr>
          <td>${esc(s.sessionLabel || "-")}</td>
          <td>${esc(s.dateLabel || s.date || "-")}</td>
          <td><span class="badge ${badgeCls}">${esc(status)}</span></td>
          <td>${esc(s.attendAt || "-")}</td>
        </tr>`;
      }
      html += `</tbody></table></section>`;
    }

    const upcoming = d.sessions.filter((s) => !s.isPast).slice(0, 5);
    if (upcoming.length > 0) {
      html += `<section class="card"><div class="card-title">다가오는 수업</div>`;
      for (const s of upcoming) {
        const when = [s.dateLabel || s.date, s.timeRange].filter(Boolean).join(" · ");
        html += `<div class="item"><div class="item-title">${esc(when)}</div>${s.classroom ? `<div class="item-sub">${esc(s.classroom)}</div>` : ""}</div>`;
      }
      html += `</section>`;
    }
  }

  return html || renderGeneric(data);
}

// ── 기본 (JSON) ─────────────────────────────────────────────────

function renderGeneric(data: unknown): string {
  const json = JSON.stringify(data, null, 2);
  return `<section class="card"><div class="card-title">원본 데이터</div><pre class="raw-json">${esc(json)}</pre></section>`;
}

function renderMarkdown(markdown: string): string {
  const rendered = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(rendered);
}

// aiResponse가 비어있을 때 rawData 기반으로 기본 요약 markdown 생성.
function generateFallbackSummary(dataType: string, rawData: unknown): string {
  if (!rawData || typeof rawData !== "object") {
    return "_에이전트 요약이 아직 도착하지 않았어요. 아래 데이터를 참고해주세요._";
  }
  const d = rawData as Record<string, unknown>;

  const pickItems = (...keys: string[]): unknown[] => {
    for (const k of keys) {
      const v = d[k];
      if (Array.isArray(v)) return v;
    }
    return [];
  };

  const countLine = (label: string, items: unknown[]): string =>
    items.length ? `- **${label}**: ${items.length}건` : "";

  switch (dataType) {
    case "unsubmitted":
    case "due-assignments": {
      const items = pickItems("assignments", "items");
      if (!items.length) return "_미제출·마감 임박 과제가 없습니다._";
      const expired = (items as AssignmentItem[]).filter(isAssignmentExpired).length;
      const pending = items.length - expired;
      return [
        `총 **${items.length}건**의 과제가 있어요.`,
        pending ? `- 진행중: ${pending}건` : "",
        expired ? `- 만료: ${expired}건` : "",
        "",
        "아래 목록에서 자세한 내용을 확인하세요.",
      ].filter(Boolean).join("\n");
    }
    case "unread-notices": {
      const items = pickItems("notices", "items");
      if (!items.length) return "_안 읽은 공지가 없습니다._";
      return `안 읽은 공지 **${items.length}건**이 있어요. 아래에서 자세한 내용을 확인하세요.`;
    }
    case "action-items": {
      const unsub = pickItems("unsubmittedAssignments");
      const due = pickItems("dueAssignments");
      const notices = pickItems("unreadNotices");
      const online = pickItems("incompleteOnlineWeeks");
      const lines = [
        countLine("미제출 과제", unsub),
        countLine("마감 임박 과제", due),
        countLine("안 읽은 공지", notices),
        countLine("미수강 온라인", online),
      ].filter(Boolean);
      if (!lines.length) return "_지금 해야 할 일이 없어요. 훌륭해요._";
      return ["**지금 해야 할 일**", "", ...lines].join("\n");
    }
    case "timetable": {
      const entries = pickItems("entries");
      if (!entries.length) return "_등록된 시간표가 없습니다._";
      return `이번 학기 시간표 **${entries.length}개 수업**이 등록되어 있어요.`;
    }
    case "courses": {
      const items = pickItems("courses", "items");
      if (!items.length) return "_수강 과목이 없습니다._";
      return `총 **${items.length}개 과목**을 수강 중입니다.`;
    }
    case "grades": {
      const items = pickItems("items", "grades");
      if (!items.length) return "_성적 정보가 없습니다._";
      return `**${items.length}개 과목**의 성적이 있습니다.`;
    }
    case "graduation": {
      const gaps = pickItems("creditGaps");
      if (!gaps.length) return "_졸업요건 정보가 없습니다._";
      const shortages = (gaps as Array<{ gap?: number }>).filter((g) => (g.gap ?? 0) > 0).length;
      return shortages
        ? `졸업요건 중 **${shortages}개 영역**이 부족합니다.`
        : `**모든 졸업요건을 충족**했습니다.`;
    }
    case "attendance": {
      const course = (d.course as { courseTitle?: string } | undefined)?.courseTitle;
      const s = d.summary as { attendedCount?: number; absentCount?: number } | undefined;
      if (!s) return "_출석 정보를 가져오지 못했습니다._";
      return [
        course ? `**${course}** 출석 현황` : "**출석 현황**",
        "",
        `- 출석: ${s.attendedCount ?? 0}회`,
        `- 결석: ${s.absentCount ?? 0}회`,
      ].join("\n");
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

// ── HTML 이스케이프 ─────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// 메타 문자열 결합 (falsy 제외, HTML escape, " · "로 조인).
function joinMeta(parts: Array<string | number | null | undefined>, sep = " · "): string {
  return parts
    .filter((x): x is string | number => x !== null && x !== undefined && x !== "")
    .map((x) => esc(String(x)))
    .join(sep);
}
