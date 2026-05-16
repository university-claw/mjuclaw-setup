import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";
import type { ViewEntry } from "./types";

/**
 * mjuclaw 웹뷰 렌더러 v2 — Apple Liquid Glass dark surface.
 *
 * 디자인 원칙:
 *   - 검정 배경 위에 떠 있는 유리 재질 레이어.
 *   - 캐릭터는 히어로 유리 렌즈와 상태 화면에서만 브랜드 오브젝트로 사용.
 *   - 섹션은 재질 깊이, 투명도, 내부 하이라이트로 구분.
 *   - 숫자와 상태는 tabular-nums 기반의 조용한 정보 계층.
 */

const DATA_TYPE_META: Record<string, { kicker: string; detail: string }> = {
  timetable: { kicker: "TIMETABLE", detail: "시간표" },
  "course-scores": { kicker: "COURSE SCORES", detail: "수강점수" },
  grades: { kicker: "GRADES", detail: "성적" },
  "grade-history": { kicker: "GRADE HISTORY", detail: "학기별 성적" },
  graduation: { kicker: "GRADUATION", detail: "졸업요건" },
  "action-items": { kicker: "TODAY'S BRIEFING", detail: "지금 할 일" },
  unsubmitted: { kicker: "ASSIGNMENTS", detail: "미제출 과제" },
  "unread-notices": { kicker: "NOTICES", detail: "LMS 공지" },
  attendance: { kicker: "ATTENDANCE", detail: "출석" },
  news: { kicker: "PUBLIC NOTICES", detail: "학교 공지" },
  "news-detail": { kicker: "NOTICE DETAIL", detail: "공지 상세" },
  cafeteria: { kicker: "CAFETERIA", detail: "학식" },
};

const DARKMODE_ASSET_BASE = "/static/darkmode";
const DARKMODE_MARK_ASSET = `${DARKMODE_ASSET_BASE}/myongmyong-darkmode-emote-00.png`;
const DARKMODE_HERO_ASSETS: Record<string, string> = {
  timetable: "myongmyong-darkmode-emote-01.png",
  "course-scores": "myongmyong-darkmode-emote-10.png",
  grades: "myongmyong-darkmode-emote-10.png",
  "grade-history": "myongmyong-darkmode-emote-01.png",
  graduation: "myongmyong-darkmode-emote-14.png",
  "action-items": "myongmyong-darkmode-emote-11.png",
  unsubmitted: "myongmyong-darkmode-emote-07.png",
  "unread-notices": "myongmyong-darkmode-emote-11.png",
  attendance: "myongmyong-darkmode-emote-15.png",
  news: "myongmyong-darkmode-emote-11.png",
  "news-detail": "myongmyong-darkmode-emote-11.png",
  cafeteria: "myongmyong-darkmode-emote-12.png",
};

function darkmodeAsset(fileName: string): string {
  return `${DARKMODE_ASSET_BASE}/${fileName}`;
}

function heroAssetFor(dataType: string): string {
  return darkmodeAsset(DARKMODE_HERO_ASSETS[dataType] ?? "myongmyong-darkmode-emote-00.png");
}

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
  if (entry.dataType !== "timetable" && entry.dataType !== "course-scores" && entry.dataType !== "grades" && entry.dataType !== "grade-history" && entry.dataType !== "graduation" && entry.dataType !== "action-items" && entry.dataType !== "unsubmitted" && entry.dataType !== "unread-notices" && entry.dataType !== "attendance" && entry.dataType !== "news" && entry.dataType !== "news-detail" && entry.dataType !== "cafeteria") {
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
  const displayTitle = displayTitleForEntry(entry);
  const heroSubHtml = renderHeroSub(entry, created, time);
  const heroAsset = heroAssetFor(entry.dataType);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#030405">
<title>${esc(displayTitle)} · 묭묭이</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
${pageStyles()}
</head>
<body>
${liquidGlassFilterDefs()}
<main class="page">
  <header class="topbar">
    <div class="brand">
      <div class="brand-chip" aria-hidden="true"><img src="${esc(DARKMODE_MARK_ASSET)}" alt=""></div>
      <span class="brand-name">묭묭이</span>
    </div>
    <div class="topbar-meta">
      <span class="kicker">${esc(meta.kicker)}</span>
    </div>
  </header>

  <section class="hero">
    <span class="glass-warp hero-warp" aria-hidden="true"></span>
    <div class="hero-copy">
      <div class="hero-eyebrow">${esc(meta.detail)}</div>
      <h1 class="hero-title">${esc(displayTitle)}</h1>
      <div class="hero-sub">
        ${heroSubHtml}
      </div>
    </div>
    <div class="hero-lens" aria-hidden="true">
      <img src="${esc(heroAsset)}" alt="">
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

function displayTitleForEntry(entry: ViewEntry): string {
  if (entry.dataType === "news-detail" && entry.rawData && typeof entry.rawData === "object" && !Array.isArray(entry.rawData)) {
    const title = (entry.rawData as { title?: unknown }).title;
    if (typeof title === "string" && title.trim()) return title.trim();
  }
  return entry.title;
}

function renderHeroSub(entry: ViewEntry, created: Date, createdLabel: string): string {
  if (entry.dataType === "news-detail" && entry.rawData && typeof entry.rawData === "object" && !Array.isArray(entry.rawData)) {
    const meta = noticeDetailMeta(entry.rawData as NoticeDetailData);
    if (meta) return meta;
  }

  return `<time datetime="${esc(created.toISOString())}">${esc(createdLabel)}</time>
      <span class="sep">·</span>
      <span>30분 후 만료</span>`;
}

function noticeDetailMeta(d: NoticeDetailData): string {
  const source = d.sourceName || (d.source && NEWS_SOURCE_LABEL[d.source]) || d.source || "";
  const dateLabel = d.publishedAt
    ? new Date(d.publishedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" })
    : "";
  return joinMeta([source, dateLabel, d.author, d.categoryLabel]);
}

export function renderExpiredHtml(): string {
  const mascotSrc = darkmodeAsset("myongmyong-darkmode-emote-09.png");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#030405">
<title>만료 · 묭묭이</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
${pageStyles()}
</head>
<body>
${liquidGlassFilterDefs()}
<main class="page page-center">
  <div class="expired">
    <span class="glass-warp expired-warp" aria-hidden="true"></span>
    <div class="expired-mascot" aria-hidden="true"><img src="${esc(mascotSrc)}" alt=""></div>
    <div class="hero-eyebrow">EXPIRED · 만료</div>
    <h1 class="hero-title">이 링크의 유효 시간이 지났어요</h1>
    <p class="expired-body">이 웹뷰는 조회 시점부터 30분간만 열람할 수 있어요.<br>Discord에서 묭묭이에게 다시 물어보면 새 링크를 보내드려요.</p>
  </div>
</main>
</body>
</html>`;
}

function liquidGlassFilterDefs(): string {
  return `<svg class="glass-filter-defs" aria-hidden="true" focusable="false">
  <defs>
    <filter id="mju-liquid-edge" x="-36%" y="-36%" width="172%" height="172%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.016 0.022" numOctaves="2" seed="11" result="DISPLACEMENT_MAP"/>
      <feMorphology in="SourceAlpha" operator="erode" radius="13" result="INNER_ALPHA"/>
      <feComposite in="SourceAlpha" in2="INNER_ALPHA" operator="out" result="EDGE_MASK"/>
      <feGaussianBlur in="EDGE_MASK" stdDeviation="1.3" result="SOFT_EDGE_MASK"/>
      <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER_ORIGINAL"/>

      <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale="-36" xChannelSelector="R" yChannelSelector="B" result="RED_DISPLACED"/>
      <feColorMatrix in="RED_DISPLACED" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="RED_CHANNEL"/>

      <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale="-32" xChannelSelector="R" yChannelSelector="B" result="GREEN_DISPLACED"/>
      <feColorMatrix in="GREEN_DISPLACED" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="GREEN_CHANNEL"/>

      <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale="-28" xChannelSelector="R" yChannelSelector="B" result="BLUE_DISPLACED"/>
      <feColorMatrix in="BLUE_DISPLACED" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="BLUE_CHANNEL"/>

      <feBlend in="GREEN_CHANNEL" in2="BLUE_CHANNEL" mode="screen" result="GB_COMBINED"/>
      <feBlend in="RED_CHANNEL" in2="GB_COMBINED" mode="screen" result="RGB_COMBINED"/>
      <feGaussianBlur in="RGB_COMBINED" stdDeviation="0.18" result="ABERRATED_BLURRED"/>
      <feComposite in="ABERRATED_BLURRED" in2="SOFT_EDGE_MASK" operator="in" result="EDGE_ABERRATION"/>
      <feComposite in="CENTER_ORIGINAL" in2="INNER_ALPHA" operator="in" result="CENTER_CLEAN"/>
      <feComposite in="EDGE_ABERRATION" in2="CENTER_CLEAN" operator="over"/>
    </filter>

    <filter id="mju-liquid-edge-soft" x="-28%" y="-28%" width="156%" height="156%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.018 0.026" numOctaves="2" seed="17" result="DISPLACEMENT_MAP"/>
      <feMorphology in="SourceAlpha" operator="erode" radius="9" result="INNER_ALPHA"/>
      <feComposite in="SourceAlpha" in2="INNER_ALPHA" operator="out" result="EDGE_MASK"/>
      <feGaussianBlur in="EDGE_MASK" stdDeviation="1" result="SOFT_EDGE_MASK"/>
      <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER_ORIGINAL"/>
      <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale="-18" xChannelSelector="R" yChannelSelector="B" result="EDGE_DISPLACED"/>
      <feComposite in="EDGE_DISPLACED" in2="SOFT_EDGE_MASK" operator="in" result="EDGE_REFRACTION"/>
      <feComposite in="CENTER_ORIGINAL" in2="INNER_ALPHA" operator="in" result="CENTER_CLEAN"/>
      <feComposite in="EDGE_REFRACTION" in2="CENTER_CLEAN" operator="over"/>
    </filter>
  </defs>
</svg>`;
}

function pageStyles(): string {
  return `<style>
:root {
  color-scheme: dark;

  --page-bg: #030405;
  --bg: #030405;
  --bg-alt: rgba(242, 247, 255, 0.055);
  --surface: rgba(242, 247, 255, 0.115);
  --surface-soft: rgba(242, 247, 255, 0.075);
  --surface-strong: rgba(242, 247, 255, 0.155);
  --glass: rgba(242, 247, 255, 0.118);
  --glass-strong: rgba(242, 247, 255, 0.172);
  --glass-soft: rgba(242, 247, 255, 0.078);
  --glass-deep: rgba(7, 13, 24, 0.58);
  --glass-border: rgba(255, 255, 255, 0.34);
  --glass-border-soft: rgba(255, 255, 255, 0.21);
  --glass-highlight: rgba(255, 255, 255, 0.54);
  --glass-lowlight: rgba(3, 6, 12, 0.52);
  --glass-blur: blur(34px) saturate(168%) contrast(108%);
  --glass-blur-soft: blur(20px) saturate(144%) contrast(104%);
  --glass-shadow: 0 26px 72px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.46), inset 0 -1px 0 rgba(0, 0, 0, 0.34);
  --glass-shadow-tight: 0 14px 38px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.34), inset 0 -1px 0 rgba(0, 0, 0, 0.26);
  --liquid-edge-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), inset 0 -1px 0 rgba(0, 0, 0, 0.62);
  --liquid-edge-shadow-soft: inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -1px 0 rgba(0, 0, 0, 0.50);
  --liquid-edge-filter: url(#mju-liquid-edge);
  --liquid-edge-filter-soft: url(#mju-liquid-edge-soft);
  --liquid-warp-bg: rgba(238, 246, 255, 0.132);
  --liquid-warp-bg-soft: rgba(238, 246, 255, 0.082);
  --ink: #F7FAFF;
  --ink-2: #C7D0DD;
  --ink-3: #8793A5;
  --rule: rgba(255, 255, 255, 0.145);
  --rule-strong: rgba(255, 255, 255, 0.27);
  --accent: #82A9FF;
  --accent-deep: #A9C4FF;
  --accent-bright: #C9D8FF;
  --accent-soft: rgba(130, 169, 255, 0.18);
  --accent-soft-2: rgba(130, 169, 255, 0.31);
  --chip-bg: rgba(242, 247, 255, 0.105);
  --green: #4BD18B;
  --red: #FF6B73;
  --warn: #E5B84C;
  --warn-soft: rgba(229, 184, 76, 0.12);
  --green-soft: rgba(75, 209, 139, 0.12);
  --red-soft: rgba(255, 107, 115, 0.12);

  --radius-sm: 12px;
  --radius-md: 22px;
  --radius-lg: 34px;
  --radius-pill: 999px;

  --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Pretendard Variable', Pretendard, 'Inter', 'Apple SD Gothic Neo', system-ui, sans-serif;
  --font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

.glass-filter-defs {
  position: fixed;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}

html, body {
  background: var(--page-bg);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.55;
  letter-spacing: 0;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 0 20px 68px;
  overflow-x: hidden;
  background: var(--page-bg);
  isolation: isolate;
}

.glass-warp {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: var(--liquid-warp-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  filter: var(--liquid-edge-filter);
  transform: translateZ(0);
  z-index: 0;
}

.hero > .glass-warp,
.expired > .expired-warp {
  position: absolute;
  z-index: 0;
}

.page {
  position: relative;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  overflow: visible;
}
.page-center { min-height: 80vh; display: flex; align-items: center; justify-content: center; }

/* Topbar */
.topbar {
  position: sticky;
  top: 10px;
  z-index: 5;
  margin: 12px -2px 0;
  padding: 10px 12px 10px 10px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  border: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-pill);
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: var(--liquid-edge-shadow-soft);
  overflow: hidden;
  isolation: isolate;
}
.topbar::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: var(--liquid-warp-bg-soft);
  backdrop-filter: var(--glass-blur-soft);
  -webkit-backdrop-filter: var(--glass-blur-soft);
  filter: var(--liquid-edge-filter-soft);
  pointer-events: none;
  z-index: 0;
}
.brand { display: flex; align-items: center; gap: 9px; }
.brand,
.topbar-meta {
  position: relative;
  z-index: 2;
}
.brand-chip {
  width: 31px; height: 31px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.12); color: var(--ink);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.20);
  font-size: 14px; font-weight: 700; letter-spacing: 0;
}
.brand-chip img {
  width: 112%;
  height: 112%;
  object-fit: contain;
  display: block;
  opacity: 0.9;
}
.brand-name {
  font-size: 14px; font-weight: 760; color: var(--ink);
  letter-spacing: 0;
}
.topbar-meta { min-width: 0; overflow: hidden; }
.kicker {
  display: block;
  font-size: 11px; font-weight: 600;
  color: var(--ink-2);
  letter-spacing: 0; text-transform: uppercase;
  max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 4px 9px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.11);
}

