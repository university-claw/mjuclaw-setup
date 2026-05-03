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
  let briefingHtml = "";
  if (entry.dataType !== "timetable" && entry.dataType !== "grades" && entry.dataType !== "graduation" && entry.dataType !== "action-items") {
    const aiResponseEffective = entry.aiResponse?.trim()
      ? entry.aiResponse
      : generateFallbackSummary(entry.dataType, entry.rawData);
    const aiSummaryHtml = renderMarkdown(aiResponseEffective);
    briefingHtml = `<section class="briefing">
    <div class="briefing-label">AI 요약</div>
    <div class="briefing-body">${aiSummaryHtml}</div>
  </section>`;
  }
  const contentHtml = `${briefingHtml}${dataHtml}`;
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

  ${contentHtml}

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
  overflow-x: hidden;
}

.page { width: 100%; max-width: 560px; margin: 0 auto; overflow: hidden; }
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
.topbar-meta { min-width: 0; overflow: hidden; }
.kicker {
  display: block;
  font-size: 11px; font-weight: 600;
  color: var(--ink-3);
  letter-spacing: 0.12em; text-transform: uppercase;
  max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
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

/* Action queue */
.action-next {
  margin-top: 12px;
  padding: 16px;
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  background: var(--bg-alt);
}
.action-next.is-urgent {
  border-color: var(--red-soft);
  background: linear-gradient(180deg, var(--red-soft), var(--bg-alt));
}
.action-next-top,
.action-row {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px; align-items: center;
}
.action-next-top {
  grid-template-columns: auto minmax(0, 1fr) auto;
}
.action-type {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 38px; height: 24px; padding: 0 8px;
  border-radius: var(--radius-pill);
  background: var(--chip-bg); color: var(--ink-2);
  font-size: 11px; font-weight: 800; letter-spacing: -0.01em;
  white-space: nowrap;
}
.action-next.is-urgent .action-type,
.action-row.is-urgent .action-type,
.action-row.is-today .action-type {
  background: var(--red-soft); color: var(--red);
}
.action-row.is-notice .action-type {
  background: var(--accent-soft); color: var(--accent);
}
.action-next-title {
  margin-top: 10px; color: var(--ink);
  font-size: 17px; line-height: 1.35; font-weight: 800;
  letter-spacing: -0.015em; word-break: keep-all;
}
.action-next-meta {
  margin-top: 6px; color: var(--ink-3);
  font-size: 12.5px; font-weight: 600; word-break: keep-all;
}
.action-list {
  margin-top: 8px;
  border-top: 1px solid var(--rule);
}
.action-row {
  padding: 13px 0;
  border-bottom: 1px solid var(--rule);
}
.action-row-title {
  color: var(--ink); font-size: 14px; font-weight: 700;
  line-height: 1.35; word-break: keep-all;
}
.action-row-meta {
  margin-top: 3px; color: var(--ink-3);
  font-size: 12px; font-weight: 600; word-break: keep-all;
}
.action-due {
  color: var(--ink-2); font-size: 12px; font-weight: 700;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.action-next.is-urgent .action-due,
.action-row.is-urgent .action-due,
.action-row.is-today .action-due {
  color: var(--red); font-weight: 800;
}
.action-row.is-notice .action-due {
  color: var(--ink-3); font-weight: 600;
}

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

/* Grades */
.grades-section { padding-top: 22px; }
.grades-snapshot {
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  background: var(--bg-alt);
  padding: 16px;
}
.grades-snapshot-top {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px;
}
.grades-label {
  color: var(--accent); font-size: 11px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
}
.grades-gpa {
  margin-top: 7px;
  color: var(--ink); font-size: 34px; line-height: 1; font-weight: 700;
  letter-spacing: -0.03em; font-variant-numeric: tabular-nums;
}
.grades-gpa .unit {
  color: var(--ink-3); font-size: 16px; font-weight: 600;
  letter-spacing: -0.01em;
}
.grades-scale {
  margin-top: 7px; color: var(--ink-3);
  font-size: 12px; font-weight: 600;
}
.grades-level {
  flex: 0 0 auto;
  min-width: 58px; padding: 7px 10px;
  border-radius: var(--radius-pill);
  background: var(--ink); color: var(--bg);
  font-size: 12px; font-weight: 700; text-align: center;
}
.grades-gpa-graph {
  margin-top: 18px;
}
.grades-gpa-rail {
  position: relative;
  padding-top: 28px;
}
.grades-gpa-segments {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  height: 12px;
}
.grades-gpa-segment {
  border-radius: var(--radius-pill);
  background: var(--chip-bg);
}
.grades-gpa-segment.low { background: var(--chip-bg); }
.grades-gpa-segment.stable { background: var(--rule-strong); }
.grades-gpa-segment.strong { background: var(--accent-soft-2); }
.grades-gpa-segment.top { background: var(--accent); }
.grades-gpa-marker {
  position: absolute; left: var(--gpa-marker); top: 0;
  display: flex; flex-direction: column; align-items: center;
  gap: 5px;
  transform: translateX(-50%);
}
.grades-gpa-marker strong {
  min-width: 42px; padding: 4px 8px;
  border-radius: var(--radius-pill);
  background: var(--ink); color: var(--bg);
  font-size: 12px; line-height: 1; font-weight: 800;
  text-align: center; font-variant-numeric: tabular-nums;
}
.grades-gpa-marker span {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg-alt);
}
.grades-gpa-band-labels {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px; margin-top: 8px;
  color: var(--ink-3);
  font-size: 10.5px; font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.grades-gpa-band-labels span {
  min-width: 0;
  text-align: center;
  white-space: nowrap;
}
.grades-stats {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px; margin-top: 14px;
}
.grades-stat {
  min-width: 0; padding: 10px 8px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-sm);
  background: var(--bg);
}
.grades-stat strong {
  display: block; color: var(--ink);
  font-size: 15px; line-height: 1.1; font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.grades-stat span {
  display: block; margin-top: 5px;
  color: var(--ink-3); font-size: 11px; font-weight: 600;
  white-space: nowrap;
}
.grade-course-list {
  display: flex; flex-direction: column; gap: 9px;
  margin-top: 12px;
}
.grade-course-card {
  display: grid; grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px; align-items: center;
  padding: 13px 14px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  background: var(--bg);
}
.grade-course-card.top {
  border-color: var(--accent-soft-2);
  background: linear-gradient(180deg, var(--accent-soft), var(--bg));
}
.grade-course-main { min-width: 0; }
.grade-course-title {
  color: var(--ink); font-size: 14px; font-weight: 700;
  line-height: 1.35; letter-spacing: -0.01em; word-break: keep-all;
}
.grade-course-meta {
  margin-top: 5px; color: var(--ink-3);
  font-size: 12px; font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.grade-course-result {
  display: flex; flex-direction: column; align-items: flex-end;
  gap: 5px; min-width: 48px;
}
.grade-pill {
  min-width: 42px; padding: 5px 9px;
  border-radius: var(--radius-pill);
  text-align: center;
  font-size: 13px; line-height: 1; font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.grade-pill.high { color: var(--accent); background: var(--accent-soft); }
.grade-pill.mid { color: var(--ink); background: var(--chip-bg); }
.grade-pill.watch { color: var(--warn); background: var(--warn-soft); }
.grade-pill.other { color: var(--ink-2); background: var(--chip-bg); }
.grade-score {
  color: var(--ink-3); font-size: 11px; font-weight: 600;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}

/* Timetable */
.timetable-section { padding-top: 22px; }
.timetable-focus {
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  background: var(--bg-alt);
  padding: 16px;
}
.focus-kicker {
  display: inline-flex; align-items: center;
  min-height: 22px; padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft); color: var(--accent);
  font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
}
.focus-title {
  margin-top: 12px;
  font-size: 22px; line-height: 1.22; font-weight: 700;
  color: var(--ink); letter-spacing: -0.02em; word-break: keep-all;
}
.focus-primary {
  display: flex; align-items: center; flex-wrap: wrap;
  gap: 6px; margin-top: 10px;
  color: var(--ink); font-size: 14px; font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.focus-arrow { color: var(--ink-3); font-weight: 500; }
.focus-place {
  margin-left: 4px; padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--ink); color: var(--bg);
  font-size: 12px; font-weight: 700;
}
.focus-sub {
  margin-top: 8px; color: var(--ink-3);
  font-size: 12.5px; font-weight: 500; word-break: keep-all;
}
.weekday-tabs {
  position: sticky; top: 0; z-index: 3;
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px; margin: 16px -2px 22px; padding: 8px 2px;
  background: var(--bg);
  backdrop-filter: blur(10px);
}
.weekday-tab {
  min-width: 0; min-height: 46px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  background: var(--bg); color: var(--ink-2);
  text-decoration: none;
}
.weekday-tab span {
  font-size: 12px; font-weight: 700; letter-spacing: -0.005em;
}
.weekday-tab strong {
  color: var(--ink-3); font-size: 11px; font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.weekday-tab.active {
  background: var(--ink); border-color: var(--ink); color: var(--bg);
}
.weekday-tab.active strong { color: var(--bg); opacity: 0.72; }
.weekday-tab.today:not(.active) {
  border-color: var(--accent-soft-2);
  color: var(--accent);
}
.weekday-tab.empty { opacity: 0.62; }
.timetable-title { margin-top: 2px; }
.timeline-day {
  scroll-margin-top: 74px;
  padding: 18px 0 2px;
  border-top: 1px solid var(--rule);
}
.timeline-day:first-of-type { border-top: none; }
.timeline-day-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 12px;
  color: var(--ink-3); font-size: 12px; font-weight: 600;
}
.timeline-day-head > div {
  display: inline-flex; align-items: center; gap: 8px; min-width: 0;
}
.timeline-day-label {
  color: var(--ink); font-size: 16px; font-weight: 700; letter-spacing: -0.01em;
}
.today-chip {
  padding: 2px 7px; border-radius: var(--radius-pill);
  background: var(--accent-soft); color: var(--accent);
  font-size: 11px; font-weight: 700;
}
.timeline-list {
  position: relative;
  display: flex; flex-direction: column; gap: 10px;
}
.timeline-list::before {
  content: "";
  position: absolute; left: 53px; top: 10px; bottom: 10px;
  width: 1px; background: var(--rule-strong);
}
.timeline-course {
  position: relative;
  display: grid; grid-template-columns: 46px minmax(0, 1fr);
  gap: 14px; align-items: stretch;
}
.timeline-time {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: flex-end;
  padding-top: 10px;
  font-variant-numeric: tabular-nums;
}
.timeline-time::after {
  content: "";
  position: absolute; top: 16px; right: -20px;
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--bg); border: 2px solid var(--rule-strong);
}
.timeline-time strong {
  color: var(--ink); font-size: 12.5px; font-weight: 700;
}
.timeline-time span {
  margin-top: 2px; color: var(--ink-3); font-size: 11px; font-weight: 600;
}
.timeline-card {
  min-width: 0; padding: 13px 14px 12px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  background: var(--bg);
}
.timeline-card-top {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 10px;
}
.timeline-course-title {
  min-width: 0;
  color: var(--ink); font-size: 15px; line-height: 1.35; font-weight: 700;
  letter-spacing: -0.01em; word-break: keep-all;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.timeline-place {
  margin-top: 7px;
  color: var(--accent); font-size: 14px; line-height: 1.25; font-weight: 700;
}
.timeline-meta {
  margin-top: 4px;
  color: var(--ink-3); font-size: 12px; font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.status-pill {
  flex: 0 0 auto;
  padding: 2px 7px; border-radius: var(--radius-pill);
  font-size: 11px; font-weight: 700;
}
.status-pill.next { background: var(--accent-soft); color: var(--accent); }
.status-pill.live { background: var(--green-soft); color: var(--green); }
.timeline-course.is-next .timeline-card {
  border-color: var(--accent-soft-2);
  background: linear-gradient(180deg, var(--accent-soft), var(--bg));
}
.timeline-course.is-live .timeline-card {
  border-color: var(--green);
  background: var(--green-soft);
}
.timeline-course.is-next .timeline-time::after,
.timeline-course.is-live .timeline-time::after {
  border-color: var(--accent); background: var(--accent);
}
.timeline-course.is-past { opacity: 0.52; }
.timeline-gap {
  position: relative;
  display: grid; grid-template-columns: 46px minmax(0, 1fr);
  gap: 14px; align-items: center;
  min-height: 26px;
}
.timeline-gap span {
  justify-self: end;
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--rule-strong); margin-right: -18px; z-index: 1;
}
.timeline-gap strong {
  color: var(--ink-3); font-size: 12px; font-weight: 600;
}
.timeline-empty {
  padding: 18px 14px;
  border: 1px dashed var(--rule-strong);
  border-radius: var(--radius-md);
  color: var(--ink-3); font-size: 13px; font-weight: 500;
  background: var(--bg-alt);
}

@media (max-width: 480px) {
  body { padding-left: 16px; padding-right: 16px; }
  .topbar-meta { display: none; }
  .weekday-tabs { gap: 4px; margin-left: 0; margin-right: 0; }
  .weekday-tab { min-height: 44px; border-radius: var(--radius-sm); }
  .timeline-list::before { left: 48px; }
  .timeline-course,
  .timeline-gap {
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 12px;
  }
  .timeline-time::after { right: -17px; }
  .timeline-gap span { margin-right: -16px; }
  .timeline-card { padding: 12px; }
  .status-pill { font-size: 10.5px; padding: 2px 6px; }
}

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

.grad-shortage-list {
  margin-top: 8px;
  border-top: 1px solid var(--rule);
}
.grad-shortage-row {
  display: grid; grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px; align-items: center;
  padding: 13px 0;
  border-bottom: 1px solid var(--rule);
}
.grad-shortage-title {
  color: var(--ink); font-size: 14px; font-weight: 700;
  line-height: 1.35; word-break: keep-all;
}
.grad-shortage-meta {
  margin-top: 4px; color: var(--ink-3);
  font-size: 12px; font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.grad-shortage-gap {
  color: var(--red); font-size: 12px; font-weight: 800;
  font-variant-numeric: tabular-nums; white-space: nowrap;
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

type OnlineActionItem = {
  courseTitle?: string;
  weekLabel?: string;
  lectureTitle?: string;
  dueLabel?: string;
  dueAt?: string;
  statusText?: string;
  priority?: string;
  isExpired?: boolean;
};

type ActionQueueItem = {
  source: "assignment" | "online" | "notice";
  lane: "urgent" | "today" | "soon" | "notice";
  title: string;
  courseTitle?: string;
  weekLabel?: string;
  dueLabel?: string;
  dueAt?: string;
  statusText?: string;
  postedAt?: string;
  priority?: string;
  order: number;
};

function codeChip(title: string): string {
  return esc((title || "").slice(0, 2));
}

// ── 시간표 ────────────────────────────────────────────

type TimetableEntry = {
  dayOfWeek: number;
  dayLabel?: string;
  courseTitle: string;
  location?: string;
  timeRange?: string;
  professor?: string;
};

type NormalizedTimetableEntry = TimetableEntry & {
  sourceIndex: number;
  dayIndex: number;
  dayLabel: string;
  start: string;
  end: string;
  startMinutes: number;
  endMinutes: number;
};

function renderTimetable(data: unknown): string {
  const d = data as { entries?: TimetableEntry[] };
  if (!d.entries?.length) return "";

  const days = ["월", "화", "수", "목", "금"];
  const now = new Date();
  const todayIdx = now.getDay() - 1; // 월=0
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const normalized = d.entries
    .map((entry, sourceIndex) => normalizeTimetableEntry(entry, sourceIndex, days))
    .filter((entry) => entry.dayIndex >= 0 && entry.dayIndex < days.length)
    .sort(compareTimetableEntries);

  const byDay: NormalizedTimetableEntry[][] = days.map(() => []);
  for (const entry of normalized) {
    byDay[entry.dayIndex].push(entry);
  }

  const focusEntry = findFocusTimetableEntry(normalized, todayIdx, nowMinutes) || normalized[0];
  const focusDayIdx = todayIdx >= 0 && todayIdx < days.length && byDay[todayIdx].length > 0
    ? todayIdx
    : focusEntry.dayIndex;
  const focusStatus = describeTimetableFocus(focusEntry, todayIdx, nowMinutes);
  const weekClassCount = normalized.length;

  let html = `<section class="section timetable-section">`;
  html += `<div class="timetable-focus">`;
  html += `<div class="focus-kicker">${esc(focusStatus.kicker)}</div>`;
  html += `<div class="focus-title">${esc(focusEntry.courseTitle)}</div>`;
  html += `<div class="focus-primary"><span>${esc(focusEntry.start)}</span><span class="focus-arrow">→</span><span>${esc(focusEntry.end)}</span><span class="focus-place">${esc(focusEntry.location || "강의실 미정")}</span></div>`;
  html += `<div class="focus-sub">${esc(focusStatus.detail)}${focusEntry.professor ? ` · ${esc(focusEntry.professor)}` : ""}</div>`;
  html += `</div>`;
  html += `<nav class="weekday-tabs" aria-label="요일별 시간표">`;
  for (let i = 0; i < days.length; i++) {
    const count = byDay[i].length;
    const cls = [
      "weekday-tab",
      i === focusDayIdx ? "active" : "",
      i === todayIdx ? "today" : "",
      count === 0 ? "empty" : "",
    ].filter(Boolean).join(" ");
    html += `<a class="${cls}" href="#day-${i + 1}"><span>${days[i]}</span><strong>${count}</strong></a>`;
  }
  html += `</nav>`;

  html += `<div class="section-title timetable-title"><h2>요일별 시간표<span class="count">${weekClassCount}</span></h2></div>`;
  html += `<div class="section-sub">시간, 강의실, 공강을 하루 흐름으로 볼 수 있어요.</div>`;

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const entries = byDay[dayIndex];
    const isToday = dayIndex === todayIdx;
    const isFocusDay = dayIndex === focusDayIdx;
    html += `<section class="timeline-day${isFocusDay ? " focus-day" : ""}" id="day-${dayIndex + 1}">`;
    html += `<div class="timeline-day-head"><div><span class="timeline-day-label">${days[dayIndex]}요일</span>${isToday ? `<span class="today-chip">오늘</span>` : ""}</div><span>${entries.length ? `${entries.length}개 수업` : "수업 없음"}</span></div>`;

    if (!entries.length) {
      html += `<div class="timeline-empty">이 날은 수업이 없어요.</div>`;
      html += `</section>`;
      continue;
    }

    html += `<div class="timeline-list">`;
    entries.forEach((entry, index) => {
      const previous = entries[index - 1];
      if (previous) {
        const gap = entry.startMinutes - previous.endMinutes;
        if (gap >= 30) {
          html += `<div class="timeline-gap"><span></span><strong>공강 ${formatDuration(gap)}</strong></div>`;
        }
      }

      const statusClass = timetableEntryStatusClass(entry, focusEntry, todayIdx, nowMinutes);
      html += `<article class="timeline-course ${statusClass}">`;
      html += `<div class="timeline-time"><strong>${esc(entry.start)}</strong><span>${esc(entry.end)}</span></div>`;
      html += `<div class="timeline-card">`;
      html += `<div class="timeline-card-top"><div class="timeline-course-title">${esc(entry.courseTitle)}</div>${statusClass === "is-live" ? `<span class="status-pill live">진행 중</span>` : statusClass === "is-next" ? `<span class="status-pill next">다음</span>` : ""}</div>`;
      html += `<div class="timeline-place">${esc(entry.location || "강의실 미정")}</div>`;
      html += `<div class="timeline-meta">${joinMeta([entry.professor, entry.timeRange])}</div>`;
      html += `</div></article>`;
    });
    html += `</div></section>`;
  }

  return html + `</section>`;
}

function normalizeTimetableEntry(entry: TimetableEntry, sourceIndex: number, days: string[]): NormalizedTimetableEntry {
  const dayIndex = Number.isFinite(entry.dayOfWeek) ? entry.dayOfWeek - 1 : days.indexOf(entry.dayLabel || "");
  const parsed = parseTimeRange(entry.timeRange);
  return {
    ...entry,
    sourceIndex,
    dayIndex,
    dayLabel: entry.dayLabel || days[dayIndex] || "?",
    start: parsed.start,
    end: parsed.end,
    startMinutes: parsed.startMinutes,
    endMinutes: parsed.endMinutes,
  };
}

function parseTimeRange(timeRange?: string): { start: string; end: string; startMinutes: number; endMinutes: number } {
  const raw = timeRange || "";
  const parts = raw.split(/\s*[–-]\s*/);
  const start = parts[0]?.trim() || "";
  const end = parts[1]?.trim() || "";
  return {
    start,
    end,
    startMinutes: parseClockMinutes(start),
    endMinutes: parseClockMinutes(end),
  };
}

function parseClockMinutes(clock: string): number {
  const match = clock.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  return hours * 60 + minutes;
}

function compareTimetableEntries(a: NormalizedTimetableEntry, b: NormalizedTimetableEntry): number {
  if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
  if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
  return a.sourceIndex - b.sourceIndex;
}

function findFocusTimetableEntry(entries: NormalizedTimetableEntry[], todayIdx: number, nowMinutes: number): NormalizedTimetableEntry | undefined {
  if (!entries.length) return undefined;

  if (todayIdx >= 0 && todayIdx < 5) {
    const remainingToday = entries.find((entry) => entry.dayIndex === todayIdx && entry.endMinutes >= nowMinutes);
    if (remainingToday) return remainingToday;

    const laterThisWeek = entries.find((entry) => entry.dayIndex > todayIdx);
    if (laterThisWeek) return laterThisWeek;
  }

  return entries[0];
}

function describeTimetableFocus(entry: NormalizedTimetableEntry, todayIdx: number, nowMinutes: number): { kicker: string; detail: string } {
  if (entry.dayIndex === todayIdx && nowMinutes >= entry.startMinutes && nowMinutes < entry.endMinutes) {
    return { kicker: "진행 중", detail: `${entry.dayLabel}요일 ${formatDuration(entry.endMinutes - nowMinutes)} 뒤 종료` };
  }

  if (entry.dayIndex === todayIdx && entry.startMinutes > nowMinutes) {
    return { kicker: "다음 수업", detail: `${formatDuration(entry.startMinutes - nowMinutes)} 뒤 시작` };
  }

  return { kicker: "다음 수업", detail: `${entry.dayLabel}요일 예정` };
}

function timetableEntryStatusClass(entry: NormalizedTimetableEntry, focusEntry: NormalizedTimetableEntry, todayIdx: number, nowMinutes: number): string {
  if (entry.dayIndex === todayIdx && nowMinutes >= entry.startMinutes && nowMinutes < entry.endMinutes) {
    return "is-live";
  }

  if (entry.sourceIndex === focusEntry.sourceIndex) {
    return "is-next";
  }

  if (entry.dayIndex < todayIdx || (entry.dayIndex === todayIdx && entry.endMinutes < nowMinutes)) {
    return "is-past";
  }

  return "";
}

function formatDuration(minutes: number): string {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours}시간 ${mins}분`;
  if (hours > 0) return `${hours}시간`;
  return `${mins}분`;
}

// ── 성적 ──────────────────────────────────────────────

function renderGrades(data: unknown): string {
  const d = data as {
    items?: Array<{ courseTitle: string; credits?: number; grade?: string; score?: number; statusMessage?: string }>;
    gpa?: number; maxGpa?: number; totalCredits?: number;
  };
  if (!d.items?.length) return "";

  const items = d.items;
  const courseCount = items.length;
  const totalCredits = typeof d.totalCredits === "number"
    ? d.totalCredits
    : items.reduce((sum, item) => sum + (item.credits ?? 0), 0);
  const maxGpa = typeof d.maxGpa === "number" ? d.maxGpa : 4.5;
  const gpaText = typeof d.gpa === "number" ? d.gpa.toFixed(2) : "-";
  const markerPercent = typeof d.gpa === "number" ? gpaBandRailPosition(d.gpa, maxGpa) : 0;
  const scores = items
    .map((item) => item.score)
    .filter((score): score is number => typeof score === "number");
  const averageScore = scores.length
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : null;
  const levelText = typeof d.gpa === "number" ? gpaBandName(d.gpa) : "GPA";
  const scaleText = typeof d.gpa === "number" ? gpaBandDescription(d.gpa) : "GPA 구간 기준";

  let html = `<section class="section grades-section">`;
  html += `<div class="grades-snapshot">`;
  html += `<div class="grades-snapshot-top"><div><div class="grades-label">이번 학기 GPA</div><div class="grades-gpa">${gpaText}${typeof d.gpa === "number" ? `<span class="unit"> / ${maxGpa.toFixed(2)}</span>` : ""}</div><div class="grades-scale">${esc(scaleText)}</div></div><div class="grades-level">${esc(levelText)}</div></div>`;
  html += `<div class="grades-gpa-graph"><div class="grades-gpa-rail" style="--gpa-marker:${markerPercent.toFixed(1)}%"><div class="grades-gpa-marker"><strong>${esc(gpaText)}</strong><span></span></div><div class="grades-gpa-segments" aria-label="GPA band rail"><span class="grades-gpa-segment low"></span><span class="grades-gpa-segment stable"></span><span class="grades-gpa-segment strong"></span><span class="grades-gpa-segment top"></span></div><div class="grades-gpa-band-labels"><span>3.0 미만</span><span>3.0+</span><span>3.5+</span><span>4.0+</span></div></div></div>`;
  html += `<div class="grades-stats">`;
  html += `<div class="grades-stat"><strong>${totalCredits || "-"}</strong><span>이수 학점</span></div>`;
  html += `<div class="grades-stat"><strong>${courseCount}</strong><span>과목</span></div>`;
  html += `<div class="grades-stat"><strong>${averageScore ?? "-"}</strong><span>평균 점수</span></div>`;
  html += `</div></div>`;
  html += `</section>`;

  html += `<section class="section"><div class="section-title"><h2>과목별 성적<span class="count">${courseCount}</span></h2></div><div class="section-sub">오른쪽 성적 배지를 기준으로 빠르게 훑어볼 수 있어요.</div><div class="grade-course-list">`;
  for (const item of items) {
    const grade = item.grade || item.statusMessage || "-";
    const tone = gradeTone(grade);
    const topClass = tone === "high" ? " top" : "";
    html += `<article class="grade-course-card${topClass}"><div class="grade-course-main"><div class="grade-course-title">${esc(item.courseTitle || "과목명 미정")}</div><div class="grade-course-meta">${joinMeta([item.credits != null ? `${item.credits}학점` : null])}</div></div><div class="grade-course-result"><div class="grade-pill ${tone}">${esc(grade)}</div><div class="grade-score">${item.score != null ? `${esc(String(item.score))}점` : "상태"}</div></div></article>`;
  }
  html += `</div></section>`;

  return html;
}

function gradeTone(grade: string): "high" | "mid" | "watch" | "other" {
  const normalized = grade.trim().toUpperCase();
  if (normalized.startsWith("A")) return "high";
  if (normalized.startsWith("B")) return "mid";
  if (normalized.startsWith("C") || normalized.startsWith("D") || normalized.startsWith("F")) return "watch";
  return "other";
}

function gpaBandRailPosition(gpa: number, maxGpa: number): number {
  const cappedMax = Math.max(maxGpa, 4.5);
  const bands = [
    { from: 0, to: 3.0 },
    { from: 3.0, to: 3.5 },
    { from: 3.5, to: 4.0 },
    { from: 4.0, to: cappedMax },
  ];
  const safeGpa = Math.max(0, Math.min(cappedMax, gpa));
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    if (safeGpa <= band.to || i === bands.length - 1) {
      const ratio = (safeGpa - band.from) / Math.max(0.01, band.to - band.from);
      return Math.max(4, Math.min(96, i * 25 + ratio * 25));
    }
  }
  return 96;
}

function gpaBandName(gpa: number): string {
  if (gpa >= 4.0) return "A권역";
  if (gpa >= 3.5) return "우수";
  if (gpa >= 3.0) return "안정";
  return "확인";
}

function gpaBandDescription(gpa: number): string {
  if (gpa >= 4.0) return "4.0 이상 A권역에 있어요";
  if (gpa >= 3.5) return "3.5 이상 우수 구간이에요";
  if (gpa >= 3.0) return "3.0 이상 안정 구간이에요";
  return "3.0 미만 확인 구간이에요";
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
  const shortageItems = d.creditGaps.filter((g) => graduationGap(g) > 0);

  // Hero ring
  const size = 128, stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);

  let html = `<section class="section"><div class="grad-hero">`;
  html += `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/><circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${dash} ${c - dash}"/></svg><div class="ring-text"><div class="ring-pct">${pct}<span class="u">%</span></div><div class="ring-cap">완료</div></div></div>`;
  html += `<div style="flex:1;min-width:0"><div class="metric-label">총 취득 학점</div><div class="metric-value" style="font-size:26px;margin-top:4px">${totalEarned}<span class="unit"> / ${totalReq}</span></div><div class="metric-trend" style="margin-top:8px">남은 <strong style="color:var(--ink);font-weight:600">${Math.max(0, totalReq - totalEarned)}학점</strong></div></div>`;
  html += `</div></section>`;

  if (shortageItems.length) {
    html += `<section class="section"><div class="section-title"><h2>부족한 요건<span class="count">${shortageItems.length}</span></h2></div><div class="section-sub">총 취득 학점 아래에서 먼저 확인할 항목이에요.</div><div class="grad-shortage-list">`;
    for (const g of shortageItems) {
      const earned = g.earned ?? 0;
      const required = g.required ?? 0;
      const gap = graduationGap(g);
      html += `<article class="grad-shortage-row"><div><div class="grad-shortage-title">${esc(g.label)}</div><div class="grad-shortage-meta">${earned} / ${required} 학점</div></div><div class="grad-shortage-gap">${gap}학점 부족</div></article>`;
    }
    html += `</div></section>`;
  }

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

function graduationGap(item: { earned?: number; required?: number; gap?: number }): number {
  return Math.max(0, item.gap ?? Math.max(0, (item.required ?? 0) - (item.earned ?? 0)));
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
  const online = (d.incompleteOnlineWeeks as OnlineActionItem[] | undefined) ?? [];
  const total = unsub.length + due.length + notices.length + online.length;
  if (total === 0) {
    return `<section class="section"><div class="section-title"><h2>다음에 할 일</h2></div><div class="section-sub">지금 해야 할 일이 없어요. 훌륭해요.</div></section>`;
  }

  const queue = buildActionQueue(unsub, due, online, notices);
  const nextAction = queue.find((item) => item.source !== "notice");
  const lanes = nextAction ? queue.filter((item) => item !== nextAction) : queue;
  const urgentItems = lanes.filter((item) => item.lane === "urgent");
  const todayItems = lanes.filter((item) => item.lane === "today");
  const soonItems = lanes.filter((item) => item.lane === "soon");
  const noticeItems = lanes.filter((item) => item.lane === "notice");

  let html = `<section class="section action-queue"><div class="section-title"><h2>다음에 할 일</h2></div><div class="section-sub">총 ${total}건 중 가장 먼저 처리할 항목이에요.</div>`;
  if (nextAction) {
    html += renderActionNext(nextAction);
  } else {
    html += `<div class="section-sub">마감이 있는 항목은 없고 확인할 공지만 있어요.</div>`;
  }
  html += `</section>`;

  html += renderActionLane("지금 위험함", urgentItems);
  html += renderActionLane("오늘 해야 함", todayItems);
  html += renderActionLane("곧 해야 함", soonItems);
  html += renderActionLane("확인만 하면 됨", noticeItems);

  return html;
}

function buildActionQueue(
  unsubmitted: AssignmentItem[],
  dueAssignments: AssignmentItem[],
  onlineItems: OnlineActionItem[],
  notices: NoticeItem[],
): ActionQueueItem[] {
  const queue: ActionQueueItem[] = [];
  let order = 0;

  for (const item of unsubmitted) {
    queue.push({
      source: "assignment",
      lane: actionLane(item),
      title: item.title || "과제 제출",
      courseTitle: item.courseTitle,
      weekLabel: item.weekLabel,
      dueLabel: item.dueLabel,
      dueAt: item.dueAt,
      statusText: item.statusText,
      priority: item.priority,
      order: order++,
    });
  }

  for (const item of dueAssignments) {
    queue.push({
      source: "assignment",
      lane: actionLane(item),
      title: item.title || "마감 임박 과제",
      courseTitle: item.courseTitle,
      weekLabel: item.weekLabel,
      dueLabel: item.dueLabel,
      dueAt: item.dueAt,
      statusText: item.statusText,
      priority: item.priority,
      order: order++,
    });
  }

  for (const item of onlineItems) {
    queue.push({
      source: "online",
      lane: actionLane(item),
      title: item.lectureTitle || item.weekLabel || "온라인 강의 시청",
      courseTitle: item.courseTitle,
      weekLabel: item.weekLabel,
      dueLabel: item.dueLabel,
      dueAt: item.dueAt,
      statusText: item.statusText,
      priority: item.priority,
      order: order++,
    });
  }

  for (const item of notices) {
    queue.push({
      source: "notice",
      lane: "notice",
      title: item.title || "공지 확인",
      courseTitle: item.courseTitle,
      postedAt: item.postedAt,
      order: order++,
    });
  }

  return queue.sort((a, b) => actionLaneRank(a) - actionLaneRank(b) || actionPriorityRank(a) - actionPriorityRank(b) || actionDueRank(a) - actionDueRank(b) || a.order - b.order);
}

function renderActionNext(item: ActionQueueItem): string {
  const urgentClass = item.lane === "urgent" || item.lane === "today" ? " is-urgent" : "";
  return `<article class="action-next${urgentClass}"><div class="action-next-top"><span class="action-type">${actionTypeLabel(item)}</span><span></span><span class="action-due">${esc(actionDueText(item))}</span></div><div class="action-next-title">${esc(item.title)}</div><div class="action-next-meta">${joinMeta([item.courseTitle, item.weekLabel, actionReason(item)])}</div></article>`;
}

function renderActionLane(title: string, items: ActionQueueItem[]): string {
  if (!items.length) return "";
  let html = `<section class="section action-lane"><div class="section-title"><h2>${title}<span class="count">${items.length}</span></h2></div><div class="action-list">`;
  for (const item of items.slice(0, 6)) {
    html += renderActionRow(item);
  }
  html += `</div></section>`;
  return html;
}

function renderActionRow(item: ActionQueueItem): string {
  const rowClass = item.lane === "notice" ? " is-notice" : item.lane === "today" ? " is-today" : item.lane === "urgent" ? " is-urgent" : "";
  return `<article class="action-row${rowClass}"><span class="action-type">${actionTypeLabel(item)}</span><div><div class="action-row-title">${esc(item.title)}</div><div class="action-row-meta">${joinMeta([item.courseTitle, item.weekLabel])}</div></div><span class="action-due">${esc(actionDueText(item))}</span></article>`;
}

function actionLane(item: AssignmentItem | OnlineActionItem): ActionQueueItem["lane"] {
  if (isActionExpired(item)) return "urgent";
  if (isActionToday(item)) return "today";
  return "soon";
}

function isActionExpired(item: AssignmentItem | OnlineActionItem): boolean {
  if (item.isExpired === true) return true;
  return textIncludesAny([item.statusText, item.dueLabel], ["만료", "기한 지남", "overdue", "expired"]);
}

function isActionToday(item: AssignmentItem | OnlineActionItem): boolean {
  return item.priority === "high" || textIncludesAny([item.dueLabel, item.statusText], ["오늘", "today"]);
}

function actionLaneRank(item: ActionQueueItem): number {
  return { urgent: 0, today: 1, soon: 2, notice: 3 }[item.lane];
}

function actionPriorityRank(item: ActionQueueItem): number {
  return item.priority === "high" ? 0 : 1;
}

function actionDueRank(item: ActionQueueItem): number {
  if (item.source === "notice") return 9999 + item.order;

  if (item.dueAt) {
    const parsed = new Date(item.dueAt);
    if (!Number.isNaN(parsed.getTime())) {
      return (parsed.getMonth() + 1) * 100 + parsed.getDate();
    }
  }

  const label = (item.dueLabel || item.statusText || "").toLowerCase();
  if (label.includes("오늘") || label.includes("today")) return 0;
  if (label.includes("내일") || label.includes("tomorrow")) return 1;

  const koreanDate = label.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (koreanDate) return Number(koreanDate[1]) * 100 + Number(koreanDate[2]);

  const englishMayDate = label.match(/may\s+(\d{1,2})/);
  if (englishMayDate) return 500 + Number(englishMayDate[1]);

  const dDay = label.match(/d-(\d{1,2})/);
  if (dDay) return Number(dDay[1]);

  return 9999 + item.order;
}

function actionTypeLabel(item: ActionQueueItem): string {
  if (item.source === "online") return "영상";
  if (item.source === "notice") return "공지";
  return "과제";
}

function actionDueText(item: ActionQueueItem): string {
  if (item.source === "notice") return item.postedAt || "확인";
  return item.dueLabel || item.dueAt || item.statusText || (item.source === "online" ? "기한 확인" : "");
}

function actionReason(item: ActionQueueItem): string {
  if (item.lane === "urgent") return "기한 확인 필요";
  if (item.lane === "today") return "오늘 처리";
  if (item.source === "online") return "시청 필요";
  return "";
}

function textIncludesAny(values: Array<string | undefined>, needles: string[]): boolean {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  return needles.some((needle) => text.includes(needle.toLowerCase()));
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