/* Hero */
.hero {
  position: relative;
  min-height: 238px;
  margin-top: 16px;
  padding: 31px 26px 28px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: var(--liquid-edge-shadow);
  overflow: hidden;
  isolation: isolate;
}
.hero-warp {
  background: rgba(238, 246, 255, 0.148);
}
.hero-copy {
  position: relative;
  z-index: 2;
  max-width: min(100%, 390px);
}
.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 11px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.085);
  color: var(--accent-bright);
  font-size: 12px; font-weight: 760; margin-bottom: 18px;
}
.hero-title {
  max-width: 11em;
  font-size: 38px; font-weight: 790; color: var(--ink);
  letter-spacing: 0; line-height: 1.08; word-break: keep-all;
  text-wrap: balance; margin-bottom: 14px;
}
.hero-sub {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  font-size: 13px; color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}
.hero-sub .sep { color: var(--rule-strong); }
.hero-lens {
  position: absolute;
  right: -8px;
  bottom: -24px;
  width: 178px;
  height: 178px;
  border-radius: 46px;
  border: 0;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
  transform: rotate(-7deg);
  z-index: 1;
}
.hero-lens img {
  position: absolute;
  left: 20px;
  bottom: 14px;
  width: 133px;
  height: 133px;
  object-fit: contain;
  transform: rotate(7deg);
}

/* Briefing (AI summary) */
.briefing {
  margin: 22px 0 0;
  padding: 18px 18px 19px;
  border: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-md);
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: var(--liquid-edge-shadow);
  position: relative;
}
.briefing-label {
  font-size: 12px; font-weight: 700;
  color: var(--accent); letter-spacing: 0;
  margin-bottom: 10px;
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
.section {
  position: relative;
  margin: 28px 0 0;
  padding: 0;
  border-top: none;
  background: transparent;
}
.section-title {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 6px;
}
.section-title h2 {
  font-size: 17px; font-weight: 760; color: var(--ink);
  letter-spacing: 0;
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
  padding: 16px 0; border-bottom: 1px solid var(--rule);
}
.row:last-child { border-bottom: none; }
.row-icon {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--chip-bg); color: var(--ink-2);
  display: flex; align-items: center; justify-content: center;
  font-size: 11.5px; font-weight: 700; letter-spacing: 0;
  flex: 0 0 34px;
}
.row-icon.accent { background: var(--accent-soft); color: var(--accent); }
.row-icon.green { background: var(--green-soft); color: var(--green); }
.row-icon.red { background: var(--red-soft); color: var(--red); }
.row-icon.warn { background: var(--warn-soft); color: var(--warn); }
.row-main { min-width: 0; }
.row-title {
  font-size: 14.5px; font-weight: 600; color: var(--ink);
  letter-spacing: 0; line-height: 1.35;
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

/* LMS unread notices */
.unread-notice-overview {
  padding: 20px 0 2px;
  border-bottom: 1px solid var(--rule);
}
.unread-overview-line {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
}
.unread-overview-count {
  color: var(--ink);
  font-size: 15.5px;
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: 0;
}
.unread-overview-count strong {
  color: var(--accent);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.unread-overview-meta {
  color: var(--ink-3);
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.unread-overview-note {
  margin-top: 6px;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  word-break: keep-all;
}
.unread-notice-section {
  padding-top: 24px;
}
.unread-notice-section .section-title {
  margin-bottom: 8px;
}
.unread-notice-list {
  border-top: 1px solid var(--rule-strong);
}
.unread-notice-row {
  padding: 15px 0 16px;
  border-bottom: 1px solid var(--rule);
}
.unread-notice-row:last-child {
  border-bottom: none;
}
.unread-notice-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.notice-course-pill {
  display: inline-flex;
  align-items: center;
  max-width: 68%;
  min-height: 24px;
  padding: 0 9px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11.5px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.notice-posted {
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.unread-notice-title {
  margin-top: 8px;
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: var(--ink);
  font-size: 15px;
  font-weight: 800;
  line-height: 1.38;
  letter-spacing: 0;
  word-break: keep-all;
}
.unread-dot {
  width: 7px;
  height: 7px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--accent);
  flex: 0 0 7px;
}
.unread-notice-preview {
  margin-top: 6px;
  color: var(--ink-2);
  font-size: 12.8px;
  font-weight: 500;
  line-height: 1.58;
  word-break: keep-all;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

/* Cafeteria */
.cafeteria-section .section-title {
  margin-bottom: 10px;
}
.cafeteria-table {
  border-top: 1px solid var(--rule-strong);
}
.cafeteria-table-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 14px 0;
  border-bottom: 1px solid var(--rule);
}
.cafeteria-table-row:last-child {
  border-bottom: none;
}
.cafeteria-place {
  color: var(--accent-deep);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: 0;
  word-break: keep-all;
}
.cafeteria-menu {
  min-width: 0;
}
.cafeteria-menu-text {
  color: var(--ink);
  font-size: 14px;
  font-weight: 750;
  line-height: 1.48;
  letter-spacing: 0;
  word-break: keep-all;
}
.cafeteria-menu-note {
  margin-top: 4px;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  word-break: keep-all;
}
.cafeteria-price {
  color: var(--green);
  font-size: 12.5px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-align: right;
}
.cafeteria-table-row.is-empty .cafeteria-place,
.cafeteria-table-row.is-closed .cafeteria-place {
  color: var(--ink-3);
}
.cafeteria-table-row.is-empty .cafeteria-menu-text,
.cafeteria-table-row.is-closed .cafeteria-menu-text {
  color: var(--ink-3);
  font-weight: 650;
}
.cafeteria-table-row.is-closed .cafeteria-price {
  color: var(--ink-3);
}

/* News search results */
.news-list-section {
  padding-top: 22px;
}
.news-row .row-title {
  align-items: flex-start;
}
.news-row .row-title a {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal;
  overflow: hidden;
}

/* News detail */
.notice-detail-source {
  padding: 16px 0 0;
}
.notice-source-link {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 34px; padding: 0 12px;
  border: 1px solid var(--accent-soft-2);
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 13px; font-weight: 700;
  text-decoration: none;
}
.notice-body-section { padding-top: 24px; }
.notice-body {
  margin-top: 10px;
  color: var(--ink-2);
  font-size: 15.5px;
  line-height: 1.82;
  word-break: keep-all;
}
.notice-attachments-section { padding-top: 28px; }
.notice-attachment-row {
  align-items: center;
}
.notice-attachment-row .row-icon {
  font-size: 10px;
  letter-spacing: 0;
}
.notice-attachment-row .row-title a {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  word-break: keep-all;
}
.notice-download {
  color: var(--accent);
  text-decoration: none;
  font-size: 12.5px;
  font-weight: 800;
}
.notice-download.muted {
  color: var(--ink-3);
  font-weight: 700;
}
.notice-preview {
  margin-top: 8px;
}
.notice-preview.muted {
  color: var(--ink-3);
}
.notice-ocr-section {
  padding-top: 24px;
}
.notice-ocr-text {
  margin-top: 10px;
  padding-left: 10px;
  border-left: 2px solid var(--rule);
  color: var(--ink-3);
  font-size: 12.5px;
  line-height: 1.65;
  word-break: keep-all;
}

/* Unsubmitted assignments */
.unsubmitted-summary {
  margin-top: 18px;
}
.unsubmitted-band {
  padding: 15px;
  border: 1px solid var(--red-soft);
  border-radius: var(--radius-md);
  background: var(--bg-alt);
}
.unsubmitted-band-top,
.unsubmitted-band-bottom {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 14px;
}
.unsubmitted-band-kicker {
  color: var(--red); font-size: 11px; font-weight: 800;
  letter-spacing: 0; text-transform: uppercase;
}
.unsubmitted-band-main {
  margin-top: 4px; color: var(--ink);
  font-size: 22px; line-height: 1.18; font-weight: 800;
  letter-spacing: 0; word-break: keep-all;
}
.unsubmitted-band-urgent {
  flex: 0 0 auto;
  padding: 5px 9px;
  border-radius: var(--radius-pill);
  background: var(--bg); color: var(--red);
  font-size: 12px; font-weight: 800;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.unsubmitted-band-bottom {
  margin-top: 11px; padding-top: 10px;
  border-top: 1px solid rgba(207, 32, 47, 0.14);
  align-items: center;
}
.unsubmitted-band-note {
  color: var(--ink-2); font-size: 12.5px; font-weight: 700;
  word-break: keep-all;
}
.unsubmitted-band-due {
  color: var(--red); font-size: 12.5px; font-weight: 800;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.unsubmitted-lane { padding-top: 22px; }
.unsubmitted-lane .section-title { margin-bottom: 2px; }
.assignment-row.is-urgent .row-icon {
  background: var(--red-soft); color: var(--red);
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
  color: var(--red); letter-spacing: 0; text-transform: uppercase;
}
.urgent-title {
  font-size: 14.5px; font-weight: 600; color: var(--ink);
  letter-spacing: 0; margin-top: 2px;
}
.urgent-meta { font-size: 12px; color: var(--ink-3); }

/* Action queue */
.action-next {
  margin-top: 12px;
  padding: 17px 16px;
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.action-next.is-urgent {
  border-color: var(--red-soft);
  background: var(--surface);
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
  font-size: 11px; font-weight: 800; letter-spacing: 0;
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
  letter-spacing: 0; word-break: keep-all;
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
  background: var(--surface);
  padding: 18px 16px;
}
.grades-snapshot-top {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px;
}
.grades-label {
  color: var(--accent); font-size: 11px; font-weight: 700;
  letter-spacing: 0; text-transform: uppercase;
}
.grades-gpa {
  margin-top: 7px;
  color: var(--ink); font-size: 34px; line-height: 1; font-weight: 700;
  letter-spacing: 0; font-variant-numeric: tabular-nums;
}
.grades-gpa .unit {
  color: var(--ink-3); font-size: 16px; font-weight: 600;
  letter-spacing: 0;
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
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px; margin-top: 12px;
}
.grades-stat {
  min-width: 0; min-height: 38px; padding: 8px 10px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-sm);
  background: var(--bg);
}
.grades-stat strong {
  display: block; color: var(--ink);
  font-size: 14px; line-height: 1.1; font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.grades-stat span {
  display: block; margin-top: 0;
  color: var(--ink-3); font-size: 10.5px; font-weight: 650;
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
  background: var(--surface-soft);
}
.grade-course-card.top {
  border-color: var(--accent-soft-2);
  background: var(--surface);
}
.grade-course-main { min-width: 0; }
.grade-course-title {
  color: var(--ink); font-size: 14px; font-weight: 700;
  line-height: 1.35; letter-spacing: 0; word-break: keep-all;
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

/* Course scores */
.course-score-detail-section {
  padding-top: 22px;
}
.course-score-summary {
  margin-top: 22px;
  padding: 18px 16px 16px;
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.course-score-summary-label {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  line-height: 1;
  font-weight: 850;
}
.course-score-summary-main {
  margin-top: 11px;
  color: var(--ink);
  font-size: 20px;
  line-height: 1.25;
  font-weight: 850;
  word-break: keep-all;
}
.course-score-summary-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}
.course-score-summary-stat {
  min-width: 0;
  min-height: 56px;
  padding: 10px 11px;
  border-radius: var(--radius-sm);
  background: var(--bg);
}
.course-score-summary-stat strong {
  display: block;
  color: var(--ink);
  font-size: 17px;
  line-height: 1;
  font-weight: 850;
  font-variant-numeric: tabular-nums;
}
.course-score-summary-stat span {
  display: block;
  margin-top: 6px;
  color: var(--ink-3);
  font-size: 10.5px;
  line-height: 1.25;
  font-weight: 750;
  word-break: keep-all;
}
.course-score-course-list {
  margin-top: 18px;
  border-top: 1px solid var(--rule-strong);
}
.course-score-course {
  margin-top: 16px;
  padding: 16px;
  border-top: 1px solid var(--rule);
  border-radius: var(--radius-md);
  background: var(--bg-alt);
}
.course-score-course:first-child { border-top: none; }
.course-score-course-head {
  margin-bottom: 14px;
  padding-bottom: 11px;
  border-bottom: 1px solid var(--rule-strong);
}
.course-score-course-title {
  min-width: 0;
  color: var(--ink); font-size: 16px; line-height: 1.3; font-weight: 850;
  word-break: keep-all;
}
.course-score-row {
  padding: 13px 0;
  border-top: 1px solid var(--rule);
}
.course-score-row:first-of-type { border-top: none; padding-top: 0; }
.course-score-row-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12px;
}
.course-score-title {
  color: var(--ink); font-size: 14px; line-height: 1.35; font-weight: 750;
  word-break: keep-all;
}
.course-score-category {
  margin-top: 4px;
  color: var(--ink-3); font-size: 12px; font-weight: 600;
  word-break: keep-all;
}
.course-score-metrics {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px; margin-top: 10px;
}
.course-score-metric {
  min-width: 0;
  padding: 8px 9px;
  border-radius: var(--radius-sm);
  background: var(--bg);
}
.course-score-metric-label {
  color: var(--ink-3); font-size: 10.5px; font-weight: 700;
}
.course-score-metric-value {
  margin-top: 4px;
  color: var(--ink); font-size: 12.5px; font-weight: 800;
  font-variant-numeric: tabular-nums;
  word-break: keep-all;
}
.course-score-empty {
  margin-top: 18px;
  padding: 16px 0;
  border-top: 1px solid var(--rule-strong);
  color: var(--ink-3);
  font-size: 13px;
  font-weight: 650;
}

@media (max-width: 420px) {
  .course-score-course {
    padding: 14px;
  }
  .course-score-summary-meta {
    gap: 6px;
  }
  .course-score-metrics {
    grid-template-columns: 1fr;
  }
}

/* Grade history */
.history-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) repeat(2, minmax(0, 0.8fr));
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--rule-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.history-overview-item {
  min-width: 0;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--bg);
}
.history-overview-item.primary {
  background: var(--ink);
  color: var(--bg);
}
.history-overview-label {
  color: var(--ink-3);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
  white-space: nowrap;
}
.history-overview-item.primary .history-overview-label {
  color: var(--bg);
  opacity: 0.72;
}
.history-overview-value {
  margin-top: 7px;
  color: var(--ink);
  font-size: 20px;
  line-height: 1;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.history-overview-item.primary .history-overview-value {
  color: var(--bg);
  font-size: 28px;
  letter-spacing: 0;
}
.history-flow {
  padding: 15px 14px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  background: var(--bg);
}
.history-flow-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.history-flow-title {
  color: var(--ink);
  font-size: 15px;
  font-weight: 800;
}
.history-flow-scale {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.history-flow-chart {
  height: 146px;
  margin-top: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}
.history-flow-chart::-webkit-scrollbar { display: none; }
.history-flow-plot {
  position: relative;
  width: 100%;
  min-width: var(--plot-min-width);
  height: 100%;
}
.history-flow-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.history-flow-grid {
  stroke: var(--rule);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.history-flow-area {
  fill: var(--accent-soft);
  opacity: 0.78;
}
.history-flow-line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
.history-flow-value {
  position: absolute;
  left: var(--point-x);
  top: calc(var(--point-y) - 25px);
  transform: translateX(-50%);
  color: var(--ink);
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.history-flow-point {
  position: absolute;
  left: var(--point-x);
  top: var(--point-y);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--bg);
  border: 3px solid var(--accent);
  outline: 4px solid var(--accent-soft);
  transform: translate(-50%, -50%);
}
.history-flow-point.latest {
  width: 14px;
  height: 14px;
  background: var(--accent);
}
.history-flow-term {
  position: absolute;
  left: var(--point-x);
  bottom: 0;
  transform: translateX(-50%);
  color: var(--ink-3);
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
}
.history-term-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}
.history-term-card {
  padding: 14px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  background: var(--bg);
}
.history-term-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.history-term-title {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--ink);
  font-size: 16px;
  line-height: 1.3;
  font-weight: 800;
  word-break: keep-all;
}
.history-term-summary {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.2;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.history-term-summary .average {
  color: var(--accent);
  font-weight: 850;
}
.history-term-summary .sep { color: var(--rule-strong); margin: 0 5px; }
.history-course-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.history-course-card {
  padding: 11px 12px;
}
.history-grade-pill {
  color: var(--ink-2);
  background: var(--chip-bg);
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
  font-size: 11px; font-weight: 700; letter-spacing: 0;
}
.focus-title {
  margin-top: 12px;
  font-size: 22px; line-height: 1.22; font-weight: 700;
  color: var(--ink); letter-spacing: 0; word-break: keep-all;
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
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
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
  font-size: 12px; font-weight: 700; letter-spacing: 0;
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
  color: var(--ink); font-size: 16px; font-weight: 700; letter-spacing: 0;
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
  letter-spacing: 0; word-break: keep-all;
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
  background: var(--surface);
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
  .topbar {
    margin-left: -16px;
    margin-right: -16px;
    padding-left: 16px;
    padding-right: 16px;
  }
  .topbar-meta { display: none; }
  .hero {
    padding: 24px 20px 23px;
    border-radius: 18px;
  }
  .hero-title { font-size: 30px; }
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
  letter-spacing: 0; margin-top: 6px; line-height: 1.05;
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
  margin-top: 3px; letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

/* Attendance */
.attendance-summary {
  padding-top: 24px;
}
.attendance-briefing {
  padding: 2px 0 4px;
}
.attendance-course {
  color: var(--ink);
  font-size: 15px;
  line-height: 1.35;
  font-weight: 700;
  letter-spacing: 0;
  word-break: keep-all;
}
.attendance-counts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-top: 14px;
  padding: 15px 0 12px;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
}
.attendance-count {
  min-width: 0;
}
.attendance-count span {
  display: block;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 700;
}
.attendance-count strong {
  display: block;
  margin-top: 4px;
  color: var(--ink);
  font-size: 34px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}
.attendance-count.danger strong {
  color: var(--red);
}
.attendance-count.warn strong {
  color: var(--warn);
}
.attendance-count .unit {
  display: inline;
  margin-left: 2px;
  color: currentColor;
  font-size: 15px;
  font-weight: 800;
}
.attendance-support {
  margin-top: 10px;
  color: var(--ink-3);
  font-size: 12.5px;
  font-weight: 600;
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
  letter-spacing: 0; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.ring-pct .u { font-size: 16px; color: var(--ink-3); font-weight: 600; }
.ring-cap {
  font-size: 10px; color: var(--ink-3); margin-top: 4px;
  letter-spacing: 0; text-transform: uppercase; font-weight: 600;
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
  letter-spacing: 0; white-space: nowrap;
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
  letter-spacing: 0; text-decoration: none;
}
.cta-pill.primary { background: var(--accent); color: #F4F8FF; }
.cta-pill.secondary { background: var(--accent-soft); color: var(--accent); }

/* Raw JSON fallback */
.raw-json {
  font-family: var(--font-mono); font-size: 12px; line-height: 1.55;
  color: var(--ink-2); background: var(--chip-bg);
  border-radius: var(--radius-md); padding: 14px 16px;
  overflow-x: auto; white-space: pre-wrap; word-break: break-all;
}

/* Liquid glass surface pass */
.grades-snapshot,
.grade-course-card,
.course-score-summary,
.course-score-course,
.history-overview,
.history-flow,
.history-term-card,
.timetable-focus,
.weekday-tab,
.timeline-card,
.timeline-empty,
.action-next,
.urgent-card,
.unsubmitted-band,
.ring-card,
.raw-json {
  border-color: var(--glass-border);
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.grades-stat,
.course-score-metric,
.course-score-summary-stat,
.history-overview-item {
  border-color: var(--glass-border-soft);
  background: rgba(2, 3, 4, 0.36);
}
.grade-course-card.top,
.timeline-course.is-next .timeline-card {
  border-color: var(--accent-soft-2);
  background: transparent;
}
.history-overview-item.primary {
  background: rgba(244, 247, 251, 0.92);
  border-color: transparent;
  color: var(--bg);
}

/* Apple-style liquid material pass */
.section {
  margin-top: 34px;
}
.section-title {
  margin: 0 2px 10px;
}
.section-title h2 {
  font-size: 19px;
  font-weight: 780;
}
.section-title .count {
  color: var(--ink-3);
  font-weight: 680;
}
.section-sub {
  margin: 0 2px 14px;
  color: var(--ink-3);
  font-size: 12.5px;
  font-weight: 620;
}

.briefing,
.grades-snapshot,
.course-score-summary,
.course-score-course,
.history-overview,
.history-flow,
.history-term-card,
.timetable-focus,
.timeline-card,
.timeline-empty,
.action-next,
.urgent-card,
.unsubmitted-band,
.ring-card,
.raw-json,
.attendance-briefing,
.notice-body {
  border: 1px solid var(--glass-border);
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: var(--liquid-edge-shadow);
}

.briefing,
.course-score-summary,
.history-flow,
.timetable-focus,
.action-next,
.unsubmitted-band,
.raw-json,
.attendance-briefing,
.notice-body {
  border-radius: 30px;
}

.grades-snapshot {
  border-radius: 38px;
  padding: 26px 24px 24px;
  min-height: 258px;
}
.grades-label {
  color: var(--accent-bright);
  font-size: 12px;
  font-weight: 820;
}
.grades-gpa {
  margin-top: 10px;
  font-size: 54px;
  font-weight: 820;
}
.grades-gpa .unit {
  font-size: 19px;
  color: var(--ink-2);
}
.grades-scale {
  color: var(--ink-2);
  font-weight: 680;
}
.grades-level {
  min-width: 62px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.86);
  color: var(--bg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}
.grades-gpa-segments {
  height: 16px;
  gap: 6px;
}
.grades-gpa-segment {
  background: rgba(255, 255, 255, 0.13);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.20);
}
.grades-gpa-segment.stable { background: rgba(255, 255, 255, 0.18); }
.grades-gpa-segment.strong { background: rgba(130, 169, 255, 0.30); }
.grades-gpa-segment.top { background: rgba(130, 169, 255, 0.82); }
.grades-gpa-marker strong {
  background: rgba(255, 255, 255, 0.92);
  color: var(--bg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}
.grades-gpa-marker span {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.78);
}
.grades-stats {
  gap: 10px;
  margin-top: 16px;
}
.grades-stat,
.course-score-metric,
.course-score-summary-stat,
.history-overview-item {
  border: 1px solid var(--glass-border-soft);
  border-radius: 18px;
  background: rgba(2, 5, 10, 0.38);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.grade-course-list,
.course-score-course-list,
.history-term-list,
.ring-grid,
.action-list,
.unread-notice-list,
.cafeteria-table,
.grad-shortage-list {
  border: 1px solid var(--glass-border-soft);
  border-radius: 30px;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: var(--liquid-edge-shadow-soft);
  padding: 8px;
}
.grade-course-list,
.history-term-list,
.ring-grid {
  gap: 8px;
}
.action-list {
  margin-top: 12px;
  border-top: 1px solid var(--glass-border-soft);
}
.course-score-course-list {
  border-top: 1px solid var(--glass-border-soft);
}

.grade-course-card,
.history-term-card,
.course-score-course,
.ring-card,
.row,
.action-row,
.unread-notice-row,
.cafeteria-table-row,
.grad-shortage-row {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 22px;
  background: transparent;
  box-shadow: var(--liquid-edge-shadow-soft);
}
.grade-course-card,
.row,
.action-row,
.unread-notice-row,
.cafeteria-table-row,
.grad-shortage-row {
  padding: 15px 16px;
}
.grade-course-card.top,
.timeline-course.is-next .timeline-card,
.action-next.is-urgent {
  border-color: rgba(130, 169, 255, 0.44);
  background: transparent;
}
.timeline-course.is-live .timeline-card {
  border-color: rgba(75, 209, 139, 0.46);
  background: transparent;
}

.grade-pill,
.badge,
.action-type,
.notice-course-pill,
.focus-kicker,
.today-chip,
.status-pill,
.notice-source-link,
.focus-place {
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.105);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
}
.grade-pill.high,
.badge-blue,
.action-row.is-notice .action-type,
.notice-course-pill,
.status-pill.next,
.focus-kicker,
.today-chip {
  color: var(--accent-bright);
  background: rgba(130, 169, 255, 0.20);
}
.grade-pill.mid {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.12);
}
.badge-red,
.action-next.is-urgent .action-type,
.action-row.is-urgent .action-type,
.action-row.is-today .action-type {
  color: var(--red);
  background: rgba(255, 107, 115, 0.16);
}

.timetable-focus {
  padding: 24px;
}
.focus-title {
  font-size: 29px;
  font-weight: 800;
}
.weekday-tabs {
  position: relative;
  top: auto;
  gap: 7px;
  margin: 18px -2px 24px;
  padding: 8px;
  border: 1px solid var(--glass-border-soft);
  border-radius: 26px;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: var(--liquid-edge-shadow-soft);
}
.weekday-tab {
  border-color: rgba(255, 255, 255, 0.11);
  border-radius: 20px;
  background: transparent;
  box-shadow: var(--liquid-edge-shadow-soft);
}
.weekday-tab.active {
  background: rgba(255, 255, 255, 0.90);
  border-color: rgba(255, 255, 255, 0.88);
  color: var(--bg);
}

.timeline-list::before {
  background: rgba(255, 255, 255, 0.18);
}
.timeline-card {
  border-radius: 26px;
  padding: 16px;
}
.timeline-time::after,
.history-flow-point {
  background: rgba(255, 255, 255, 0.85);
}

.history-overview {
  border-radius: 30px;
}
.history-overview-item.primary {
  background: rgba(255, 255, 255, 0.90);
  color: var(--bg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.70);
}
.history-flow-area {
  fill: rgba(130, 169, 255, 0.20);
}

.notice-body {
  display: block;
  padding: 22px;
}
.notice-body-section .notice-body {
  margin-top: 12px;
}
.attendance-briefing {
  padding: 22px;
}

.expired {
  position: relative;
  max-width: 420px;
  padding: 30px 28px 28px;
  border: 1px solid var(--glass-border);
  border-radius: 38px;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: var(--liquid-edge-shadow);
  overflow: hidden;
}
.expired-mascot {
  position: relative;
  z-index: 1;
  width: 118px;
  height: 118px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 34px;
  background: rgba(255, 255, 255, 0.10);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 18px 42px rgba(0, 0, 0, 0.38);
}

.briefing,
.grades-snapshot,
.grade-course-list,
.grade-course-card,
.course-score-summary,
.course-score-course-list,
.course-score-course,
.history-overview,
.history-flow,
.history-term-list,
.history-term-card,
.timetable-focus,
.weekday-tabs,
.weekday-tab,
.timeline-card,
.timeline-empty,
.action-next,
.action-list,
.action-row,
.unread-notice-list,
.unread-notice-row,
.unsubmitted-band,
.ring-grid,
.ring-card,
.cafeteria-table,
.cafeteria-table-row,
.grad-shortage-list,
.grad-shortage-row,
.raw-json,
.attendance-briefing,
.notice-body,
.expired {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}

.briefing::before,
.grades-snapshot::before,
.grade-course-list::before,
.course-score-summary::before,
.course-score-course-list::before,
.course-score-course::before,
.history-overview::before,
.history-flow::before,
.history-term-list::before,
.history-term-card::before,
.timetable-focus::before,
.weekday-tabs::before,
.timeline-card::before,
.timeline-empty::before,
.action-next::before,
.action-list::before,
.unread-notice-list::before,
.unsubmitted-band::before,
.ring-grid::before,
.ring-card::before,
.cafeteria-table::before,
.grad-shortage-list::before,
.raw-json::before,
.attendance-briefing::before,
.notice-body::before,
.expired-warp {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: var(--liquid-warp-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  filter: var(--liquid-edge-filter);
  pointer-events: none;
  z-index: 0;
}

.grade-course-card::before,
.weekday-tab::before,
.action-row::before,
.unread-notice-row::before,
.cafeteria-table-row::before,
.grad-shortage-row::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: var(--liquid-warp-bg-soft);
  backdrop-filter: var(--glass-blur-soft);
  -webkit-backdrop-filter: var(--glass-blur-soft);
  filter: var(--liquid-edge-filter-soft);
  pointer-events: none;
  z-index: 0;
}

.briefing > *,
.grades-snapshot > *,
.grade-course-list > *,
.grade-course-card > *,
.course-score-summary > *,
.course-score-course-list > *,
.course-score-course > *,
.history-overview > *,
.history-flow > *,
.history-term-list > *,
.history-term-card > *,
.timetable-focus > *,
.weekday-tabs > *,
.weekday-tab > *,
.timeline-card > *,
.timeline-empty > *,
.action-next > *,
.action-list > *,
.action-row > *,
.unread-notice-list > *,
.unread-notice-row > *,
.unsubmitted-band > *,
.ring-grid > *,
.ring-card > *,
.cafeteria-table > *,
.cafeteria-table-row > *,
.grad-shortage-list > *,
.grad-shortage-row > *,
.raw-json > *,
.attendance-briefing > *,
.notice-body > *,
.expired > * {
  position: relative;
  z-index: 2;
}

.hero > .glass-warp,
.expired > .expired-warp {
  position: absolute;
  z-index: 0;
}

@media (max-width: 480px) {
  body {
    padding-left: 16px;
    padding-right: 16px;
  }
  .topbar {
    top: 8px;
    margin-left: 0;
    margin-right: 0;
    padding-left: 10px;
    padding-right: 12px;
  }
  .hero {
    min-height: 234px;
    padding: 28px 22px 26px;
    border-radius: 34px;
  }
  .hero-title {
    max-width: 8.7em;
    font-size: 34px;
  }
  .hero-copy {
    max-width: 300px;
  }
  .hero-lens {
    width: 148px;
    height: 148px;
    right: -12px;
    bottom: -28px;
    border-radius: 40px;
    opacity: 0.92;
  }
  .hero-lens img {
    width: 112px;
    height: 112px;
    left: 18px;
    bottom: 12px;
  }
  .grades-snapshot {
    padding: 24px 18px 20px;
  }
  .grades-gpa {
    font-size: 46px;
  }
  .grade-course-list,
  .course-score-course-list,
  .history-term-list,
  .ring-grid,
  .action-list,
  .unread-notice-list,
  .cafeteria-table,
  .grad-shortage-list {
    border-radius: 26px;
  }
  .weekday-tabs {
    top: auto;
    border-radius: 24px;
  }
}

@media (max-width: 360px) {
  .hero {
    min-height: 258px;
  }
  .hero-copy {
    max-width: 214px;
  }
  .hero-title {
    max-width: 7.1em;
    font-size: 31px;
  }
  .hero-sub {
    max-width: 184px;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .hero-sub .sep {
    display: none;
  }
  .hero-lens {
    width: 134px;
    height: 134px;
    right: -34px;
    bottom: -46px;
    border-radius: 36px;
    opacity: 0.78;
  }
  .hero-lens img {
    width: 98px;
    height: 98px;
    left: 16px;
    bottom: 11px;
  }
}

/* Footer */
.footer {
  margin-top: 48px; padding-top: 20px;
  border-top: 1px solid var(--rule);
  text-align: center; font-size: 12px; color: var(--ink-3);
  letter-spacing: 0;
}

/* Expired */
.expired { text-align: left; max-width: 380px; }
.expired-mascot {
  width: 108px;
  height: 108px;
  margin-bottom: 18px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  pointer-events: none;
}
.expired-mascot img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
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
    "course-scores": renderCourseScores,
    grades: renderGrades,
    "grade-history": renderGradeHistory,
    graduation: renderGraduation,
    "action-items": renderActionItems,
    unsubmitted: renderUnsubmittedAssignments,
    "unread-notices": renderUnreadNoticeList,
    attendance: renderAttendanceText,
    news: renderNewsList,
    "news-detail": renderNewsDetail,
    cafeteria: renderCafeteriaTable,
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

type AssignmentDeadlineGroup = {
  key: "expired" | "today" | "tomorrow" | "week" | "later" | "unknown";
  title: string;
  items: AssignmentItem[];
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
  const levelText = typeof d.gpa === "number" ? gpaBandName(d.gpa) : "GPA";
  const scaleText = typeof d.gpa === "number" ? gpaBandDescription(d.gpa) : "GPA 구간 기준";

  let html = `<section class="section grades-section">`;
  html += `<div class="grades-snapshot">`;
  html += `<div class="grades-snapshot-top"><div><div class="grades-label">이번 학기 GPA</div><div class="grades-gpa">${gpaText}${typeof d.gpa === "number" ? `<span class="unit"> / ${maxGpa.toFixed(2)}</span>` : ""}</div><div class="grades-scale">${esc(scaleText)}</div></div><div class="grades-level">${esc(levelText)}</div></div>`;
  html += `<div class="grades-gpa-graph"><div class="grades-gpa-rail" style="--gpa-marker:${markerPercent.toFixed(1)}%"><div class="grades-gpa-marker"><strong>${esc(gpaText)}</strong><span></span></div><div class="grades-gpa-segments" aria-label="GPA band rail"><span class="grades-gpa-segment low"></span><span class="grades-gpa-segment stable"></span><span class="grades-gpa-segment strong"></span><span class="grades-gpa-segment top"></span></div><div class="grades-gpa-band-labels"><span>3.0 미만</span><span>3.0+</span><span>3.5+</span><span>4.0+</span></div></div></div>`;
  html += `<div class="grades-stats">`;
  html += `<div class="grades-stat"><strong>${totalCredits || "-"}</strong><span>이수 학점</span></div>`;
  html += `<div class="grades-stat"><strong>${courseCount}</strong><span>과목</span></div>`;
  html += `</div></div>`;
  html += `</section>`;

  html += `<section class="section"><div class="section-title"><h2>과목별 성적<span class="count">${courseCount}</span></h2></div><div class="section-sub">오른쪽 성적 배지를 기준으로 빠르게 훑어볼 수 있어요.</div><div class="grade-course-list">`;
  for (const item of items) {
    const grade = item.grade || item.statusMessage || "-";
    const tone = gradeTone(grade);
    const topClass = tone === "high" ? " top" : "";
    html += `<article class="grade-course-card${topClass}"><div class="grade-course-main"><div class="grade-course-title">${esc(item.courseTitle || "과목명 미정")}</div><div class="grade-course-meta">${joinMeta([item.credits != null ? `${item.credits}학점` : null])}</div></div><div class="grade-course-result"><div class="grade-pill ${tone}">${esc(grade)}</div></div></article>`;
  }
  html += `</div></section>`;

  return html;
}

type CourseScoreValue = {
  rawValue?: string;
  earned?: number;
  total?: number;
  value?: number;
};

type CourseScoreItem = {
  assessmentCategory?: string;
  itemName?: string;
  ratio?: CourseScoreValue;
  rawScore?: CourseScoreValue;
  averageScore?: CourseScoreValue;
  note?: string;
};

type CourseScoreSummary = {
  enteredItems: CourseScoreItem[];
  courseCount: number;
  aboveAverage: number;
  equalAverage: number;
  belowAverage: number;
};

type CourseScoreCourse = {
  title?: string;
  courseCode?: string;
  courseTitle?: string;
  items?: CourseScoreItem[];
};

function renderCourseScores(data: unknown): string {
  const d = data as {
    year?: number;
    termLabel?: string;
    courses?: CourseScoreCourse[];
  };
  const courses = (d.courses ?? []).filter((course) => course.items?.length);
  const termText = [d.year != null ? `${d.year}학년도` : "", d.termLabel || ""].filter(Boolean).join(" · ");
  const sectionSub = [termText, "중간·기말·퀴즈 등 학기 중 평가 항목별 점수입니다."].filter(Boolean).join(" · ");
  if (!courses.length) {
    return `<section class="section course-score-detail-section"><div class="section-title"><h2>과목별 상세</h2></div><div class="section-sub">${esc(sectionSub)}</div><div class="course-score-empty">조회된 수강점수 항목이 없습니다.</div></section>`;
  }

  const summary = courseScoreSummary(courses);

  let html = renderCourseScoreSummary(summary);
  html += `<section class="section course-score-detail-section"><div class="section-title"><h2>과목별 상세</h2></div><div class="section-sub">${esc(sectionSub)}</div><div class="course-score-course-list">`;
  for (const course of courses) {
    const courseTitle = courseScoreCourseTitle(course);
    const courseItems = course.items ?? [];
    html += `<section class="course-score-course"><div class="course-score-course-head"><div class="course-score-course-title">${esc(courseTitle)}</div></div>`;

    for (const item of courseItems) {
      const pending = !isCourseScoreEntered(item);
      const statusBadge = pending ? `<span class="badge badge-gray">미공개</span>` : "";
      html += `<article class="course-score-row"><div class="course-score-row-head"><div><div class="course-score-title">${esc(item.itemName || item.assessmentCategory || "평가 항목")}</div><div class="course-score-category">${esc(item.assessmentCategory || "")}</div></div>${statusBadge}</div>`;
      html += `<div class="course-score-metrics">`;
      html += renderCourseScoreMetric("반영비율", scoreValueText(item.ratio));
      html += renderCourseScoreMetric("내 점수", pending ? "미공개" : scoreValueText(item.rawScore));
      html += renderCourseScoreMetric("평균", scoreValueText(item.averageScore));
      html += `</div></article>`;
    }

    html += `</section>`;
  }
  html += `</div></section>`;

  return html;
}

function courseScoreCourseTitle(course: CourseScoreCourse): string {
  const title = course.title?.trim();
  if (title) return title;
  return [course.courseCode, course.courseTitle].filter(Boolean).join(" - ") || "과목명 미정";
}

function scoreValueText(value: CourseScoreValue | undefined): string {
  if (!value) return "-";
  if (value.rawValue && value.rawValue.trim()) return value.rawValue.trim();
  if (typeof value.earned === "number" && typeof value.total === "number") return `${value.earned} / ${value.total}`;
  if (typeof value.value === "number") return String(value.value);
  return "-";
}

function courseScoreSummary(courses: CourseScoreCourse[]): CourseScoreSummary {
  const enteredItems = courses.flatMap((course) => course.items ?? []).filter(isCourseScoreEntered);
  const courseCount = courses.filter((course) => (course.items ?? []).some(isCourseScoreEntered)).length;
  let aboveAverage = 0;
  let equalAverage = 0;
  let belowAverage = 0;

  for (const item of enteredItems) {
    const rawScore = scoreValueNumber(item.rawScore);
    const averageScore = scoreValueNumber(item.averageScore);
    if (rawScore == null || averageScore == null) continue;
    if (rawScore > averageScore) aboveAverage += 1;
    else if (rawScore < averageScore) belowAverage += 1;
    else equalAverage += 1;
  }

  return { enteredItems, courseCount, aboveAverage, equalAverage, belowAverage };
}

function renderCourseScoreSummary(summary: CourseScoreSummary): string {
  if (!summary.enteredItems.length) {
    return `<section class="course-score-summary"><div class="course-score-summary-label">공개된 수강점수</div><div class="course-score-summary-main">아직 공개된 평가 항목이 없습니다.</div></section>`;
  }

  const chips = [
    { label: "평균보다 높음", value: summary.aboveAverage },
    { label: "평균 동일", value: summary.equalAverage },
    { label: "평균보다 낮음", value: summary.belowAverage },
  ];
  return `<section class="course-score-summary"><div class="course-score-summary-label">공개된 수강점수</div><div class="course-score-summary-main">${summary.courseCount}과목에서 ${summary.enteredItems.length}개 평가 항목이 공개됐어요.</div><div class="course-score-summary-meta">${chips.map((chip) => `<div class="course-score-summary-stat"><strong>${chip.value}</strong><span>${esc(chip.label)}</span></div>`).join("")}</div></section>`;
}

function scoreValueNumber(value: CourseScoreValue | undefined): number | undefined {
  if (!value) return undefined;
  if (typeof value.earned === "number") return value.earned;
  if (typeof value.value === "number") return value.value;
  const raw = value.rawValue?.trim();
  if (!raw) return undefined;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  return Number(match[0]);
}

function isCourseScoreEntered(item: CourseScoreItem): boolean {
  const note = item.note?.trim().toLowerCase() || "";
  const rawScore = scoreValueText(item.rawScore);
  const statusText = `${note} ${rawScore}`.toLowerCase();
  if (statusText.includes("미입력") || statusText.includes("not entered") || statusText.includes("pending")) return false;
  return rawScore !== "-";
}

function renderCourseScoreMetric(label: string, value: string): string {
  return `<div class="course-score-metric"><div class="course-score-metric-label">${esc(label)}</div><div class="course-score-metric-value">${esc(value)}</div></div>`;
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
    overview?: Record<string, string | number>;
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
  const terms = (d.termRecords ?? []).filter((term) => term.courses?.length);
  if (!terms.length) return "";

  const overview = d.overview ?? {};
  const totalGpa = overviewText(overview, ["전체평점", "누적평점", "평점"]);
  const totalCredits =
    overviewText(overview, ["전체취득학점", "취득학점"]) ||
    String(terms.reduce((sum, term) => sum + (term.earnedCredits ?? 0), 0) || "-");

  // 학기 정렬: year DESC, term DESC (2학기 > 1학기 > 계절)
  const termWeight = (label: string): number => {
    if (label.includes("2")) return 2;
    if (label.includes("1")) return 1;
    if (label.includes("동계")) return 0.5;
    if (label.includes("하계")) return 1.5;
    return 0;
  };
  const sorted = [...terms].sort((a, b) => {
    const ay = a.year ?? 0;
    const by = b.year ?? 0;
    if (ay !== by) return by - ay;
    return termWeight(b.termLabel) - termWeight(a.termLabel);
  });
  const chronological = [...sorted].reverse();
  const flowTerms = chronological.filter((term) => typeof term.gpa === "number");

  let html = "";

  html += `<section class="section history-section"><div class="history-overview">`;
  html += `<div class="history-overview-item primary"><div class="history-overview-label">누적 평균 학점</div><div class="history-overview-value">${esc(totalGpa || "-")}</div></div>`;
  html += `<div class="history-overview-item"><div class="history-overview-label">취득 학점</div><div class="history-overview-value">${esc(totalCredits)}</div></div>`;
  html += `<div class="history-overview-item"><div class="history-overview-label">조회 학기</div><div class="history-overview-value">${terms.length}</div></div>`;
  html += `</div></section>`;

  if (flowTerms.length) {
    const chartPoints = flowTerms.map((term, index) => historyChartPoint(term.gpa ?? 0, index, flowTerms.length));
    const linePoints = chartPoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
    const firstPoint = chartPoints[0];
    const lastPoint = chartPoints[chartPoints.length - 1];
    const areaPoints = chartPoints.length > 1
      ? `${firstPoint.x.toFixed(2)},88 ${linePoints} ${lastPoint.x.toFixed(2)},88`
      : "";
    const plotMinWidth = Math.max(260, flowTerms.length * 68);

    html += `<section class="section"><div class="history-flow"><div class="history-flow-head"><div class="history-flow-title">학기별 학점 흐름</div><div class="history-flow-scale">4.5 만점</div></div><div class="history-flow-chart"><div class="history-flow-plot" style="--plot-min-width:${plotMinWidth}px"><svg class="history-flow-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line class="history-flow-grid" x1="0" y1="32" x2="100" y2="32"></line><line class="history-flow-grid" x1="0" y1="56" x2="100" y2="56"></line><line class="history-flow-grid" x1="0" y1="80" x2="100" y2="80"></line>${areaPoints ? `<polygon class="history-flow-area" points="${areaPoints}"></polygon>` : ""}<polyline class="history-flow-line" points="${linePoints}"></polyline></svg>`;
    for (let i = 0; i < flowTerms.length; i++) {
      const term = flowTerms[i];
      const point = chartPoints[i];
      const latestClass = term === sorted[0] ? " latest" : "";
      const pointStyle = `--point-x:${point.x.toFixed(2)}%;--point-y:${point.y.toFixed(2)}%`;
      html += `<div class="history-flow-value" style="${pointStyle}">${(term.gpa ?? 0).toFixed(2)}</div><div class="history-flow-point${latestClass}" style="${pointStyle}"></div><div class="history-flow-term" style="${pointStyle}">${esc(historyTermShortLabel(term))}</div>`;
    }
    html += `</div></div></div></section>`;
  }

  html += `<section class="section"><div class="section-title"><h2>학기별 성적<span class="count">${terms.length}</span></h2></div><div class="history-term-list">`;
  for (const term of sorted) {
    const title = term.title || `${term.year ?? ""} ${term.termLabel}`.trim();
    const summaryParts = [
      typeof term.gpa === "number"
        ? `<span class="average">평균 ${term.gpa.toFixed(2)}</span>`
        : "",
      term.earnedCredits != null
        ? `<span>${term.earnedCredits}학점</span>`
        : "",
    ].filter(Boolean);
    const summaryHtml = summaryParts.join(`<span class="sep">·</span>`);

    html += `<article class="history-term-card">`;
    html += `<div class="history-term-head"><div class="history-term-title">${esc(title || "학기 미정")}</div>${summaryHtml ? `<div class="history-term-summary">${summaryHtml}</div>` : ""}</div>`;
    html += `<div class="history-course-list">`;

    for (const c of term.courses) {
      const grade = c.grade || "-";
      html += `<article class="grade-course-card history-course-card"><div class="grade-course-main"><div class="grade-course-title">${esc(c.courseTitle || "과목명 미정")}</div><div class="grade-course-meta">${joinMeta([c.credits != null ? `${c.credits}학점` : null, c.category])}</div></div><div class="grade-course-result"><div class="grade-pill history-grade-pill">${esc(grade)}</div></div></article>`;
    }
    html += `</div></article>`;
  }
  html += `</div></section>`;

  return html;
}

function overviewText(overview: Record<string, string | number>, keys: string[]): string {
  for (const key of keys) {
    const value = overview[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function historyChartPoint(gpa: number, index: number, total: number): { x: number; y: number } {
  const x = total <= 1 ? 50 : 8 + (index / (total - 1)) * 84;
  const ratio = Math.max(0, Math.min(1, (gpa - 3.0) / 1.5));
  const y = 80 - ratio * 58;
  return { x, y };
}

function historyTermShortLabel(term: { title?: string; year?: number; termLabel?: string }): string {
  const title = term.title || "";
  const yearMatch = title.match(/(\d{4})/);
  const year = yearMatch?.[1] || (term.year != null ? String(term.year) : "");
  const termLabel = term.termLabel || "";
  const termMatch = termLabel.match(/(\d)/) || title.match(/(\d)\s*학기/);
  if (year && termMatch) return `${year.slice(2)}-${termMatch[1]}`;
  if (year) return year.slice(2);
  return termLabel || title || "-";
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

// ── 할 일 (Today's briefing) ──────────────────────────

function renderActionItems(data: unknown): string {
  const d = data as Record<string, unknown>;
  const unsub = (d.unsubmittedAssignments as AssignmentItem[] | undefined) ?? [];
  const due = (d.dueAssignments as AssignmentItem[] | undefined) ?? [];
  const notices = (d.unreadNotices as NoticeItem[] | undefined) ?? [];
  const online = (d.incompleteOnlineWeeks as OnlineActionItem[] | undefined) ?? [];
  const total = unsub.length + due.length + notices.length + online.length;
  if (total === 0) {
    return `<section class="section"><div class="section-title"><h2>우선 처리 항목</h2></div><div class="section-sub">처리할 항목이 없습니다.</div></section>`;
  }

  const queue = buildActionQueue(unsub, due, online, notices);
  const nextAction = queue.find((item) => item.source !== "notice");
  const lanes = nextAction ? queue.filter((item) => item !== nextAction) : queue;
  const urgentItems = lanes.filter((item) => item.lane === "urgent");
  const todayItems = lanes.filter((item) => item.lane === "today");
  const soonItems = lanes.filter((item) => item.lane === "soon");
  const noticeItems = lanes.filter((item) => item.lane === "notice");

  let html = `<section class="section action-queue"><div class="section-title"><h2>우선 처리 항목</h2></div><div class="section-sub">총 ${total}건 중 가장 먼저 처리할 항목입니다.</div>`;
  if (nextAction) {
    html += renderActionNext(nextAction);
  } else {
    html += `<div class="section-sub">마감 항목은 없고 읽지 않은 공지만 있습니다.</div>`;
  }
  html += `</section>`;

  html += renderActionLane("기한 경과", urgentItems);
  html += renderActionLane("오늘 마감", todayItems);
  html += renderActionLane("마감 예정", soonItems);
  html += renderActionLane("읽지 않은 공지", noticeItems);

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
  if (item.source === "notice") return formatActionDueAt(item.postedAt) || "확인";
  return item.dueLabel || formatActionDueAt(item.dueAt) || item.statusText || (item.source === "online" ? "기한 확인" : "");
}

function formatActionDueAt(dueAt?: string): string {
  if (!dueAt) return "";
  const parsed = new Date(dueAt);
  if (Number.isNaN(parsed.getTime())) return dueAt;

  const dateKey = parsed.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const todayKey = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const time = parsed.toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (dateKey === todayKey) return `오늘 ${time}`;
  if (dateKey === tomorrowKey) return `내일 ${time}`;

  const date = parsed.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  }).replace(/\.$/, "");
  return `${date} ${time}`;
}

function actionReason(item: ActionQueueItem): string {
  if (item.lane === "urgent") return "기한 경과";
  if (item.lane === "today") return "오늘 마감";
  if (item.source === "online") return "영상 마감";
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

function assignmentItems(data: unknown): AssignmentItem[] {
  return Array.isArray(data)
    ? (data as AssignmentItem[])
    : ((data as { assignments?: AssignmentItem[]; items?: AssignmentItem[] }).assignments
      || (data as { items?: AssignmentItem[] }).items
      || []);
}

function renderUnsubmittedAssignments(data: unknown): string {
  const items = assignmentItems(data);
  if (!items.length) return "";

  const sortedItems = items
    .map((item, order) => ({ item, order }))
    .sort((a, b) => assignmentBucketRank(a.item) - assignmentBucketRank(b.item)
      || assignmentPriorityRank(a.item) - assignmentPriorityRank(b.item)
      || assignmentDueRank(a.item, a.order) - assignmentDueRank(b.item, b.order)
      || a.order - b.order)
    .map((entry) => entry.item);
  const groups = groupAssignmentsByDeadline(sortedItems);
  const nextAssignment = sortedItems[0];
  const todayCount = groups.find((group) => group.key === "today")?.items.length ?? 0;
  const expiredCount = groups.find((group) => group.key === "expired")?.items.length ?? 0;
  const urgentStatValue = expiredCount > 0 ? `기한 지남 ${expiredCount}개` : `오늘 마감 ${todayCount}개`;
  const nextDue = nextAssignment ? assignmentDueText(nextAssignment) || "기한 확인" : "기한 확인";

  let html = `<section class="unsubmitted-summary unsubmitted-band"><div class="unsubmitted-band-top"><div><div class="unsubmitted-band-kicker">미제출 브리핑</div><div class="unsubmitted-band-main">미제출 ${items.length}개</div></div><div class="unsubmitted-band-urgent">${urgentStatValue}</div></div><div class="unsubmitted-band-bottom"><div class="unsubmitted-band-note">가까운 마감일부터 정리했어요</div><div class="unsubmitted-band-due">가장 임박 ${esc(nextDue)}</div></div></section>`;

  for (const group of groups) {
    if (!group.items.length) continue;
    html += `<section class="section unsubmitted-lane"><div class="section-title"><h2>${group.title}<span class="count">${group.items.length}</span></h2></div>`;
    for (const item of group.items) {
      html += renderAssignmentRow(item);
    }
    html += `</section>`;
  }

  return html;
}

function groupAssignmentsByDeadline(items: AssignmentItem[]): AssignmentDeadlineGroup[] {
  const groups: AssignmentDeadlineGroup[] = [
    { key: "expired", title: "기한 지남", items: [] },
    { key: "today", title: "오늘", items: [] },
    { key: "tomorrow", title: "내일", items: [] },
    { key: "week", title: "이번 주", items: [] },
    { key: "later", title: "이후", items: [] },
    { key: "unknown", title: "기한 확인", items: [] },
  ];
  const byKey = new Map(groups.map((group) => [group.key, group]));

  for (const item of items) {
    byKey.get(assignmentBucket(item))!.items.push(item);
  }

  return groups;
}

function renderAssignmentRow(a: AssignmentItem): string {
  const expired = isAssignmentExpired(a);
  const valCls = expired ? "red" : a.priority === "high" || assignmentBucket(a) === "today" ? "red" : "";
  const iconCls = expired || a.priority === "high" ? " red" : "";
  const val = assignmentDueText(a);
  const urgentClass = valCls === "red" ? " is-urgent" : "";
  return `<article class="row assignment-row${urgentClass}"><div class="row-icon${iconCls}">${codeChip(a.courseTitle || "")}</div><div class="row-main"><div class="row-title">${esc(a.title || "")}</div><div class="row-sub">${joinMeta([a.courseTitle, a.weekLabel])}</div></div><div class="row-value ${valCls}">${esc(val)}</div></article>`;
}

function assignmentBucketRank(item: AssignmentItem): number {
  return { expired: 0, today: 1, tomorrow: 2, week: 3, later: 4, unknown: 5 }[assignmentBucket(item)];
}

function assignmentBucket(item: AssignmentItem): AssignmentDeadlineGroup["key"] {
  if (isAssignmentExpired(item) || textIncludesAny([item.statusText, item.dueLabel], ["기한 지남", "만료", "overdue", "expired"])) return "expired";
  if (textIncludesAny([item.dueLabel, item.statusText], ["오늘", "today"])) return "today";
  if (textIncludesAny([item.dueLabel, item.statusText], ["내일", "tomorrow"])) return "tomorrow";

  const offset = assignmentDueDayOffset(item);
  if (offset === 0) return "today";
  if (offset === 1) return "tomorrow";
  if (offset !== null && offset > 1 && offset <= 6) return "week";
  if (offset !== null && offset > 6) return "later";
  if (item.dueLabel || item.dueAt) return "week";
  return "unknown";
}

function assignmentDueDayOffset(item: AssignmentItem): number | null {
  if (!item.dueAt) return null;
  const due = new Date(item.dueAt);
  if (Number.isNaN(due.getTime())) return null;
  return dayNumberInKorea(due) - dayNumberInKorea(new Date());
}

function dayNumberInKorea(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "1");
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function assignmentPriorityRank(item: AssignmentItem): number {
  return item.priority === "high" ? 0 : 1;
}

function assignmentDueRank(item: AssignmentItem, order: number): number {
  if (item.dueAt) {
    const parsed = new Date(item.dueAt);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }

  const label = (item.dueLabel || item.statusText || "").toLowerCase();
  if (label.includes("오늘") || label.includes("today")) return order;
  if (label.includes("내일") || label.includes("tomorrow")) return 86400000 + order;

  const koreanDate = label.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (koreanDate) return Number(koreanDate[1]) * 100000000 + Number(koreanDate[2]) * 1000000 + order;

  const englishMayDate = label.match(/may\s+(\d{1,2})/);
  if (englishMayDate) return 5 * 100000000 + Number(englishMayDate[1]) * 1000000 + order;

  const dDay = label.match(/d-(\d{1,2})/);
  if (dDay) return Number(dDay[1]) * 86400000 + order;

  return Number.MAX_SAFE_INTEGER - 1000 + order;
}

function assignmentDueText(item: AssignmentItem): string {
  return item.dueLabel || item.dueAt || (isAssignmentExpired(item) ? "만료" : item.statusText || "");
}

// ── 공지 리스트 (LMS) ──────────────────────────────────

function renderUnreadNoticeList(data: unknown): string {
  const items: NoticeItem[] = Array.isArray(data)
    ? (data as NoticeItem[])
    : ((data as { notices?: NoticeItem[]; items?: NoticeItem[] }).notices
      || (data as { items?: NoticeItem[] }).items
      || []);
  if (!items.length) return "";

  const todayCount = items.filter(isTodayNotice).length;
  const recent = items.filter(isRecentNotice);
  const past = items.filter((item) => !isRecentNotice(item));
  const meta = todayCount > 0
    ? `오늘 ${todayCount} · 이전 ${items.length - todayCount}`
    : `최근 ${recent.length} · 지난 ${past.length}`;

  let html = `<section class="unread-notice-overview"><div class="unread-overview-line"><div class="unread-overview-count">안 읽은 공지 <strong>${items.length}건</strong></div><div class="unread-overview-meta">${esc(meta)}</div></div><div class="unread-overview-note">과목과 날짜를 먼저 확인하고 필요한 공지만 바로 열어보세요.</div></section>`;
  if (recent.length) html += renderUnreadNoticeSection("최근 공지", recent);
  if (past.length) html += renderUnreadNoticeSection("지난 공지", past);
  return html;
}

function renderUnreadNoticeSection(title: string, items: NoticeItem[]): string {
  let html = `<section class="section unread-notice-section"><div class="section-title"><h2>${esc(title)}<span class="count">${items.length}</span></h2></div><div class="unread-notice-list">`;
  for (const notice of items) {
    html += renderUnreadNoticeRow(notice);
  }
  return html + `</div></section>`;
}

function renderUnreadNoticeRow(notice: NoticeItem): string {
  const course = notice.courseTitle?.trim() || "LMS 공지";
  const title = notice.title?.trim() || "제목 없음";
  const posted = notice.postedAt?.trim() || "확인";
  const unreadDot = notice.isUnread === false ? "" : `<span class="unread-dot" aria-hidden="true"></span>`;
  const preview = notice.previewText?.trim()
    ? `<div class="unread-notice-preview">${esc(notice.previewText.trim().slice(0, 220))}</div>`
    : "";

  return `<article class="unread-notice-row"><div class="unread-notice-head"><span class="notice-course-pill">${esc(course)}</span><span class="notice-posted">${esc(posted)}</span></div><div class="unread-notice-title">${unreadDot}<span>${esc(title)}</span></div>${preview}</article>`;
}

function isRecentNotice(notice: NoticeItem): boolean {
  const label = notice.postedAt?.trim().toLowerCase() || "";
  return isTodayNotice(notice) || label.includes("어제") || label.includes("yesterday");
}

function isTodayNotice(notice: NoticeItem): boolean {
  const label = notice.postedAt?.trim().toLowerCase() || "";
  return label.includes("오늘") || label.includes("today");
}

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

  let html = `<section class="section news-list-section"><div class="section-title"><h2>공지<span class="count">${d.items.length}</span></h2></div>`;
  for (const n of d.items) {
    const label = n.sourceName || NEWS_SOURCE_LABEL[n.source] || n.source;
    const dateRaw = n.publishedAt || n.postedAt;
    const dateLabel = dateRaw
      ? new Date(dateRaw).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" })
      : "";
    html += `<div class="row news-row"><div class="row-icon accent">${codeChip(label || "")}</div><div class="row-main"><div class="row-title"><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a></div><div class="row-sub">${joinMeta([label, n.author])}</div></div><div class="row-value" style="color:var(--ink-3);font-weight:500">${esc(dateLabel)}</div></div>`;
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
type NoticeDetailData = {
  title?: string; source?: string; sourceName?: string; categoryLabel?: string | null;
  author?: string | null; url?: string; publishedAt?: string;
  bodyText?: string | null; attachments?: NoticeDetailAttachment[]; images?: NoticeDetailImage[];
};

function renderNewsDetail(data: unknown): string {
  const d = data as NoticeDetailData;

  let html = "";

  if (d.url) {
    html += `<section class="notice-detail-source"><a class="notice-source-link" href="${esc(d.url)}" target="_blank" rel="noopener">원문 페이지 열기 ↗</a></section>`;
  }

  if (d.bodyText && d.bodyText.trim()) {
    html += `<section class="section notice-body-section"><div class="section-title"><h2>본문</h2></div><article class="notice-body">${esc(d.bodyText).replace(/\n/g, "<br>")}</article></section>`;
  }

  if (d.attachments && d.attachments.length > 0) {
    html += `<section class="section notice-attachments-section"><div class="section-title"><h2>첨부파일<span class="count">${d.attachments.length}개</span></h2></div>`;
    for (const a of d.attachments) {
      const size = a.sizeBytes != null ? formatBytes(a.sizeBytes) : null;
      const kind = attachmentKind(a);
      const metaLine = joinMeta([kind, size]);
      const name = a.fileName || "파일";
      const title = a.downloadUrl ? `<a href="${esc(a.downloadUrl)}" target="_blank" rel="noopener">${esc(name)}</a>` : esc(name);
      const action = a.downloadUrl
        ? `<a class="notice-download" href="${esc(a.downloadUrl)}" target="_blank" rel="noopener">다운로드</a>`
        : `<span class="notice-download muted">파일</span>`;
      html += `<div class="row notice-attachment-row"><div class="row-icon accent">${esc(kind || "파일")}</div><div class="row-main"><div class="row-title">${title}</div>${metaLine ? `<div class="row-sub">${metaLine}</div>` : ""}</div><div class="row-value">${action}</div>`;
      const ex = a.extraction;
      if (ex?.status === "succeeded" && ex.text) {
        const preview = previewText(ex.text);
        html += `<div class="row-preview notice-preview">${esc(preview)}</div>`;
      } else if (ex?.status && ex.status !== "pending") {
        html += `<div class="row-preview notice-preview muted">${esc(extractionStatusLabel(ex.status))}</div>`;
      }
      html += `</div>`;
    }
    html += `</section>`;
  }

  return html || renderGeneric(data);
}

function attachmentKind(a: NoticeDetailAttachment): string {
  const fileName = a.fileName || "";
  const ext = fileName.includes(".") ? fileName.split(".").pop()?.trim() : "";
  if (ext) return ext.toUpperCase().slice(0, 5);

  const contentType = a.contentType || "";
  if (contentType.includes("pdf")) return "PDF";
  if (contentType.includes("hwp")) return "HWP";
  if (contentType.includes("image")) return "IMG";
  return "";
}

function previewText(text: string): string {
  const normalized = text.trim();
  return normalized.length > 400 ? `${normalized.slice(0, 400)} …` : normalized;
}

function extractionStatusLabel(status: string): string {
  return { failed: "미리보기 추출 실패", unsupported: "미리보기 미지원" }[status] || status;
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

type CafeteriaSource = {
  key: string;
  label: string;
  aliases: string[];
};

const CAFETERIA_SOURCES: CafeteriaSource[] = [
  { key: "student-hall", label: "학생회관", aliases: ["student", "student-cafeteria", "학생회관"] },
  { key: "myeongjindang", label: "명진당", aliases: ["myeongjin", "myeongjindang", "명진당"] },
  { key: "faculty", label: "교직원", aliases: ["faculty", "faculty-cafeteria", "교직원"] },
  { key: "welfare", label: "복지동", aliases: ["welfare", "welfare-building", "복지동"] },
];

function renderCafeteriaTable(data: unknown): string {
  const d = data as { items?: CafeteriaEntry[] };
  if (!d.items?.length) return "";

  type CafeteriaMealGroup = {
    date: string;
    mealType: string;
    entries: CafeteriaEntry[];
  };

  const groups = new Map<string, CafeteriaMealGroup>();
  for (const entry of d.items) {
    const date = entry.serviceDate || "";
    const mealType = entry.mealType || "";
    const key = `${date}::${mealType}`;
    if (!groups.has(key)) {
      groups.set(key, { date, mealType, entries: [] });
    }
    groups.get(key)!.entries.push(entry);
  }

  const mealOrder = ["breakfast", "lunch", "dinner"];
  const dates = Array.from(new Set(d.items.map((entry) => entry.serviceDate || "")));
  for (const date of dates) {
    for (const mealType of mealOrder) {
      const key = `${date}::${mealType}`;
      if (!groups.has(key)) {
        groups.set(key, { date, mealType, entries: [] });
      }
    }
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    const dateOrder = a.date.localeCompare(b.date);
    if (dateOrder !== 0) return dateOrder;
    return mealOrder.indexOf(a.mealType) - mealOrder.indexOf(b.mealType);
  });

  let html = "";
  for (const group of sortedGroups) {
    const bySource = new Map<string, CafeteriaEntry[]>();
    const sourceLabels = new Map<string, string>();

    for (const entry of group.entries) {
      const source = cafeteriaSourceFor(entry);
      if (!bySource.has(source.key)) bySource.set(source.key, []);
      bySource.get(source.key)!.push(entry);
      sourceLabels.set(source.key, source.label);
    }

    const knownKeys = new Set(CAFETERIA_SOURCES.map((source) => source.key));
    const extraKeys = Array.from(bySource.keys()).filter((key) => !knownKeys.has(key));
    const orderedSources = [
      ...CAFETERIA_SOURCES.map((source) => ({ key: source.key, label: source.label })),
      ...extraKeys.map((key) => ({ key, label: sourceLabels.get(key) || key })),
    ];

    html += `<section class="section cafeteria-section"><div class="section-title"><h2>${esc(cafeteriaGroupTitle(group.date, group.mealType))}</h2></div><div class="cafeteria-table">`;

    for (const source of orderedSources) {
      const entries = bySource.get(source.key) || [];
      const row = cafeteriaRowFor(source.key, group.mealType, entries);
      html += `<article class="cafeteria-table-row ${row.className}"><div class="cafeteria-place">${esc(source.label)}</div><div class="cafeteria-menu"><div class="cafeteria-menu-text">${esc(row.menuText)}</div>${row.note ? `<div class="cafeteria-menu-note">${esc(row.note)}</div>` : ""}</div><div class="cafeteria-price">${esc(row.priceText)}</div></article>`;
    }

    html += `</div></section>`;
  }

  return html;
}

function cafeteriaSourceFor(entry: CafeteriaEntry): { key: string; label: string } {
  const sourceId = normalizeCafeteriaText(entry.sourceId || "");
  const sourceName = normalizeCafeteriaText(entry.sourceName || "");
  const haystack = `${sourceId} ${sourceName}`;

  for (const source of CAFETERIA_SOURCES) {
    if (source.aliases.some((alias) => haystack.includes(normalizeCafeteriaText(alias)))) {
      return { key: source.key, label: source.label };
    }
  }

  const fallback = entry.sourceName || entry.sourceId || "기타";
  return { key: `extra:${fallback}`, label: fallback };
}

function normalizeCafeteriaText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "").replace(/식당/g, "");
}

function cafeteriaGroupTitle(date: string, mealType: string): string {
  const parts: string[] = [];
  if (date) parts.push(formatCafeteriaDate(date));
  if (mealType) parts.push(MEAL_LABEL[mealType] || mealType);
  return parts.length ? `${parts.join(" ")} 식단표` : "식단표";
}

function formatCafeteriaDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function cafeteriaRowFor(sourceKey: string, mealType: string, entries: CafeteriaEntry[]): {
  className: string;
  menuText: string;
  note: string;
  priceText: string;
} {
  if (!entries.length) {
    return { className: "is-empty", menuText: "메뉴 없음", note: "해당 식당의 식단 정보가 없습니다.", priceText: "" };
  }

  if (entries.every((entry) => entry.isClosed)) {
    return { className: "is-closed", menuText: "휴무", note: "", priceText: "휴무" };
  }

  const openEntries = entries.filter((entry) => !entry.isClosed);
  const menuLines = openEntries
    .map((entry) => cafeteriaMenuItems(entry).join(" · "))
    .filter(Boolean);

  return {
    className: "",
    menuText: menuLines.length ? menuLines.join(" / ") : "메뉴 없음",
    note: menuLines.length ? "" : "등록된 메뉴명이 없습니다.",
    priceText: cafeteriaFixedPriceFor(sourceKey, mealType),
  };
}

function cafeteriaFixedPriceFor(sourceKey: string, mealType: string): string {
  if (sourceKey === "student-hall" && mealType === "breakfast") return "5,000원";
  return sourceKey === "student-hall" ? "6,000원" : "6,500원";
}

function cafeteriaMenuItems(entry: CafeteriaEntry): string[] {
  if (Array.isArray(entry.menuItems)) {
    return entry.menuItems.map(cafeteriaMenuItemText).filter(Boolean);
  }

  if (entry.menuText) {
    return entry.menuText.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function cafeteriaMenuItemText(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (!item || typeof item !== "object" || Array.isArray(item)) return "";

  const record = item as Record<string, unknown>;
  const name = record.name ?? record.title ?? record.menuName ?? record.text;
  return typeof name === "string" ? name.trim() : "";
}

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

  // Absence-first briefing
  if (d.summary) {
    const attended = d.summary.attendedCount ?? 0;
    const tardy = d.summary.tardyCount ?? 0;
    const earlyLeave = d.summary.earlyLeaveCount ?? 0;
    const absent = d.summary.absentCount ?? 0;
    const completed = d.completedSessions ?? d.sessions?.filter((s) => s.isPast).length ?? 0;
    const courseTitle = d.course?.courseTitle ? `${esc(d.course.courseTitle)} 출결` : "출결 요약";
    const support = [`출석 ${attended}회`, completed ? `진행된 수업 ${completed}회` : "", earlyLeave ? `조퇴 ${earlyLeave}회` : ""].filter(Boolean).join(" · ");
    html += `<section class="section attendance-summary"><div class="attendance-briefing">`;
    html += `<div class="attendance-course">${courseTitle}</div>`;
    html += `<div class="attendance-counts">`;
    html += `<div class="attendance-count danger"><span>결석</span><strong>${absent}<span class="unit">회</span></strong></div>`;
    html += `<div class="attendance-count warn"><span>지각</span><strong>${tardy}<span class="unit">회</span></strong></div>`;
    html += `</div>`;
    if (support) html += `<div class="attendance-support">${support}</div>`;
    html += `</div></section>`;
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
    case "unsubmitted": {
      const items = pickItems("assignments", "items");
      if (!items.length) return "_미제출 과제가 없습니다._";
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
