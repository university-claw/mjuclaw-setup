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
  "timetable-planner": { kicker: "시간표 설계", detail: "개설강좌 기반 시간표" },
  timetable: { kicker: "TIMETABLE", detail: "시간표" },
  "course-scores": { kicker: "COURSE SCORES", detail: "수강점수" },
  grades: { kicker: "GRADES", detail: "성적" },
  "grade-history": { kicker: "GRADE HISTORY", detail: "학기별 성적" },
  graduation: { kicker: "졸업 로드맵", detail: "공식 요건 기반 로드맵" },
  "action-items": { kicker: "TODAY'S BRIEFING", detail: "지금 할 일" },
  unsubmitted: { kicker: "ASSIGNMENTS", detail: "미제출 과제" },
  "unread-notices": { kicker: "NOTICES", detail: "LMS 공지" },
  attendance: { kicker: "ATTENDANCE", detail: "출석" },
  news: { kicker: "PUBLIC NOTICES", detail: "학교 공지" },
  "news-detail": { kicker: "NOTICE DETAIL", detail: "공지 상세" },
  cafeteria: { kicker: "CAFETERIA", detail: "학식" },
};

const DARKMODE_ASSET_BASE = "/static/darkmode";
const DARKMODE_LOCAL_PREVIEW_ASSET_BASE = "../../public/darkmode";
const DARKMODE_MARK_ASSET = darkmodeAsset("myongmyong-darkmode-emote-00.png");
const DARKMODE_HERO_ASSETS: Record<string, string> = {
  "timetable-planner": "myongmyong-darkmode-emote-01.png",
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

type DarkmodeAsset = {
  serverSrc: string;
  localPreviewSrc: string;
};

function darkmodeAsset(fileName: string): DarkmodeAsset {
  return {
    serverSrc: `${DARKMODE_ASSET_BASE}/${fileName}`,
    localPreviewSrc: `${DARKMODE_LOCAL_PREVIEW_ASSET_BASE}/${fileName}`,
  };
}

function darkmodeImgAttrs(asset: DarkmodeAsset): string {
  return `src="${esc(asset.serverSrc)}" data-local-src="${esc(asset.localPreviewSrc)}" onerror="this.onerror=null;this.src=this.dataset.localSrc"`;
}

function heroAssetFor(dataType: string): DarkmodeAsset {
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
  if (entry.dataType !== "timetable" && entry.dataType !== "timetable-planner" && entry.dataType !== "course-scores" && entry.dataType !== "grades" && entry.dataType !== "grade-history" && entry.dataType !== "graduation" && entry.dataType !== "action-items" && entry.dataType !== "unsubmitted" && entry.dataType !== "unread-notices" && entry.dataType !== "attendance" && entry.dataType !== "news" && entry.dataType !== "news-detail" && entry.dataType !== "cafeteria") {
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
      <div class="brand-chip" aria-hidden="true"><img ${darkmodeImgAttrs(DARKMODE_MARK_ASSET)} alt=""></div>
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
      <img ${darkmodeImgAttrs(heroAsset)} alt="">
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
    <div class="expired-mascot" aria-hidden="true"><img ${darkmodeImgAttrs(mascotSrc)} alt=""></div>
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
[hidden] { display: none !important; }

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
.ring-card.grad-area-card { cursor: pointer; }
.ring-card.grad-area-card summary {
  list-style: none; cursor: pointer; display: grid; gap: 10px;
}
.ring-card.grad-area-card summary::-webkit-details-marker { display: none; }
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
.grad-area-list {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px;
  align-items: start;
}
.grad-area-card {
  border: 1px solid var(--rule); border-radius: 8px;
  background: rgba(255,255,255,0.04); overflow: hidden;
  align-self: start;
}
.ring-card.grad-area-card {
  border: 0; background: var(--bg-alt);
}
.grad-area-card summary {
  list-style: none; cursor: pointer; padding: 14px;
  display: grid; gap: 10px;
}
.grad-area-card summary::-webkit-details-marker { display: none; }
.grad-area-summary {
  display: flex; justify-content: space-between; gap: 10px; align-items: center;
}
.grad-area-title {
  color: var(--ink); font-size: 13px; font-weight: 800;
  letter-spacing: 0; overflow-wrap: anywhere;
}
.grad-area-meta {
  margin-top: 3px; color: var(--ink-3); font-size: 11.5px; font-variant-numeric: tabular-nums;
}
.grad-area-state {
  color: var(--red); font-size: 11px; font-weight: 850; white-space: nowrap;
}
.grad-area-state.done { color: var(--green); }
.grad-area-body {
  display: grid; gap: 8px; padding: 0 14px 14px;
}
.grad-course-detail-row {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: start;
  padding: 9px 0; border-top: 1px solid var(--rule);
}
.grad-course-detail-row[hidden] { display: none !important; }
.grad-course-detail-row strong {
  display: block; color: var(--ink); font-size: 12.5px; line-height: 1.35; overflow-wrap: anywhere;
}
.grad-course-detail-row span {
  display: block; margin-top: 2px; color: var(--ink-3); font-size: 11px; line-height: 1.35;
}
.grad-course-status {
  border-radius: 999px; padding: 4px 7px; font-size: 10.5px; font-weight: 850; white-space: nowrap;
  color: var(--ink-2); background: rgba(255,255,255,0.08);
}
.grad-course-status.completed { color: var(--green); background: rgba(62,211,126,0.14); }
.grad-course-status.missing { color: var(--red); background: rgba(255,107,115,0.14); }
.grad-course-status.unprovided { color: var(--ink-3); background: rgba(154,162,176,0.18); }
.choice-panel {
  display: grid; gap: 10px;
}
.choice-group {
  margin: 0; padding: 12px; border: 1px solid var(--rule); border-radius: 8px;
  background: rgba(255,255,255,0.035);
}
.choice-group legend {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  width: 100%; padding: 0; color: var(--ink); font-size: 12.5px; font-weight: 850;
}
.choice-group legend em {
  font-style: normal; color: var(--accent); font-size: 11px; font-weight: 850; white-space: nowrap;
}
.choice-options {
  display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px;
}
.choice-option {
  display: inline-flex; align-items: center; gap: 6px; min-height: 30px;
  padding: 6px 9px; border-radius: 999px; border: 1px solid var(--rule);
  background: rgba(255,255,255,0.04); color: var(--ink-2); font-size: 12px; font-weight: 750;
}
.choice-option input { accent-color: var(--accent); }
.choice-option small { color: var(--ink-3); font-size: 10.5px; font-weight: 650; }
.choice-source {
  margin-top: 8px; color: var(--ink-3); font-size: 11px; line-height: 1.35;
}
.choice-source a { color: var(--accent); text-decoration: none; }
.choice-source a:hover { text-decoration: underline; }
.choice-source-list {
  display: flex; flex-wrap: wrap; gap: 6px 10px; margin-top: 10px;
  color: var(--ink-3); font-size: 11px; line-height: 1.35;
}
.choice-source-list a { color: var(--accent); text-decoration: none; overflow-wrap: anywhere; }
.choice-source-list a:hover { text-decoration: underline; }
.choice-unprovided {
  margin-top: 8px; color: var(--ink-3); font-size: 12px; line-height: 1.4;
}
.grad-more-button {
  justify-self: start; border: 1px solid var(--rule); border-radius: 8px; background: var(--chip-bg);
  color: var(--ink); padding: 7px 10px; font-size: 12px; font-weight: 800; cursor: pointer;
}
.grad-area-source {
  display: block; color: var(--accent); font-size: 11.5px; font-weight: 750;
  line-height: 1.35; text-decoration: none; overflow-wrap: anywhere;
  padding-top: 9px; border-top: 1px solid var(--rule);
}
.grad-area-source:hover { text-decoration: underline; }
.grad-source-list {
  display: grid; gap: 8px;
}
.grad-area-empty {
  color: var(--ink-4); font-size: 12px; line-height: 1.45; padding-top: 8px;
  border-top: 1px solid var(--rule);
}
.grad-area-tools {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin-top: 8px;
}
.grad-area-tools .section-sub { margin: 0; }
.grad-sort-controls {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px; border-radius: 999px; background: var(--chip-bg);
  flex: 0 0 auto;
}
.grad-sort-controls button {
  min-width: 54px; border: 0; border-radius: 999px;
  padding: 6px 9px; background: transparent; color: var(--ink-3);
  font: inherit; font-size: 11.5px; font-weight: 800; letter-spacing: 0;
  cursor: pointer; white-space: nowrap;
}
.grad-sort-controls button.active {
  background: rgba(255,255,255,0.12); color: var(--ink);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
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
.grad-area-list,
.grad-area-card,
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
.grad-area-card::before,
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
.grad-area-list > *,
.grad-area-card > *,
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
  .grad-area-tools {
    align-items: stretch; flex-direction: column;
  }
  .grad-sort-controls {
    width: 100%; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .grad-sort-controls button {
    min-width: 0;
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

.planner-section { display: grid; gap: 16px; }
.planner-panel {
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 340px); gap: 18px; align-items: start;
  padding: 18px; border: 1px solid var(--rule); border-radius: 8px;
  background: rgba(255,255,255,0.045);
}
.planner-copy h2 { margin: 3px 0 6px; font-size: 22px; letter-spacing: 0; }
.planner-copy p { margin: 0; color: var(--ink-3); line-height: 1.55; }
.planner-kicker { color: var(--accent); font-size: 12px; font-weight: 700; text-transform: uppercase; }
.planner-controls { display: grid; gap: 10px; align-self: start; }
.planner-count-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.planner-control {
  display: grid; gap: 6px; min-width: 0; color: var(--ink-3);
  font-size: 12px; font-weight: 650;
}
.planner-stepper {
  display: grid; grid-template-columns: 38px minmax(0, 1fr) 38px; gap: 6px; align-items: center;
}
.planner-stepper button {
  min-width: 0; height: 38px; border: 1px solid var(--rule); border-radius: 8px;
  background: rgba(255,255,255,0.07); color: var(--ink); font: inherit; font-size: 18px; font-weight: 900;
  cursor: pointer;
}
.planner-control input, .planner-search-input {
  width: 100%; box-sizing: border-box; border: 1px solid var(--rule); border-radius: 8px;
  background: rgba(0,0,0,0.25); color: var(--ink); padding: 10px 11px; font: inherit;
}
.planner-stepper input {
  text-align: center; font-weight: 850; font-variant-numeric: tabular-nums;
}
.planner-stepper input::-webkit-outer-spin-button,
.planner-stepper input::-webkit-inner-spin-button {
  -webkit-appearance: none; margin: 0;
}
.planner-control small { color: var(--ink-4); font-weight: 500; }
.planner-button {
  border: 0; border-radius: 8px; background: var(--accent); color: #061011;
  width: 100%; min-height: 44px; padding: 11px 14px; font-weight: 800; cursor: pointer;
}
.planner-filter-panel {
  display: grid; gap: 12px; padding: 14px; border: 1px solid var(--rule);
  border-radius: 8px; background: rgba(255,255,255,0.028);
}
.planner-filter-group { display: grid; gap: 9px; }
.planner-filter-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  color: var(--ink-3); font-size: 12px; line-height: 1.4; word-break: keep-all;
}
.planner-filter-head strong { color: var(--ink); font-size: 13px; }
.planner-toggle-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.planner-toggle-row.period { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.planner-toggle-row.grade { grid-template-columns: repeat(auto-fit, minmax(64px, 1fr)); }
.planner-toggle {
  min-width: 0; min-height: 42px; border: 1px solid var(--rule); border-radius: 8px;
  background: rgba(0,0,0,0.18); color: var(--ink-2); font: inherit; font-weight: 800;
  cursor: pointer; display: grid; place-items: center; gap: 1px; padding: 6px 5px;
}
.planner-toggle small {
  color: var(--ink-4); font-size: 10px; font-weight: 650; font-variant-numeric: tabular-nums;
}
.planner-toggle.active { border-color: rgba(92,225,230,0.42); background: rgba(92,225,230,0.12); color: var(--ink); }
.planner-toggle.disabled { opacity: 0.48; filter: grayscale(1); background: rgba(255,255,255,0.035); color: var(--ink-4); }
.planner-advanced {
  border-top: 1px solid var(--rule); padding-top: 12px; color: var(--ink-3);
}
.planner-advanced summary {
  cursor: pointer; color: var(--ink); font-size: 13px; font-weight: 800;
}
.planner-advanced-switch {
  display: inline-flex; align-items: center; gap: 8px; margin-top: 10px;
  color: var(--ink-2); font-size: 12px; font-weight: 700;
}
.planner-category-grid {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 10px;
}
.planner-empty, .planner-no-solution {
  border: 1px solid var(--rule); border-radius: 8px; padding: 13px 14px;
  background: rgba(255,255,255,0.035); color: var(--ink-2);
}
.planner-diagnostics {
  display: grid; gap: 12px; margin-top: 14px; padding: 14px;
  border: 1px dashed rgba(255,255,255,0.24); border-radius: 8px;
  background: rgba(255,255,255,0.026); color: var(--ink-2);
}
.planner-diag-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
}
.planner-diag-head div { display: grid; gap: 3px; }
.planner-diag-head strong { color: var(--ink); font-size: 13px; }
.planner-diag-head span, .planner-diag-head small {
  color: var(--ink-3); font-size: 11px; line-height: 1.4; word-break: keep-all;
}
.planner-diag-section { display: grid; gap: 7px; }
.planner-diag-section h3 {
  margin: 0; color: var(--ink-3); font-size: 11px; font-weight: 850;
}
.planner-diag-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 8px;
}
.planner-diag-chip {
  min-width: 0; display: grid; gap: 4px; padding: 9px 10px;
  border: 1px solid var(--rule); border-radius: 8px; background: rgba(0,0,0,0.16);
}
.planner-diag-chip span { color: var(--ink-3); font-size: 11px; font-weight: 800; }
.planner-diag-chip strong { color: var(--ink); font-size: 20px; line-height: 1; font-variant-numeric: tabular-nums; }
.planner-diag-chip small { color: var(--ink-4); font-size: 10px; line-height: 1.35; }
.planner-diag-chip.empty { border-color: rgba(255,185,90,0.36); }
.planner-diag-chip.error { border-color: rgba(255,110,110,0.42); }
.planner-diag-buckets {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px;
}
.planner-diag-bucket {
  min-width: 0; padding: 9px 10px; border: 1px solid var(--rule); border-radius: 8px;
  background: rgba(0,0,0,0.13); display: grid; gap: 6px;
}
.planner-diag-bucket strong { color: var(--ink); font-size: 11px; }
.planner-diag-bucket div { display: flex; flex-wrap: wrap; gap: 5px; }
.planner-diag-bucket span {
  color: var(--ink-3); font-size: 10px; line-height: 1.3; word-break: break-word;
}
.planner-diag-bucket div span {
  padding: 3px 6px; border-radius: 999px; background: rgba(255,255,255,0.055);
}
.planner-diag-bucket em { color: var(--ink); font-style: normal; font-weight: 850; }
.planner-diag-empty, .planner-diag-hints p {
  margin: 0; color: var(--ink-3); font-size: 11px; line-height: 1.45;
}
.planner-diag-hints { display: grid; gap: 4px; }
.planner-status-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.planner-no-solution { border-color: rgba(255,110,110,0.38); color: #ffb8b8; }
.planner-workspace { display: grid; gap: 12px; }
.planner-toolbar {
  display: grid; grid-template-columns: minmax(180px, 260px) minmax(0, 1fr); gap: 10px; align-items: center;
  padding: 10px; border: 1px solid var(--rule); border-radius: 8px; background: rgba(255,255,255,0.035);
}
.planner-credit-summary {
  color: var(--ink); font-size: 13px; font-weight: 850; font-variant-numeric: tabular-nums;
}
.planner-hint { margin-top: 3px; color: var(--ink-3); font-size: 12px; word-break: keep-all; }
.planner-calendar-wrap {
  overflow: hidden; border: 1px solid var(--rule); border-radius: 8px;
  background: rgba(0,0,0,0.18);
}
.planner-calendar {
  width: 100%; min-width: 0; display: grid;
  grid-template-columns: minmax(42px, 54px) repeat(var(--planner-days), minmax(0, 1fr));
  grid-template-rows: 34px repeat(var(--planner-rows), 46px);
  position: relative;
}
.planner-calendar-head, .planner-time-label, .planner-calendar-cell {
  border-right: 1px solid rgba(255,255,255,0.075);
  border-bottom: 1px solid rgba(255,255,255,0.075);
}
.planner-calendar-head {
  display: grid; place-items: center; color: var(--ink-3);
  font-size: 12px; font-weight: 800; background: rgba(255,255,255,0.04);
}
.planner-calendar-head.time { color: var(--ink-4); }
.planner-time-label {
  padding: 5px 6px 0 0; text-align: right; color: var(--ink-4);
  font-size: 10px; background: rgba(255,255,255,0.025);
  display: grid; align-content: start; gap: 1px; font-variant-numeric: tabular-nums;
}
.planner-time-label strong { color: var(--ink-3); font-size: 10px; }
.planner-time-label span { font-size: 9.5px; }
.planner-calendar-cell { min-height: 46px; background: rgba(255,255,255,0.012); }
.planner-calendar-cell.hour { border-bottom-color: rgba(255,255,255,0.15); }
.planner-calendar-block {
  z-index: 1; margin: 2px; padding: 7px 8px; border-radius: 6px;
  background: var(--planner-block, rgba(92,225,230,0.32));
  border: 1px solid rgba(255,255,255,0.28); color: #f8ffff;
  overflow: hidden; display: grid; align-content: start; gap: 2px;
  box-shadow: 0 8px 22px rgba(0,0,0,0.18); text-align: left; cursor: pointer;
  font: inherit;
}
.planner-calendar-block.locked { outline: 2px solid rgba(255,255,255,0.82); outline-offset: -3px; }
.planner-calendar-block.removing { opacity: 0.45; filter: grayscale(1); }
.planner-calendar-block strong {
  font-size: 12px; line-height: 1.2; color: #fff; overflow-wrap: anywhere;
}
.planner-calendar-block span, .planner-calendar-block small {
  color: rgba(255,255,255,0.82); font-size: 11px; line-height: 1.25;
}
.planner-search-panel {
  display: grid; gap: 9px; padding: 12px; border: 1px solid var(--rule); border-radius: 8px;
  background: rgba(255,255,255,0.028);
}
.planner-search-head {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center;
}
.planner-search-head span { color: var(--ink-3); font-size: 12px; font-weight: 750; }
.planner-search-results { display: grid; gap: 7px; }
.planner-search-empty { color: var(--ink-4); font-size: 12px; }
.planner-search-row {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center;
  padding: 9px; border: 1px solid var(--rule); border-radius: 8px; background: rgba(0,0,0,0.16);
}
.planner-search-row strong { color: var(--ink); font-size: 13px; }
.planner-search-row span { display: block; margin-top: 2px; color: var(--ink-3); font-size: 11px; line-height: 1.3; }
.planner-search-row button {
  border: 1px solid var(--rule); border-radius: 8px; background: rgba(255,255,255,0.08);
  color: var(--ink); padding: 7px 10px; font: inherit; font-size: 12px; font-weight: 850; cursor: pointer;
}
.planner-pools { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.planner-pool {
  border: 1px solid var(--rule); border-radius: 8px; padding: 13px;
  background: rgba(255,255,255,0.03); display: grid; gap: 9px; align-content: start;
}
.planner-pool h3 { margin: 0; font-size: 14px; display: flex; justify-content: space-between; gap: 8px; }
.planner-course-row {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 8px; padding: 10px; border-radius: 8px;
  background: rgba(0,0,0,0.18); border: 1px solid transparent; text-align: left; font: inherit; cursor: pointer;
}
.planner-course-row div { display: grid; gap: 2px; min-width: 0; }
.planner-course-row strong { color: var(--ink); overflow-wrap: anywhere; }
.planner-course-row span, .planner-course-row small, .planner-pool-empty { color: var(--ink-3); }
.planner-course-row small { grid-column: 1 / -1; }
.planner-course-row em {
  align-self: start; border-radius: 999px; padding: 2px 6px; color: var(--ink-4);
  background: rgba(255,255,255,0.06); font-size: 10px; font-style: normal; font-weight: 800;
}
.planner-course-row.locked {
  border-color: rgba(92,225,230,0.5); background: rgba(92,225,230,0.1);
}
.planner-course-row.locked em { color: var(--ink); background: rgba(92,225,230,0.22); }
@media (max-width: 760px) {
  .planner-panel { grid-template-columns: 1fr; }
  .planner-control, .planner-button { width: 100%; }
  .planner-count-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .planner-toolbar { grid-template-columns: 1fr; }
  .planner-search-head { grid-template-columns: 1fr; }
  .planner-filter-head { display: grid; }
  .planner-toggle-row, .planner-toggle-row.period { grid-template-columns: repeat(5, minmax(44px, 1fr)); }
  .planner-toggle-row.grade { grid-template-columns: repeat(3, minmax(44px, 1fr)); }
  .planner-toggle { min-height: 40px; padding: 5px 3px; }
  .planner-toggle small { font-size: 9px; }
  .planner-category-grid { grid-template-columns: 1fr; }
  .planner-pools { grid-template-columns: 1fr; }
  .planner-calendar {
    grid-template-columns: minmax(36px, 42px) repeat(var(--planner-days), minmax(0, 1fr));
    grid-template-rows: 32px repeat(var(--planner-rows), 42px);
  }
  .planner-calendar-head { font-size: 11px; }
  .planner-time-label { padding: 4px 3px 0 0; font-size: 9px; }
  .planner-time-label strong { font-size: 9px; }
  .planner-time-label span { font-size: 8px; }
  .planner-calendar-cell { min-height: 42px; }
  .planner-calendar-block { margin: 1px; padding: 4px; gap: 1px; }
  .planner-calendar-block strong { font-size: 10px; line-height: 1.12; }
  .planner-calendar-block span, .planner-calendar-block small { font-size: 9px; line-height: 1.12; }
  .grad-area-list { grid-template-columns: 1fr; }
  .grad-course-detail-row { grid-template-columns: 1fr; }
  .choice-options { display: grid; grid-template-columns: 1fr; }
  .choice-option { border-radius: 8px; }
}

::selection { background: var(--accent-soft); color: var(--ink); }
</style>`;
}

// ── dataType별 렌더러 ─────────────────────────────────

function renderData(dataType: string, data: unknown): string {
  if (!data) return "";
  const renderers: Record<string, (d: unknown) => string> = {
    timetable: renderTimetable,
    "timetable-planner": renderTimetablePlanner,
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

type PlannerCategory = "major" | "elective" | "unknown";

type PlannerCategoryTarget = {
  key: string;
  label: string;
  parentCategory: PlannerCategory;
  count: number;
  available: number;
};

type PlannerRequirementTarget = {
  key: string;
  label: string;
  parentCategory: PlannerCategory;
  courseKeys: string[];
  aliases: string[];
};

type RequirementChoiceView = "timetable" | "graduation";

type RequirementChoiceOption = {
  key: string;
  label: string;
  courseTitles: string[];
  courseCodes: string[];
  requirementKeys: string[];
  courseGroupKeys: string[];
  note?: string;
};

type RequirementChoiceGroup = {
  key: string;
  label: string;
  required: boolean;
  appliesToView: "timetable" | "graduation" | "both";
  sourceTitle?: string;
  sourceUrl?: string;
  unresolvedReason?: string;
  selectable: boolean;
  options: RequirementChoiceOption[];
};

type RequirementChoiceSelections = Record<string, string>;

type PlannerGradeFilter = {
  key: string;
  label: string;
  available: number;
};

type PlannerDiagnosticBucket = {
  key: string;
  count: number;
};

type PlannerDiagnosticStage = {
  key: string;
  label: string;
  count: number;
  status: "ok" | "empty" | "error";
  message?: string;
};

type PlannerDiagnosticSample = {
  title: string;
  meta: string;
};

type PlannerReaderDiagnostics = {
  source: string;
  scope: string;
  departmentCandidates: string[];
  stages: PlannerDiagnosticStage[];
  categoryCounts: {
    allTerm: PlannerDiagnosticBucket[];
    departmentMatched: PlannerDiagnosticBucket[];
    readerOutput: PlannerDiagnosticBucket[];
  };
  departmentCounts: {
    allTerm: PlannerDiagnosticBucket[];
    departmentMatched: PlannerDiagnosticBucket[];
    readerOutput: PlannerDiagnosticBucket[];
  };
  samples: {
    allTerm: PlannerDiagnosticSample[];
    departmentMatched: PlannerDiagnosticSample[];
    readerOutput: PlannerDiagnosticSample[];
  };
  hints: string[];
};

type PlannerWrapperDiagnostics = {
  summary: string;
  stages: PlannerDiagnosticStage[];
  runtime: PlannerDiagnosticBucket[];
  topLevelKeys: string[];
  hints: string[];
};

type PlannerPayloadDiagnostics = {
  producer: string;
  diagnosticVersion?: string;
  topLevelKeys: string[];
  sourceKey: string;
  sourceLengths: PlannerDiagnosticStage[];
  payloadCounts: PlannerDiagnosticStage[];
  dataReadiness: PlannerDiagnosticStage[];
  query: PlannerDiagnosticBucket[];
  rawCategoryCounts: PlannerDiagnosticBucket[];
  rawCategoryLabelCounts: PlannerDiagnosticBucket[];
  rawDepartmentCounts: PlannerDiagnosticBucket[];
  rawGradeCounts: PlannerDiagnosticBucket[];
  rawSamples: PlannerDiagnosticSample[];
  hints: string[];
};

type PlannerUiDiagnostics = {
  rawCourses: number;
  completedKeys: number;
  afterCompleted: number;
  completedExcluded: number;
  afterChoice: number;
  initialSchedule: number;
  choiceBlocked: boolean;
  noSolution: boolean;
  allCategoryCounts: PlannerDiagnosticBucket[];
  afterCompletedCategoryCounts: PlannerDiagnosticBucket[];
  selectableCategoryCounts: PlannerDiagnosticBucket[];
  selectableGradeCounts: PlannerDiagnosticBucket[];
  hints: string[];
};

type TimetablePlannerDiagnostics = {
  payload: PlannerPayloadDiagnostics;
  wrapper?: PlannerWrapperDiagnostics;
  reader?: PlannerReaderDiagnostics;
  ui: PlannerUiDiagnostics;
};

type CatalogCourseExtraction = {
  sourceKey: string;
  courses: CatalogCourseInput[];
};

type CatalogMeetingInput = {
  weekday?: string | number;
  day?: string | number;
  dayLabel?: string;
  dayOfWeek?: number;
  start?: string;
  startTime?: string;
  end?: string;
  endTime?: string;
  time?: string;
  timeRange?: string;
  rawTimeRange?: string;
  rawTime?: string;
  location?: string;
};

type CatalogCourseInput = {
  year?: number;
  termCode?: string;
  termLabel?: string;
  category?: string;
  categoryLabel?: string;
  courseCode?: string;
  curriculumNumber?: string;
  curiNum?: string;
  section?: string;
  courseTitle?: string;
  title?: string;
  gradeLevel?: string | number;
  grade?: string | number;
  credit?: number;
  credits?: number;
  professor?: string;
  location?: string;
  meetings?: unknown;
  timeRange?: string;
  rawTimeRange?: string;
  rawTime?: string;
};

type PlannerQueryContext = {
  year?: unknown;
  termCode?: unknown;
  termLabel?: unknown;
  category?: unknown;
  department?: unknown;
  departmentLabel?: unknown;
  displayDepartment?: unknown;
  studentStanding?: unknown;
  campus?: unknown;
};

export type PlannerMeeting = {
  dayIndex: number;
  dayLabel: string;
  start: string;
  end: string;
  startMinutes: number;
  endMinutes: number;
  raw: string;
  location?: string;
};

export type PlannerCourse = {
  id: string;
  title: string;
  courseCode?: string;
  section?: string;
  credit: number;
  category: PlannerCategory;
  categoryLabel: string;
  categoryKey: string;
  gradeLevel?: string;
  gradeKey?: string;
  year?: number;
  termCode?: string;
  termLabel?: string;
  professor?: string;
  requirementKeys?: string[];
  requirementLabels?: string[];
  meetings: PlannerMeeting[];
};

export type TimetablePlannerModel = {
  courses: PlannerCourse[];
  queryMeta: string;
  majorCount: number;
  electiveCount: number;
  majorAvailable: number;
  electiveAvailable: number;
  categoryTargets: PlannerCategoryTarget[];
  gradeFilters: PlannerGradeFilter[];
  unknownCourses: PlannerCourse[];
  initialSchedule: PlannerCourse[];
  completedExcludedCount: number;
  noSolution: boolean;
  showAllCourses: boolean;
  choiceGroups: RequirementChoiceGroup[];
  selectedChoiceKeys: RequirementChoiceSelections;
  choiceBlocked: boolean;
  choiceMissingLabels: string[];
  diagnostics: TimetablePlannerDiagnostics;
};

type PlannerScheduleItem = {
  course: PlannerCourse;
  meeting: PlannerMeeting;
};

type PlannerGenerateOptions = {
  disabledDays?: number[];
  disabledPeriods?: number[];
  disabledGradeKeys?: string[];
  lockedCourseIds?: string[];
  categoryTargets?: PlannerCategoryTarget[];
};

function renderTimetablePlanner(data: unknown): string {
  const model = buildTimetablePlannerModel(data);
  if (!model.courses.length) {
    return `<section class="section planner-section"><div class="planner-empty">시간표 설계에 사용할 강의 목록이 없습니다.</div>${model.queryMeta ? `<div class="section-sub">${model.queryMeta} 기준</div>` : ""}${renderPlannerDiagnostics(model.diagnostics)}</section>`;
  }

  const term = model.queryMeta || joinMeta([
    model.courses.find((course) => course.year)?.year,
    model.courses.find((course) => course.termLabel)?.termLabel,
  ]);
  const scheduleHtml = model.initialSchedule.length
    ? renderPlannerSchedule(model.initialSchedule)
    : model.choiceBlocked
      ? renderPlannerBlockedChoice(model.choiceMissingLabels)
      : `<div class="planner-no-solution">선택한 과목 수로는 시간이 겹치지 않는 시간표를 만들 수 없습니다.</div>`;
  const dataJson = jsonForInlineScript({
    courses: model.courses,
    initialCourseIds: model.initialSchedule.map((course) => course.id),
    majorCount: model.majorCount,
    electiveCount: model.electiveCount,
    categoryTargets: model.categoryTargets,
    gradeFilters: model.gradeFilters,
    periods: PLANNER_PERIODS,
    showAllCourses: model.showAllCourses,
    completedExcludedCount: model.completedExcludedCount,
    choiceGroups: model.choiceGroups,
    selectedChoiceKeys: model.selectedChoiceKeys,
    choiceBlocked: model.choiceBlocked,
    diagnostics: model.diagnostics,
  });

  let html = `<section class="section planner-section" data-timetable-planner>`;
  html += `<div class="planner-panel">`;
  html += `<div class="planner-copy"><div class="planner-kicker">${esc(term || "개설강좌")}</div><h2>시간표 설계</h2><p>공식 개설강좌와 졸업요건 선택값을 바탕으로, 겹치지 않는 주간 시간표 조합을 만듭니다.</p></div>`;
  html += `<div class="planner-controls">`;
  html += `<div class="planner-count-grid">`;
  html += renderPlannerControl("major", "전공 과목", model.majorCount, model.majorAvailable);
  html += renderPlannerControl("elective", "교양/선택 과목", model.electiveCount, model.electiveAvailable);
  html += `</div></div></div>`;
  html += renderPlannerAvailabilityControls(model);
  html += `<div class="planner-workspace">`;
  html += `<div class="planner-toolbar"><button class="planner-button" type="button" data-planner-generate>무작위 시간표 만들기</button><div><div class="planner-credit-summary" data-planner-credit-summary></div><div class="planner-hint">좌클릭 잠금 · 우클릭 제거 · 검색으로 직접 추가</div></div></div>`;
  html += `<div class="planner-status-sr" data-planner-status aria-live="polite"></div>`;
  html += `<div class="planner-result" data-planner-result>${scheduleHtml}</div>`;
  html += renderPlannerSearchPanel();
  html += `</div>`;
  html += renderPlannerDiagnostics(model.diagnostics);
  html += `<script type="application/json" id="planner-data">${dataJson}</script>`;
  html += `<script>${plannerClientScript()}</script>`;
  html += `</section>`;
  return html;
}

function renderPlannerBlockedChoice(labels: string[]): string {
  const suffix = labels.length ? ` (${labels.join(", ")})` : "";
  return `<div class="planner-no-solution" data-planner-choice-blocked>선택형 요건을 먼저 선택해야 시간표를 만들 수 있습니다${esc(suffix)}.</div>`;
}

function renderPlannerControl(kind: string, label: string, value: number, max: number): string {
  return `<div class="planner-control"><span>${esc(label)}</span><div class="planner-stepper"><button type="button" data-planner-step="${kind}" data-step-delta="-1" aria-label="${esc(`${label} 줄이기`)}">−</button><input type="text" readonly value="${value}" data-planner-count="${kind}" inputmode="numeric" aria-label="${esc(label)}"><button type="button" data-planner-step="${kind}" data-step-delta="1" aria-label="${esc(`${label} 늘리기`)}">+</button></div><small>최대 ${PLANNER_MAX_BASIC_COUNT}개 · 가능 ${max}개</small></div>`;
}

function renderPlannerSearchPanel(): string {
  return `<div class="planner-search-panel"><div class="planner-search-head"><input class="planner-search-input" type="search" placeholder="과목명, 교수명, 구분으로 검색" data-planner-search><span data-planner-search-count>직접 추가</span></div><div class="planner-search-results" data-planner-search-results><div class="planner-search-empty">검색어를 입력하면 추가 가능한 과목이 표시됩니다.</div></div></div>`;
}

function renderPlannerDiagnostics(diagnostics: TimetablePlannerDiagnostics): string {
  const reader = diagnostics.reader;
  const wrapper = diagnostics.wrapper;
  const payload = diagnostics.payload;
  const wrapperStages = wrapper?.stages.length
    ? wrapper.stages.map(renderPlannerDiagnosticStage).join("")
    : `<div class="planner-diag-empty">wrapper 진단 payload가 없습니다.</div>`;
  const readerStages = reader?.stages.length
    ? reader.stages.map(renderPlannerDiagnosticStage).join("")
    : `<div class="planner-diag-empty">reader 진단 payload가 없습니다.</div>`;
  const uiStages = [
    { key: "ui.raw", label: "UI payload", count: diagnostics.ui.rawCourses, status: diagnostics.ui.rawCourses ? "ok" as const : "empty" as const },
    { key: "ui.completedKeys", label: "이수 키", count: diagnostics.ui.completedKeys, status: "ok" as const },
    { key: "ui.completedExcluded", label: "이수 제외", count: diagnostics.ui.completedExcluded, status: "ok" as const },
    { key: "ui.afterCompleted", label: "이수/수강중 제외 후", count: diagnostics.ui.afterCompleted, status: diagnostics.ui.afterCompleted ? "ok" as const : "empty" as const },
    { key: "ui.afterChoice", label: "선택조건 후", count: diagnostics.ui.afterChoice, status: diagnostics.ui.afterChoice ? "ok" as const : "empty" as const },
    { key: "ui.initialSchedule", label: "초기 시간표", count: diagnostics.ui.initialSchedule, status: diagnostics.ui.initialSchedule ? "ok" as const : "empty" as const },
  ].map(renderPlannerDiagnosticStage).join("");
  const hints = [
    ...(wrapper?.hints ?? []),
    ...payload.hints,
    ...(reader?.hints ?? []),
    ...diagnostics.ui.hints,
  ].filter(Boolean);

  return `<div class="planner-diagnostics" data-planner-diagnostics>
    <div class="planner-diag-head">
      <div><strong>임시 진단 카드</strong><span>시간표 누락 원인을 찾기 위한 숫자입니다. 확인 후 제거할 수 있습니다.</span></div>
      <small>${esc(joinMeta([wrapper?.summary, payload.producer, reader?.source, reader?.scope]))}</small>
    </div>
    <div class="planner-diag-section"><h3>payload 경로</h3><div class="planner-diag-grid">
      ${renderPlannerDiagnosticStage({ key: "payload.producer", label: payload.producer || "producer 없음", count: payload.diagnosticVersion ? Number(payload.diagnosticVersion) || 1 : 0, status: payload.producer ? "ok" : "empty" })}
      ${renderPlannerDiagnosticStage({ key: "payload.sourceKey", label: `강의 배열: ${payload.sourceKey}`, count: diagnostics.ui.rawCourses, status: diagnostics.ui.rawCourses ? "ok" : "empty" })}
      ${renderPlannerDiagnosticStage({ key: "payload.keys", label: "rawData top-level keys", count: payload.topLevelKeys.length, status: payload.topLevelKeys.length ? "ok" : "empty", message: payload.topLevelKeys.slice(0, 18).join(", ") })}
    </div></div>
    <div class="planner-diag-section"><h3>wrapper 실행</h3><div class="planner-diag-grid">${wrapperStages}</div><div class="planner-diag-buckets">
      ${renderPlannerDiagnosticBuckets("wrapper runtime", wrapper?.runtime)}
      ${renderPlannerDiagnosticBuckets("wrapper rawData keys", wrapper?.topLevelKeys.map((key) => ({ key, count: 1 })), 14)}
    </div></div>
    <div class="planner-diag-section"><h3>payload count/source</h3><div class="planner-diag-grid">${[...payload.payloadCounts, ...payload.sourceLengths].map(renderPlannerDiagnosticStage).join("")}</div></div>
    <div class="planner-diag-section"><h3>dataReadiness</h3><div class="planner-diag-grid">${payload.dataReadiness.length ? payload.dataReadiness.map(renderPlannerDiagnosticStage).join("") : `<div class="planner-diag-empty">dataReadiness 배열이 없습니다.</div>`}</div></div>
    <div class="planner-diag-section"><h3>query</h3><div class="planner-diag-buckets">${renderPlannerDiagnosticBuckets("query", payload.query, 14)}</div></div>
    <div class="planner-diag-section"><h3>reader 단계</h3><div class="planner-diag-grid">${readerStages}</div></div>
    <div class="planner-diag-section"><h3>웹뷰 단계</h3><div class="planner-diag-grid">${uiStages}</div></div>
    <div class="planner-diag-section"><h3>분류 카운트</h3><div class="planner-diag-buckets">
      ${renderPlannerDiagnosticBuckets("raw category", payload.rawCategoryCounts)}
      ${renderPlannerDiagnosticBuckets("raw categoryLabel", payload.rawCategoryLabelCounts)}
      ${renderPlannerDiagnosticBuckets("raw department", payload.rawDepartmentCounts)}
      ${renderPlannerDiagnosticBuckets("raw grade", payload.rawGradeCounts)}
      ${renderPlannerDiagnosticBuckets("reader 전체", reader?.categoryCounts.allTerm)}
      ${renderPlannerDiagnosticBuckets("reader 학과필터", reader?.categoryCounts.departmentMatched)}
      ${renderPlannerDiagnosticBuckets("reader 출력", reader?.categoryCounts.readerOutput)}
      ${renderPlannerDiagnosticBuckets("UI 전체", diagnostics.ui.allCategoryCounts)}
      ${renderPlannerDiagnosticBuckets("이수 제외 후", diagnostics.ui.afterCompletedCategoryCounts)}
      ${renderPlannerDiagnosticBuckets("선택 가능", diagnostics.ui.selectableCategoryCounts)}
      ${renderPlannerDiagnosticBuckets("학년", diagnostics.ui.selectableGradeCounts)}
    </div></div>
    <div class="planner-diag-section"><h3>학과 필터</h3><div class="planner-diag-buckets">
      ${renderPlannerDiagnosticBuckets("학과 후보", (reader?.departmentCandidates ?? []).map((key) => ({ key, count: 1 })))}
      ${renderPlannerDiagnosticBuckets("DB/JSON 학과", reader?.departmentCounts.departmentMatched)}
      ${renderPlannerDiagnosticBuckets("reader output 학과", reader?.departmentCounts.readerOutput)}
    </div></div>
    <div class="planner-diag-section"><h3>샘플</h3><div class="planner-diag-buckets">
      ${renderPlannerDiagnosticSamples("raw sample", payload.rawSamples)}
      ${renderPlannerDiagnosticSamples("reader allTerm sample", reader?.samples.allTerm)}
      ${renderPlannerDiagnosticSamples("reader department sample", reader?.samples.departmentMatched)}
      ${renderPlannerDiagnosticSamples("reader output sample", reader?.samples.readerOutput)}
    </div></div>
    ${hints.length ? `<div class="planner-diag-hints">${hints.map((hint) => `<p>${esc(hint)}</p>`).join("")}</div>` : ""}
  </div>`;
}

function renderPlannerDiagnosticStage(stage: PlannerDiagnosticStage): string {
  return `<div class="planner-diag-chip ${esc(stage.status)}" data-diag-stage="${esc(stage.key)}"><span>${esc(stage.label)}</span><strong>${stage.count}</strong>${stage.message ? `<small>${esc(stage.message)}</small>` : ""}</div>`;
}

function renderPlannerDiagnosticBuckets(
  label: string,
  buckets: PlannerDiagnosticBucket[] | undefined,
  limit = 8,
): string {
  if (!buckets?.length) {
    return `<div class="planner-diag-bucket"><strong>${esc(label)}</strong><span>없음</span></div>`;
  }
  return `<div class="planner-diag-bucket"><strong>${esc(label)}</strong><div>${buckets.slice(0, limit).map((bucket) => `<span>${esc(bucket.key)} <em>${bucket.count}</em></span>`).join("")}</div></div>`;
}

function renderPlannerDiagnosticSamples(
  label: string,
  samples: PlannerDiagnosticSample[] | undefined,
): string {
  if (!samples?.length) {
    return `<div class="planner-diag-bucket"><strong>${esc(label)}</strong><span>없음</span></div>`;
  }
  return `<div class="planner-diag-bucket"><strong>${esc(label)}</strong><div>${samples.slice(0, 8).map((sample) => `<span>${esc(sample.title)}${sample.meta ? ` <em>${esc(sample.meta)}</em>` : ""}</span>`).join("")}</div></div>`;
}

function renderPlannerAvailabilityControls(model: TimetablePlannerModel): string {
  const dayToggles = Array.from({ length: PLANNER_WEEKDAY_COUNT }, (_, day) =>
    `<button class="planner-toggle active" type="button" data-planner-day="${day}" aria-pressed="true"><span>${esc(plannerDayLabel(day))}</span></button>`,
  ).join("");
  const periodToggles = PLANNER_PERIODS.map((period) =>
    `<button class="planner-toggle active" type="button" data-planner-period="${period.index}" aria-pressed="true"><span>${esc(period.label)}</span><small>${esc(`${clockFromMinutes(period.startMinutes)}~${clockFromMinutes(period.endMinutes)}`)}</small></button>`,
  ).join("");
  const gradeToggles = model.gradeFilters.map((grade) =>
    `<button class="planner-toggle active" type="button" data-planner-grade="${esc(grade.key)}" aria-pressed="true"><span>${esc(grade.label)}</span><small>${grade.available}개</small></button>`,
  ).join("");
  const categoryInputs = model.categoryTargets.map((target) =>
    `<label class="planner-control planner-category-control"><span>${esc(target.label)}</span><div class="planner-stepper"><button type="button" data-planner-step="${esc(target.key)}" data-step-delta="-1" aria-label="${esc(`${target.label} 줄이기`)}">−</button><input type="text" readonly value="${target.count}" data-planner-category="${esc(target.key)}" inputmode="numeric" aria-label="${esc(target.label)}"><button type="button" data-planner-step="${esc(target.key)}" data-step-delta="1" aria-label="${esc(`${target.label} 늘리기`)}">+</button></div><small>${esc(target.parentCategory === "major" ? "전공" : "교양/선택")} · 가능 ${target.available}개</small></label>`,
  ).join("");
  const sourceSummary = renderRequirementChoiceSourceSummary(model.choiceGroups);

  return `<div class="planner-filter-panel">
    ${renderRequirementChoiceControls(model.choiceGroups, model.selectedChoiceKeys, "planner")}
    <div class="planner-filter-group"><div class="planner-filter-head"><strong>요일 제외</strong><span>누르면 해당 요일 강의가 빠집니다.</span></div><div class="planner-toggle-row">${dayToggles}</div></div>
    <div class="planner-filter-group"><div class="planner-filter-head"><strong>교시 제외</strong><span>50분 단위 교시를 닫을 수 있습니다.</span></div><div class="planner-toggle-row period">${periodToggles}</div></div>
    <div class="planner-filter-group"><div class="planner-filter-head"><strong>학년 제외</strong><span>누르면 해당 학년 과목이 빠집니다.</span></div><div class="planner-toggle-row grade">${gradeToggles}</div></div>
    <details class="planner-advanced"><summary>세부 카테고리 설정</summary><label class="planner-advanced-switch"><input type="checkbox" data-planner-advanced> 세부 카테고리 개수로 맞추기</label><div class="planner-category-grid">${categoryInputs || `<div class="planner-pool-empty">세부 카테고리 정보가 없습니다.</div>`}</div></details>
    ${sourceSummary}
  </div>`;
}

function renderPlannerPools(model: TimetablePlannerModel): string {
  const buckets: Array<[string, PlannerCourse[]]> = [
    ["전공", model.courses.filter((course) => course.category === "major")],
    ["교양/선택", model.courses.filter((course) => course.category === "elective")],
    ["미분류", model.unknownCourses],
  ];
  return `<div class="planner-pools">${buckets.map(([label, courses]) => `<section class="planner-pool"><h3>${esc(label)} <span>${courses.length}</span></h3>${courses.length ? courses.map(renderPlannerCourseRow).join("") : `<div class="planner-pool-empty">해당 과목이 없습니다.</div>`}</section>`).join("")}</div>`;
}

function renderPlannerCourseRow(course: PlannerCourse): string {
  return `<button class="planner-course-row" type="button" data-course-id="${esc(course.id)}" data-category="${course.category}" aria-pressed="false"><div><strong>${esc(plannerCourseTitleWithCredit(course))}</strong><span>${esc(plannerCourseMetaLabel(course))}</span></div><small>${esc(plannerMeetingSummary(course) || "시간 미정")}</small><em>잠금</em></button>`;
}

function renderRequirementChoiceControls(
  groups: RequirementChoiceGroup[],
  selected: RequirementChoiceSelections,
  scope: "planner" | "graduation",
): string {
  if (!groups.length) return "";
  const rendered = groups.map((group) => {
    const groupName = `${scope}-choice-${group.key}`;
    const selectedKey = selected[group.key] ?? "";
    const options = group.selectable
      ? group.options.map((option) => {
        const checked = option.key === selectedKey ? " checked" : "";
        return `<label class="choice-option"><input type="radio" name="${esc(groupName)}" value="${esc(option.key)}" data-${scope}-choice-option="${esc(group.key)}"${checked}> <span>${esc(option.label)}</span>${option.note ? `<small>${esc(option.note)}</small>` : ""}</label>`;
      }).join("")
      : `<div class="choice-unprovided">${esc(group.unresolvedReason || "공식 출처 확인 필요")}</div>`;
    const status = group.selectable
      ? selectedKey
        ? "선택됨"
        : group.required
          ? "선택 필요"
          : "선택"
      : "확인 필요";
    return `<fieldset class="choice-group" data-${scope}-choice-group="${esc(group.key)}" data-required="${group.required ? "true" : "false"}" data-selectable="${group.selectable ? "true" : "false"}"><legend><span>${esc(group.label)}</span><em data-${scope}-choice-status="${esc(group.key)}">${esc(status)}</em></legend><div class="choice-options">${options}</div></fieldset>`;
  }).join("");
  return `<div class="choice-panel ${scope}-choice-panel">${rendered}</div>`;
}

function renderRequirementChoiceSourceSummary(groups: RequirementChoiceGroup[]): string {
  const links = new Map<string, string>();
  for (const group of groups) {
    if (!group.sourceUrl || !/^https?:\/\//i.test(group.sourceUrl)) continue;
    const title = group.sourceTitle || "공식 출처";
    links.set(`${group.sourceUrl}\u0000${title}`, `<a href="${esc(group.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`);
  }
  if (!links.size) return "";
  return `<div class="choice-source-list"><span>공식 출처</span>${[...links.values()].join("")}</div>`;
}

function renderPlannerSchedule(courses: PlannerCourse[]): string {
  const sortedMeetings = courses
    .flatMap((course) => course.meetings.map((meeting) => ({ course, meeting })))
    .sort((a, b) => a.meeting.dayIndex - b.meeting.dayIndex || a.meeting.startMinutes - b.meeting.startMinutes || a.course.title.localeCompare(b.course.title));
  if (!sortedMeetings.length) {
    return `<div class="planner-no-solution">선택된 과목에 표시할 수 있는 수업 시간이 없습니다.</div>`;
  }
  return renderPlannerCalendar(sortedMeetings);
}

function renderPlannerCalendar(items: PlannerScheduleItem[]): string {
  const dayCount = plannerVisibleDayCount(items);
  const bounds = plannerCalendarBounds(items);
  const colorMap = plannerCourseColorMap(items.map((item) => item.course));
  const headers = [
    `<div class="planner-calendar-head time" style="grid-column:1;grid-row:1">시간</div>`,
    ...Array.from({ length: dayCount }, (_, day) => `<div class="planner-calendar-head" style="grid-column:${day + 2};grid-row:1">${esc(plannerDayLabel(day))}</div>`),
  ].join("");
  return `<div class="planner-calendar-wrap"><div class="planner-calendar" style="--planner-days:${dayCount};--planner-rows:${bounds.rowCount}">${headers}${renderPlannerTimeLabels(bounds)}${renderPlannerCalendarCells(dayCount, bounds.rowCount)}${items.map((item) => renderPlannerCalendarBlock(item, bounds, colorMap)).join("")}</div></div>`;
}

function plannerVisibleDayCount(items: PlannerScheduleItem[]): number {
  return PLANNER_WEEKDAY_COUNT;
}

function plannerCalendarBounds(items: PlannerScheduleItem[]): { startMinutes: number; endMinutes: number; rowCount: number } {
  const first = PLANNER_PERIODS[0]!;
  const last = PLANNER_PERIODS[PLANNER_PERIODS.length - 1]!;
  return {
    startMinutes: first.startMinutes,
    endMinutes: last.endMinutes,
    rowCount: PLANNER_PERIODS.length,
  };
}

function renderPlannerTimeLabels(bounds: { startMinutes: number; endMinutes: number }): string {
  return PLANNER_PERIODS.map((period) =>
    `<div class="planner-time-label" style="grid-column:1;grid-row:${period.index + 2}"><strong>${esc(period.label)}</strong><span>${esc(`${clockFromMinutes(period.startMinutes)}~${clockFromMinutes(period.endMinutes)}`)}</span></div>`,
  ).join("");
}

function renderPlannerCalendarCells(dayCount: number, rowCount: number): string {
  const cells: string[] = [];
  for (let day = 0; day < dayCount; day++) {
    for (let slot = 0; slot < rowCount; slot++) {
      cells.push(`<div class="planner-calendar-cell${slot % 2 === 1 ? " hour" : ""}" style="grid-column:${day + 2};grid-row:${slot + 2}"></div>`);
    }
  }
  return cells.join("");
}

function renderPlannerCalendarBlock(item: PlannerScheduleItem, bounds: { startMinutes: number; rowCount: number }, colorMap: Map<string, string>): string {
  const startSlot = plannerMeetingStartPeriod(item.meeting);
  const endSlot = Math.min(bounds.rowCount, plannerMeetingEndPeriod(item.meeting));
  const safeEndSlot = Math.max(startSlot + 1, endSlot);
  const column = Math.max(2, Math.min(PLANNER_WEEKDAY_COUNT + 1, item.meeting.dayIndex + 2));
  const displayTitle = plannerCourseTitleWithCredit(item.course);
  const meta = joinMeta([plannerCourseMetaLabel(item.course), item.course.professor, plannerLocationLabel(item.meeting.location)]);
  const color = plannerCourseColor(item.course, colorMap);
  return `<button class="planner-calendar-block" type="button" data-course-id="${esc(item.course.id)}" style="grid-column:${column};grid-row:${startSlot + 2} / ${safeEndSlot + 2};--planner-block:${color}" aria-pressed="false" aria-label="${esc(`${displayTitle} ${plannerDayLabel(item.meeting.dayIndex)} ${item.meeting.start}-${item.meeting.end}`)}"><strong>${esc(displayTitle)}</strong><span>${esc(`${item.meeting.start}-${item.meeting.end}`)}</span>${meta ? `<small>${esc(meta)}</small>` : ""}</button>`;
}

function plannerCourseColor(course: PlannerCourse, colorMap: Map<string, string>): string {
  return colorMap.get(plannerCourseColorKey(course)) ?? plannerColorAt(0);
}

function plannerCourseColorMap(courses: PlannerCourse[]): Map<string, string> {
  const keys = Array.from(new Set(courses.map(plannerCourseColorKey).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko"));
  return new Map(keys.map((key, index) => [key, plannerColorAt(index)]));
}

function plannerCourseColorKey(course: PlannerCourse): string {
  return (course.title || course.id).trim().toLowerCase();
}

function plannerColorAt(index: number): string {
  const palette = PLANNER_BLOCK_COLORS[index];
  if (palette) return palette;
  const hue = Math.round(((index * 137.508) % 360) * 1000) / 1000;
  return `hsl(${hue} 68% 48% / 0.72)`;
}

export function buildTimetablePlannerModel(data: unknown): TimetablePlannerModel {
  const d = (data && typeof data === "object" && !Array.isArray(data)) ? data as Record<string, unknown> : {};
  const choiceGroups = normalizeRequirementChoiceGroups(d, "timetable");
  const selectedChoiceKeys = selectedRequirementChoices(d, "timetable");
  const choiceMissing = choiceSelectionMissing(choiceGroups, selectedChoiceKeys);
  const choiceBlocked = choiceMissing.length > 0;
  const requirementTargets = buildPlannerRequirementTargets(d);
  const extraction = extractCatalogCourseInputs(d);
  const allCourses = extraction.courses
    .map(normalizePlannerCourse)
    .filter((course): course is PlannerCourse => Boolean(course))
    .map((course) => attachPlannerRequirementTargets(course, requirementTargets));
  const queryMeta = plannerQueryMeta(d, allCourses);
  const completedKeys = extractCompletedPlannerCourseKeys(d);
  const courses = allCourses.filter((course) => !plannerCourseIsCompleted(course, completedKeys));
  const selectableCourses = choiceBlocked ? courses : plannerCoursesForChoiceSelection(courses, choiceGroups, selectedChoiceKeys);
  const majorCourses = selectableCourses.filter((course) => course.category === "major");
  const electiveCourses = selectableCourses.filter((course) => course.category === "elective");
  const unknownCourses = selectableCourses.filter((course) => course.category === "unknown");
  const majorAvailable = plannerDistinctCourseCount(majorCourses);
  const electiveAvailable = plannerDistinctCourseCount(electiveCourses);
  const requestedMajor = numberFrom(d.majorCount) ?? Math.min(2, majorAvailable);
  const requestedElective = numberFrom(d.electiveCount ?? d.liberalElectiveCount ?? d.electiveOrLiberalCount) ?? Math.min(2, electiveAvailable);
  const majorCount = clampCount(requestedMajor, PLANNER_MAX_BASIC_COUNT);
  const electiveCount = clampCount(requestedElective, PLANNER_MAX_BASIC_COUNT);
  const categoryTargets = buildPlannerCategoryTargets(selectableCourses, d.categoryTargets, requirementTargets);
  const gradeFilters = buildPlannerGradeFilters(selectableCourses);
  const showAllCourses = booleanFrom(d.showAllCourses ?? d.displayAllCourses);
  const initialSchedule = choiceBlocked
    ? []
    : showAllCourses
      ? selectableCourses.filter((course) => course.meetings.length > 0)
      : generateTimetableSchedule(selectableCourses, majorCount, electiveCount, 0);
  const noSolution = !choiceBlocked && !showAllCourses && initialSchedule.length !== majorCount + electiveCount;
  const diagnostics = buildTimetablePlannerDiagnostics(d, {
    rawCourses: extraction.courses,
    rawSourceKey: extraction.sourceKey,
    allCourses,
    completedKeys,
    courses,
    selectableCourses,
    initialSchedule,
    choiceBlocked,
    noSolution,
  });
  return {
    courses,
    queryMeta,
    majorCount,
    electiveCount,
    majorAvailable,
    electiveAvailable,
    categoryTargets,
    gradeFilters,
    unknownCourses,
    initialSchedule,
    completedExcludedCount: allCourses.length - courses.length,
    noSolution,
    showAllCourses,
    choiceGroups,
    selectedChoiceKeys,
    choiceBlocked,
    choiceMissingLabels: choiceMissing.map((group) => group.label),
    diagnostics,
  };
}

function buildTimetablePlannerDiagnostics(
  rawData: Record<string, unknown>,
  args: {
    rawCourses: CatalogCourseInput[];
    rawSourceKey: string;
    allCourses: PlannerCourse[];
    completedKeys: Set<string>;
    courses: PlannerCourse[];
    selectableCourses: PlannerCourse[];
    initialSchedule: PlannerCourse[];
    choiceBlocked: boolean;
    noSolution: boolean;
  },
): TimetablePlannerDiagnostics {
  const uiHints: string[] = [];
  if (!args.allCourses.length) {
    uiHints.push("웹뷰 payload에서 강의 목록을 찾지 못했습니다. reader 출력 또는 wrapper 데이터 매핑을 확인해야 합니다.");
  } else if (!args.courses.length) {
    uiHints.push("강의 목록은 들어왔지만 이수/수강 중 제외 단계에서 모두 제거되었습니다. 이수 과목 매칭 키를 확인해야 합니다.");
  } else if (!args.selectableCourses.length) {
    uiHints.push("이수 제외 후 강의는 있지만 졸업요건 선택값 필터 후 모두 제거되었습니다. 영어/수학 등 선택형 기준 매핑을 확인해야 합니다.");
  }
  if (args.selectableCourses.length && !args.selectableCourses.some((course) => course.category === "major")) {
    uiHints.push("웹뷰 선택 가능 목록에 전공 과목이 없습니다. reader category 값 또는 웹뷰 분류 규칙을 확인해야 합니다.");
  }
  if (args.selectableCourses.length && !args.selectableCourses.some((course) => course.category === "elective")) {
    uiHints.push("웹뷰 선택 가능 목록에 교양/선택 과목이 없습니다. 공통교양 공유 필터와 웹뷰 분류 규칙을 확인해야 합니다.");
  }
  if (args.noSolution) {
    uiHints.push("선택 가능 강의는 있지만 요청 개수만큼 충돌 없는 초기 시간표를 만들지 못했습니다. 시간표 생성 조건을 확인해야 합니다.");
  }
  if (args.choiceBlocked) {
    uiHints.push("필수 선택형 졸업요건이 선택되지 않아 시간표 생성이 대기 중입니다.");
  }

  const payload = buildPlannerPayloadDiagnostics(rawData, args.rawCourses, args.rawSourceKey);
  const wrapper = normalizePlannerWrapperDiagnostics(rawData.wrapperDiagnostics);
  const reader = normalizePlannerReaderDiagnostics(rawData.courseCatalogDiagnostics ?? rawData.catalogDiagnostics);
  uiHints.push(...plannerRootCauseHints({
    rawCourses: args.rawCourses,
    allCourses: args.allCourses,
    courses: args.courses,
    selectableCourses: args.selectableCourses,
    payload,
    wrapper,
    reader,
  }));

  return {
    payload,
    wrapper,
    reader,
    ui: {
      rawCourses: args.allCourses.length,
      completedKeys: args.completedKeys.size,
      afterCompleted: args.courses.length,
      completedExcluded: args.allCourses.length - args.courses.length,
      afterChoice: args.selectableCourses.length,
      initialSchedule: args.initialSchedule.length,
      choiceBlocked: args.choiceBlocked,
      noSolution: args.noSolution,
      allCategoryCounts: plannerDiagnosticBucketsFromCourses(args.allCourses, "category"),
      afterCompletedCategoryCounts: plannerDiagnosticBucketsFromCourses(args.courses, "category"),
      selectableCategoryCounts: plannerDiagnosticBucketsFromCourses(args.selectableCourses, "category"),
      selectableGradeCounts: plannerDiagnosticBucketsFromCourses(args.selectableCourses, "grade"),
      hints: uiHints,
    },
  };
}

function plannerRootCauseHints(args: {
  rawCourses: CatalogCourseInput[];
  allCourses: PlannerCourse[];
  courses: PlannerCourse[];
  selectableCourses: PlannerCourse[];
  payload: PlannerPayloadDiagnostics;
  wrapper?: PlannerWrapperDiagnostics;
  reader?: PlannerReaderDiagnostics;
}): string[] {
  const hints: string[] = [];
  const rawHasMajor = args.rawCourses.some(plannerRawCourseLooksMajor);
  const uiAllHasMajor = args.allCourses.some((course) => course.category === "major");
  const afterCompletedHasMajor = args.courses.some((course) => course.category === "major");
  const selectableHasMajor = args.selectableCourses.some((course) => course.category === "major");
  const wrapperPayloadOk = args.wrapper?.stages.some((stage) => stage.key.endsWith(".hasPayloadDiagnostics") && stage.status === "ok");
  const wrapperCatalogOk = args.wrapper?.stages.some((stage) => stage.key.endsWith(".hasCourseCatalogDiagnostics") && stage.status === "ok");
  const readerAllTermHasMajor = args.reader?.categoryCounts.allTerm.some(plannerDiagnosticBucketLooksMajor) ?? false;
  const readerDepartmentHasMajor = args.reader?.categoryCounts.departmentMatched.some(plannerDiagnosticBucketLooksMajor) ?? false;
  const readerOutputHasMajor = args.reader?.categoryCounts.readerOutput.some(plannerDiagnosticBucketLooksMajor) ?? false;

  if (!args.wrapper) {
    hints.push("(여기 W0) wrapper 진단이 없습니다. 새 배포 이전에 생성된 웹뷰이거나 wrapper를 거치지 않은 저장 경로입니다.");
  } else if (!wrapperPayloadOk) {
    hints.push("(여기 W1) wrapper는 실행됐지만 reader payloadDiagnostics가 없습니다. 최신 setup은 떴지만 실행된 reader가 오래됐거나 다른 mju-news 경로를 탔는지 확인해야 합니다.");
  }

  if (!rawHasMajor) {
    if (!args.reader || !wrapperCatalogOk) {
      hints.push("(여기 M0) raw 강의 배열에 전공이 없고 reader 상세 진단도 없습니다. 현재 payload만으로는 DB 누락과 학과 필터 실패를 구분할 수 없습니다.");
    } else if (!readerAllTermHasMajor) {
      hints.push("(여기 M1) DB/JSON의 해당 연도·학기 전체에도 전공 분류가 없습니다. 개설강좌 수집/import가 교양만 넣었거나 전공 category 수집이 누락된 상태입니다.");
    } else if (!readerDepartmentHasMajor) {
      hints.push("(여기 M2) DB/JSON 전체에는 전공이 있지만 학과 필터 후 전공이 없습니다. MSI 학과명과 DB 학과명/코드 매칭 규칙이 어긋난 상태입니다.");
    } else if (!readerOutputHasMajor) {
      hints.push("(여기 M3) 학과 필터 후 전공은 남았지만 reader 출력에서 전공이 사라졌습니다. reader의 중복 제거, category 변환, 출력 변환 단계를 봐야 합니다.");
    } else {
      hints.push("(여기 M4) reader 출력에는 전공이 있는데 rawData/items나 UI 원본에는 전공이 없습니다. wrapper/view 전달 또는 source 배열 선택 경로가 어긋난 상태입니다.");
    }
  } else if (!uiAllHasMajor) {
    hints.push("(여기 U1) raw 강의에는 전공이 있지만 UI 정규화 후 전공이 없습니다. 웹뷰 category/categoryLabel 분류 규칙 문제입니다.");
  } else if (!afterCompletedHasMajor) {
    hints.push("(여기 U2) UI 원본에는 전공이 있지만 이수/수강 중 제외 후 전공이 없습니다. completed/current course 매칭이 과하게 잡힌 상태입니다.");
  } else if (!selectableHasMajor) {
    hints.push("(여기 U3) 이수 제외 후 전공이 남았지만 선택형 졸업요건/트랙 필터 후 전공이 없습니다. choiceGroups/선택값 매핑을 확인해야 합니다.");
  }

  if (args.payload.sourceKey !== "items") {
    hints.push(`(여기 S1) 웹뷰가 items가 아닌 ${args.payload.sourceKey} 배열을 강의 원본으로 사용했습니다. producer별 source 배열 우선순위를 확인해야 합니다.`);
  }

  return hints;
}

function plannerDiagnosticBucketLooksMajor(bucket: PlannerDiagnosticBucket): boolean {
  const key = bucket.key.trim().toLowerCase();
  return key === "major" || key.includes("major") || key.includes("전공");
}

function buildPlannerPayloadDiagnostics(
  rawData: Record<string, unknown>,
  rawCourses: CatalogCourseInput[],
  rawSourceKey: string,
): PlannerPayloadDiagnostics {
  const payload = unknownRecord(rawData.payloadDiagnostics ?? rawData.academicPlanningDiagnostics);
  const payloadOutput = unknownRecord(payload.output);
  const payloadSource = unknownRecord(payload.source);
  const payloadRuntime = unknownRecord(payload.runtime);
  const payloadQuery = unknownRecord(payload.query);
  const rawQuery = unknownRecord(rawData.query);
  const query = Object.keys(payloadQuery).length ? payloadQuery : rawQuery;
  const topLevelKeys = Object.keys(rawData).sort();
  const sourceLengths = ["entries", "items", "courses", "catalog"].map((key) => {
    const value = rawData[key];
    const count = Array.isArray(value) ? value.length : 0;
    return {
      key: `source.${key}`,
      label: key,
      count,
      status: count > 0 ? "ok" as const : "empty" as const,
    };
  });
  const payloadCounts = [
    ...plannerPayloadOutputStages(payloadOutput),
    ...plannerPayloadOutputStages(payloadSource, "source"),
    ...plannerPayloadOutputStages(payloadRuntime, "runtime"),
  ];
  const dataReadiness = unknownArray(rawData.dataReadiness).map((value, index) => {
    const record = unknownRecord(value);
    const target = stringFrom(record.target) || `target ${index + 1}`;
    const statusText = stringFrom(record.status);
    const count = numberFrom(record.count) ?? 0;
    const scope = plannerInlineObject(record.scope);
    const message = stringFrom(record.message);
    return {
      key: `dataReadiness.${target}`,
      label: statusText ? `${target}: ${statusText}` : target,
      count,
      status: statusText === "ready" || count > 0 ? "ok" as const : "empty" as const,
      ...(message || scope ? { message: joinMeta([message, scope]) } : {}),
    };
  });
  const hints: string[] = unknownStringArray(payload.hints);
  if (!Object.keys(payload).length) {
    hints.push("(여기 1) payloadDiagnostics가 없습니다. reader CLI 출력 또는 wrapper 전달 단계에서 진단 표식이 빠졌습니다.");
  }
  if (!rawData.courseCatalogDiagnostics && !rawData.catalogDiagnostics) {
    hints.push("(여기 2) courseCatalogDiagnostics가 rawData에 없습니다. academic-planning 출력이 오래된 reader이거나 다른 경로(course-catalog list 등)를 탔는지 확인해야 합니다.");
  }
  if (rawSourceKey === "none") {
    hints.push("(여기 3) entries/items/courses/catalog 중 강의 배열을 찾지 못했습니다. wrapper가 웹뷰 rawData를 잘못 매핑했을 가능성이 큽니다.");
  }
  if (rawCourses.length && !rawCourses.some((course) => plannerRawCourseLooksMajor(course))) {
    hints.push("(여기 4) raw 강의 배열 단계부터 전공 분류가 보이지 않습니다. DB 수집 category/categoryLabel 또는 reader 학과 필터가 전공을 잃고 있습니다.");
  }
  if (rawCourses.length && rawCourses.every((course) => !stringFrom((course as Record<string, unknown>).department))) {
    hints.push("(여기 5) raw 강의 배열에 department 값이 없습니다. 학과 필터 원인 분석에는 DB/reader 샘플이 필요합니다.");
  }

  return {
    producer: stringFrom(payload.producer) || "unknown-producer",
    diagnosticVersion: plannerScalarString(payload.diagnosticVersion),
    topLevelKeys,
    sourceKey: rawSourceKey,
    sourceLengths,
    payloadCounts,
    dataReadiness,
    query: plannerDiagnosticBucketsFromRecord(query),
    rawCategoryCounts: plannerDiagnosticBucketsFromRawCourses(rawCourses, "category"),
    rawCategoryLabelCounts: plannerDiagnosticBucketsFromRawCourses(rawCourses, "categoryLabel"),
    rawDepartmentCounts: plannerDiagnosticBucketsFromRawCourses(rawCourses, "department"),
    rawGradeCounts: plannerDiagnosticBucketsFromRawCourses(rawCourses, "grade"),
    rawSamples: rawCourses.slice(0, 8).map(plannerDiagnosticSampleFromRawCourse),
    hints,
  };
}

function plannerPayloadOutputStages(
  record: Record<string, unknown>,
  prefix = "output",
): PlannerDiagnosticStage[] {
  return Object.entries(record)
    .filter(([, value]) => typeof value === "number" || typeof value === "boolean" || typeof value === "string")
    .slice(0, 16)
    .map(([key, value]) => {
      const numeric = typeof value === "boolean"
        ? value ? 1 : 0
        : numberFrom(value) ?? (plannerScalarString(value) ? 1 : 0);
      return {
        key: `payload.${prefix}.${key}`,
        label: `${prefix}.${key}${plannerScalarString(value) && typeof value !== "number" && typeof value !== "boolean" ? `=${plannerScalarString(value)}` : ""}`,
        count: numeric,
        status: numeric > 0 ? "ok" as const : "empty" as const,
      };
    });
}

function plannerDiagnosticBucketsFromRecord(record: Record<string, unknown>): PlannerDiagnosticBucket[] {
  return Object.entries(record)
    .filter(([, value]) => value != null && plannerScalarString(value))
    .slice(0, 20)
    .map(([key, value]) => ({ key: `${key}=${plannerScalarString(value)}`, count: 1 }));
}

function plannerDiagnosticBucketsFromRawCourses(
  courses: CatalogCourseInput[],
  field: "category" | "categoryLabel" | "department" | "grade",
): PlannerDiagnosticBucket[] {
  const counts = new Map<string, number>();
  for (const course of courses) {
    const key = field === "category"
      ? stringFrom(course.category)
      : field === "categoryLabel"
        ? stringFrom(course.categoryLabel)
        : field === "department"
          ? stringFrom((course as Record<string, unknown>).department)
          : stringFrom(course.gradeLevel ?? course.grade);
    const normalized = key || "(empty)";
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, field === "department" ? 12 : 20)
    .map(([key, count]) => ({ key, count }));
}

function plannerDiagnosticSampleFromRawCourse(course: CatalogCourseInput): PlannerDiagnosticSample {
  const title = stringFrom(course.courseTitle ?? course.title) || "(title missing)";
  const code = stringFrom(course.courseCode ?? course.curriculumNumber ?? course.curiNum);
  const meta = joinMeta([
    code,
    stringFrom(course.category),
    stringFrom(course.categoryLabel),
    stringFrom((course as Record<string, unknown>).department),
    stringFrom(course.gradeLevel ?? course.grade),
    stringFrom(course.professor),
  ]);
  return { title, meta };
}

function plannerRawCourseLooksMajor(course: CatalogCourseInput): boolean {
  const category = stringFrom(course.category).toLowerCase();
  const label = stringFrom(course.categoryLabel).toLowerCase();
  return category === "major" || category.includes("major") || label.includes("전공") || label.includes("major");
}

function plannerInlineObject(value: unknown): string {
  const record = unknownRecord(value);
  return Object.entries(record)
    .slice(0, 8)
    .map(([key, item]) => `${key}=${plannerScalarString(item)}`)
    .filter(Boolean)
    .join(", ");
}

function plannerScalarString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

function normalizePlannerReaderDiagnostics(value: unknown): PlannerReaderDiagnostics | undefined {
  const record = unknownRecord(value);
  if (!Object.keys(record).length) return undefined;
  const categoryCounts = unknownRecord(record.categoryCounts);
  const departmentCounts = unknownRecord(record.departmentCounts);
  const scope = unknownRecord(record.scope);
  return {
    source: stringFrom(record.source) || "unknown",
    scope: joinMeta([
      numberFrom(scope.year) ?? stringFrom(scope.year),
      plannerTermCodeLabel(stringFrom(scope.termCode)),
      stringFrom(scope.department),
    ]),
    departmentCandidates: unknownStringArray(record.departmentCandidates),
    stages: unknownArray(record.stages).map((stage, index) => {
      const item = unknownRecord(stage);
      const status = stringFrom(item.status);
      return {
        key: stringFrom(item.key) || `reader.${index + 1}`,
        label: stringFrom(item.label) || stringFrom(item.key) || `reader ${index + 1}`,
        count: numberFrom(item.count) ?? 0,
        status: status === "error" ? "error" : status === "empty" ? "empty" : "ok",
        ...(stringFrom(item.message) ? { message: stringFrom(item.message) } : {}),
      };
    }),
    categoryCounts: {
      allTerm: normalizePlannerDiagnosticBuckets(categoryCounts.allTerm),
      departmentMatched: normalizePlannerDiagnosticBuckets(categoryCounts.departmentMatched),
      readerOutput: normalizePlannerDiagnosticBuckets(categoryCounts.readerOutput),
    },
    departmentCounts: {
      allTerm: normalizePlannerDiagnosticBuckets(departmentCounts.allTerm),
      departmentMatched: normalizePlannerDiagnosticBuckets(departmentCounts.departmentMatched),
      readerOutput: normalizePlannerDiagnosticBuckets(departmentCounts.readerOutput),
    },
    samples: {
      allTerm: normalizePlannerDiagnosticSamples(unknownRecord(record.samples).allTerm),
      departmentMatched: normalizePlannerDiagnosticSamples(unknownRecord(record.samples).departmentMatched),
      readerOutput: normalizePlannerDiagnosticSamples(unknownRecord(record.samples).readerOutput),
    },
    hints: unknownStringArray(record.hints),
  };
}

function normalizePlannerWrapperDiagnostics(value: unknown): PlannerWrapperDiagnostics | undefined {
  const record = unknownRecord(value);
  if (!Object.keys(record).length) return undefined;
  const runtime = unknownRecord(record.runtime);
  const output = unknownRecord(record.output);
  const summary = joinMeta([
    stringFrom(record.producer) || "mju-news-wrapper",
    stringFrom(record.dataType),
    stringFrom(record.commandFamily),
    stringFrom(record.generatedAt),
  ]);
  return {
    summary,
    stages: plannerPayloadOutputStages(output, "wrapper"),
    runtime: plannerDiagnosticBucketsFromRecord(runtime),
    topLevelKeys: unknownStringArray(record.topLevelKeys),
    hints: unknownStringArray(record.hints),
  };
}

function unknownRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function unknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function unknownStringArray(value: unknown): string[] {
  return unknownArray(value).map(stringFrom).filter(Boolean);
}

function normalizePlannerDiagnosticBuckets(value: unknown): PlannerDiagnosticBucket[] {
  return unknownArray(value).map((item) => {
    const record = unknownRecord(item);
    return {
      key: stringFrom(record.key) || "(empty)",
      count: numberFrom(record.count) ?? 0,
    };
  }).filter((bucket) => bucket.key || bucket.count);
}

function normalizePlannerDiagnosticSamples(value: unknown): PlannerDiagnosticSample[] {
  return unknownArray(value).map((item) => {
    const record = unknownRecord(item);
    const title = stringFrom(record.courseTitle ?? record.title) || "(title missing)";
    const meta = joinMeta([
      stringFrom(record.courseCode),
      stringFrom(record.category),
      stringFrom(record.categoryLabel),
      stringFrom(record.department),
      stringFrom(record.gradeLevel),
      stringFrom(record.section),
      stringFrom(record.professor),
    ]);
    return { title, meta };
  }).filter((sample) => sample.title);
}

function plannerDiagnosticBucketsFromCourses(
  courses: PlannerCourse[],
  field: "category" | "grade",
): PlannerDiagnosticBucket[] {
  const counts = new Map<string, number>();
  for (const course of courses) {
    const key = field === "category"
      ? plannerDiagnosticCategoryLabel(course.category)
      : course.gradeLevel || "학년 미제공";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .map(([key, count]) => ({ key, count }));
}

function plannerDiagnosticCategoryLabel(category: PlannerCategory): string {
  if (category === "major") return "전공";
  if (category === "elective") return "교양/선택";
  return "미분류";
}

function extractCatalogCourses(d: Record<string, unknown>): CatalogCourseInput[] {
  return extractCatalogCourseInputs(d).courses;
}

function extractCatalogCourseInputs(d: Record<string, unknown>): CatalogCourseExtraction {
  for (const key of ["entries", "items", "courses", "catalog"]) {
    const source = d[key];
    if (Array.isArray(source)) {
      return {
        sourceKey: key,
        courses: source.filter((item): item is CatalogCourseInput => Boolean(item) && typeof item === "object"),
      };
    }
  }
  return { sourceKey: "none", courses: [] };
}

function normalizeRequirementChoiceGroups(rawData: Record<string, unknown>, view: RequirementChoiceView): RequirementChoiceGroup[] {
  const rawGroups = Array.isArray(rawData.choiceGroups) ? rawData.choiceGroups : [];
  const seenKeys = new Set<string>();
  return rawGroups
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((group, index) => {
      const appliesToView = normalizeChoiceView(group.appliesToView);
      const key = plannerCategoryKey(stringFrom(group.key) || `choice-${index + 1}`);
      const label = stringFrom(group.label) || key;
      const sourceTitle = stringFrom(group.sourceTitle ?? group.title);
      const sourceUrl = stringFrom(group.sourceUrl ?? group.url);
      const options = normalizeRequirementChoiceOptions(group.options);
      const selectable = Boolean(sourceTitle && /^https?:\/\//i.test(sourceUrl) && options.length);
      return {
        key,
        label,
        required: booleanFrom(group.required),
        appliesToView,
        sourceTitle,
        sourceUrl,
        unresolvedReason: stringFrom(group.unresolvedReason ?? group.reason),
        selectable,
        options,
      };
    })
    .filter((group) => group.appliesToView === "both" || group.appliesToView === view)
    .filter((group) => {
      if (seenKeys.has(group.key)) return false;
      seenKeys.add(group.key);
      return true;
    });
}

function normalizeRequirementChoiceOptions(value: unknown): RequirementChoiceOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((option, index) => {
      const key = plannerCategoryKey(stringFrom(option.key) || stringFrom(option.value) || `option-${index + 1}`);
      return {
        key,
        label: stringFrom(option.label) || key,
        courseTitles: stringArrayFrom(option.courseTitles ?? option.requiredCourseTitles),
        courseCodes: stringArrayFrom(option.courseCodes ?? option.requiredCourseCodes),
        requirementKeys: stringArrayFrom(option.requirementKeys),
        courseGroupKeys: stringArrayFrom(option.courseGroupKeys ?? option.groupKeys),
        note: stringFrom(option.note),
      };
    })
    .filter((option) =>
      option.key &&
      (option.courseTitles.length > 0 ||
        option.courseCodes.length > 0 ||
        option.requirementKeys.length > 0 ||
        option.courseGroupKeys.length > 0),
    );
}

function normalizeChoiceView(value: unknown): RequirementChoiceGroup["appliesToView"] {
  const text = stringFrom(value).toLowerCase();
  if (text === "timetable" || text === "graduation") return text;
  return "both";
}

function selectedRequirementChoices(rawData: Record<string, unknown>, view: RequirementChoiceView): RequirementChoiceSelections {
  const viewSpecific = view === "timetable" ? rawData.timetableSelectedChoiceKeys : rawData.graduationSelectedChoiceKeys;
  const source = viewSpecific && typeof viewSpecific === "object" && !Array.isArray(viewSpecific)
    ? viewSpecific as Record<string, unknown>
    : rawData.selectedChoiceKeys && typeof rawData.selectedChoiceKeys === "object" && !Array.isArray(rawData.selectedChoiceKeys)
      ? rawData.selectedChoiceKeys as Record<string, unknown>
      : {};
  const selected: RequirementChoiceSelections = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = plannerCategoryKey(rawKey);
    const value = plannerCategoryKey(stringFrom(rawValue));
    if (key && value) selected[key] = value;
  }
  return selected;
}

function choiceSelectionMissing(
  groups: RequirementChoiceGroup[],
  selected: RequirementChoiceSelections,
): RequirementChoiceGroup[] {
  return groups.filter((group) =>
    group.required &&
    group.selectable &&
    !group.options.some((option) => option.key === selected[group.key]),
  );
}

function plannerCoursesForChoiceSelection(
  courses: PlannerCourse[],
  groups: RequirementChoiceGroup[],
  selected: RequirementChoiceSelections,
): PlannerCourse[] {
  return courses.filter((course) => !plannerCourseExcludedByChoice(course, groups, selected));
}

function plannerCourseExcludedByChoice(
  course: PlannerCourse,
  groups: RequirementChoiceGroup[],
  selected: RequirementChoiceSelections,
): boolean {
  return groups.some((group) => {
    if (!group.selectable) return false;
    const matched = group.options.filter((option) => plannerCourseMatchesRequirementChoiceOption(course, option));
    if (!matched.length) return false;
    const selectedKey = selected[group.key];
    if (!selectedKey) return true;
    return !matched.some((option) => option.key === selectedKey);
  });
}

function plannerCourseMatchesRequirementChoiceOption(course: PlannerCourse, option: RequirementChoiceOption): boolean {
  const courseKeys = new Set([
    course.title,
    course.courseCode,
    ...(course.requirementKeys ?? []),
  ].map(stringFrom).filter(Boolean).map(plannerCourseMatchKey));
  const optionKeys = [
    ...option.courseTitles,
    ...option.courseCodes,
    ...option.requirementKeys,
    ...option.courseGroupKeys,
  ].map(plannerCourseMatchKey);
  return optionKeys.some((key) => courseKeys.has(key));
}

function stringArrayFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(stringFrom).filter(Boolean);
}

function plannerQueryMeta(d: Record<string, unknown>, courses: PlannerCourse[]): string {
  const query = d.query && typeof d.query === "object" && !Array.isArray(d.query)
    ? d.query as PlannerQueryContext
    : {};
  const firstCourse = courses[0];
  const year = plannerScalarText(query.year) || plannerScalarText(d.year) || plannerScalarText(firstCourse?.year);
  const termCode = plannerScalarText(query.termCode) || plannerScalarText(d.termCode) || plannerScalarText(firstCourse?.termCode);
  const termLabel = plannerScalarText(query.termLabel) || plannerScalarText(d.termLabel) || plannerScalarText(firstCourse?.termLabel) || plannerTermCodeLabel(termCode);
  const category = plannerScalarText(query.category) || plannerScalarText(d.category);
  const department = plannerDepartmentText(
    query.departmentLabel,
    query.displayDepartment,
    d.departmentLabel,
    d.displayDepartment,
    query.department,
    d.department,
  );
  const studentStanding = plannerScalarText(query.studentStanding) || plannerScalarText(d.studentStanding);
  const campus = plannerScalarText(query.campus) || plannerScalarText(d.campus);
  return joinMeta([
    year ? `${year}학년도` : "",
    termLabel,
    studentStanding,
    department ? `학과 ${department}` : "",
    category ? `분류 ${plannerCategoryQueryLabel(category)}` : "",
    campus ? `캠퍼스 ${campus}` : "",
  ]);
}

function plannerDepartmentText(...values: unknown[]): string {
  for (const value of values) {
    const text = plannerScalarText(value).replace(/^\d{5}\s+/u, "").trim();
    if (text) return text;
  }
  return "";
}

function plannerScalarText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function plannerTermCodeLabel(termCode: string): string {
  if (/^(1|10)$/.test(termCode)) return "1학기";
  if (/^(2|20)$/.test(termCode)) return "2학기";
  if (/^(3|15)$/.test(termCode)) return "하계";
  if (/^(4|25)$/.test(termCode)) return "동계";
  return termCode ? `학기코드 ${termCode}` : "";
}

function plannerCategoryQueryLabel(category: string): string {
  if (/major|전공/i.test(category)) return "전공";
  if (/elective|liberal|교양|선택/i.test(category)) return "교양/선택";
  if (/unknown|미분류/i.test(category)) return "미분류";
  return category;
}

function extractCompletedPlannerCourseKeys(d: Record<string, unknown>): Set<string> {
  const sources = [
    d.completedCourses,
    d.currentCourses,
    d.completedCourseTitles,
    d.takenCourses,
    d.gradeHistory,
  ];
  const keys = new Set<string>();
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      if (typeof item === "string") {
        keys.add(plannerCourseMatchKey(item));
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const title = stringFrom(record.courseTitle ?? record.title);
      const code = stringFrom(record.courseCode ?? record.code ?? record.curiNum);
      if (title) keys.add(plannerCourseMatchKey(title));
      if (code) keys.add(plannerCourseMatchKey(code));
    }
  }
  return keys;
}

function plannerCourseIsCompleted(course: PlannerCourse, completedKeys: Set<string>): boolean {
  return completedKeys.has(plannerCourseMatchKey(course.title)) ||
    (course.courseCode ? completedKeys.has(plannerCourseMatchKey(course.courseCode)) : false);
}

function academicCourseMatchKey(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "")
    .trim()
    .toLowerCase();
}

function plannerCourseMatchKey(value: string): string {
  return academicCourseMatchKey(value);
}

function plannerCourseMatchKeys(course: Pick<PlannerCourse, "title" | "courseCode">): string[] {
  return [course.title, course.courseCode]
    .map((value) => stringFrom(value))
    .filter(Boolean)
    .map(plannerCourseMatchKey);
}

function buildPlannerRequirementTargets(d: Record<string, unknown>): PlannerRequirementTarget[] {
  const sources = graduationRequirementSourcesFromData(d);
  const targets = new Map<string, PlannerRequirementTarget>();
  for (const source of sources) {
    for (const rawRule of source.rules ?? []) {
      const rule = rawRule as GraduationRequirementRule;
      const groups = Array.isArray(rule.courseGroups) ? rule.courseGroups : [];
      groups.forEach((group, index) => {
        const target = plannerRequirementTargetFromGroup(rule, group, index);
        if (!target) return;
        const existing = targets.get(target.key);
        if (!existing) {
          targets.set(target.key, target);
          return;
        }
        existing.courseKeys = [...new Set([...existing.courseKeys, ...target.courseKeys])];
        existing.aliases = [...new Set([...existing.aliases, ...target.aliases])];
      });
      const directTarget = plannerRequirementTargetFromRule(rule);
      if (!directTarget) continue;
      const existing = targets.get(directTarget.key);
      if (!existing) {
        targets.set(directTarget.key, directTarget);
        continue;
      }
      existing.courseKeys = [...new Set([...existing.courseKeys, ...directTarget.courseKeys])];
      existing.aliases = [...new Set([...existing.aliases, ...directTarget.aliases])];
    }
  }
  return [...targets.values()];
}

function plannerRequirementTargetFromGroup(
  rule: GraduationRequirementRule,
  group: GraduationRequirementCourseGroup,
  index: number,
): PlannerRequirementTarget | undefined {
  const titles = Array.isArray(group.requiredCourseTitles) ? group.requiredCourseTitles : [];
  const codes = Array.isArray(group.requiredCourseCodes) ? group.requiredCourseCodes : [];
  const courseKeys = [...titles, ...codes].map(stringFrom).filter(Boolean).map(plannerCourseMatchKey);
  if (!courseKeys.length) return undefined;
  const ruleLabel = stringFrom(rule.category) || stringFrom(rule.label);
  const groupKey = stringFrom(group.groupKey);
  const label = stringFrom(group.label) || ruleLabel || `Requirement group ${index + 1}`;
  const key = plannerCategoryKey(["requirement", ruleLabel, groupKey || label || String(index + 1)].filter(Boolean).join("-"));
  return {
    key,
    label,
    parentCategory: plannerRequirementParentCategory(rule, label),
    courseKeys: [...new Set(courseKeys)],
    aliases: [key, groupKey, label, ruleLabel].filter(Boolean),
  };
}

function plannerRequirementTargetFromRule(rule: GraduationRequirementRule): PlannerRequirementTarget | undefined {
  const titles = Array.isArray(rule.requiredCourseTitles) ? rule.requiredCourseTitles : [];
  const codes = Array.isArray(rule.requiredCourseCodes) ? rule.requiredCourseCodes : [];
  const courseKeys = [...titles, ...codes].map(stringFrom).filter(Boolean).map(plannerCourseMatchKey);
  if (!courseKeys.length) return undefined;
  const label = stringFrom(rule.label) || stringFrom(rule.category) || "Requirement";
  const ruleKey = stringFrom(rule.requirementKey ?? rule.key ?? rule.id);
  const key = plannerCategoryKey(["requirement", ruleKey || label].filter(Boolean).join("-"));
  return {
    key,
    label,
    parentCategory: plannerRequirementParentCategory(rule, label),
    courseKeys: [...new Set(courseKeys)],
    aliases: [key, ruleKey, label, stringFrom(rule.category)].filter(Boolean),
  };
}

function plannerRequirementParentCategory(rule: GraduationRequirementRule, targetLabel: string): PlannerCategory {
  const category = plannerCategory(
    `${stringFrom(rule.category)} ${stringFrom(rule.label)} ${targetLabel}`,
    `${stringFrom(rule.category)} ${stringFrom(rule.label)} ${targetLabel}`,
  );
  return category === "unknown" ? "elective" : category;
}

function attachPlannerRequirementTargets(
  course: PlannerCourse,
  targets: PlannerRequirementTarget[],
): PlannerCourse {
  if (!targets.length) return course;
  const courseKeys = new Set(plannerCourseMatchKeys(course));
  const matched = targets.filter((target) => target.courseKeys.some((key) => courseKeys.has(key)));
  if (!matched.length) return course;
  return {
    ...course,
    requirementKeys: [...new Set([...(course.requirementKeys ?? []), ...matched.map((target) => target.key)])],
    requirementLabels: [...new Set([...(course.requirementLabels ?? []), ...matched.map((target) => target.label)])],
  };
}

function normalizePlannerCourse(input: CatalogCourseInput, index: number): PlannerCourse | undefined {
  const title = stringFrom(input.courseTitle ?? input.title);
  if (!title) return undefined;
  const category = plannerCategory(input.category, input.categoryLabel);
  const categoryLabel = plannerCategoryLabel(input.category, input.categoryLabel, category);
  const categoryKey = plannerCategoryKey(categoryLabel || category);
  const gradeLevel = plannerGradeLabel(input.gradeLevel ?? input.grade);
  const rawMeetings = Array.isArray(input.meetings) ? input.meetings : [];
  const meetingInputs = rawMeetings.length ? rawMeetings : [{ timeRange: input.timeRange, rawTimeRange: input.rawTimeRange, rawTime: input.rawTime, location: input.location }];
  const meetings = meetingInputs
    .map((meeting) => normalizePlannerMeeting(meeting))
    .filter((meeting): meeting is PlannerMeeting => Boolean(meeting));
  return {
    id: `${index}-${title}`,
    title,
    courseCode: stringFrom(input.courseCode ?? input.curriculumNumber ?? input.curiNum),
    section: stringFrom(input.section),
    credit: numberFrom(input.credit ?? input.credits) ?? 0,
    category,
    categoryLabel,
    categoryKey,
    gradeLevel,
    gradeKey: gradeLevel ? plannerCategoryKey(gradeLevel) : undefined,
    year: numberFrom(input.year),
    termCode: stringFrom(input.termCode),
    termLabel: stringFrom(input.termLabel),
    professor: stringFrom(input.professor),
    meetings,
  };
}

function plannerGradeLabel(value: unknown): string | undefined {
  const raw = typeof value === "number" ? `${value}학년` : stringFrom(value);
  if (!raw) return undefined;
  const numberMatch = raw.match(/([1-6])\s*학?\s*년?/);
  if (numberMatch) return `${numberMatch[1]}학년`;
  if (/전\s*학년|전체|all/i.test(raw)) return "전학년";
  return raw;
}

function buildPlannerGradeFilters(courses: PlannerCourse[]): PlannerGradeFilter[] {
  const counts = new Map<string, { label: string; courseKeys: Set<string> }>();
  for (const course of courses) {
    const label = course.gradeLevel || "학년 미제공";
    const key = course.gradeKey || plannerCategoryKey(label);
    const current = counts.get(key) ?? { label, courseKeys: new Set<string>() };
    current.courseKeys.add(plannerCourseDistinctKey(course));
    counts.set(key, current);
  }
  return [...counts.entries()]
    .sort((a, b) => plannerGradeSort(a[1].label) - plannerGradeSort(b[1].label) || a[1].label.localeCompare(b[1].label, "ko"))
    .map(([key, value]) => ({ key, label: value.label, available: value.courseKeys.size }));
}

function plannerGradeSort(label: string): number {
  const numberMatch = label.match(/([1-6])\s*학년/);
  if (numberMatch) return Number(numberMatch[1]);
  if (/전학년/.test(label)) return 90;
  if (/미제공/.test(label)) return 99;
  return 80;
}

function plannerCategory(category?: unknown, categoryLabel?: unknown): PlannerCategory {
  const text = `${stringFrom(category)} ${stringFrom(categoryLabel)}`.toLowerCase();
  if (!text.trim() || /\bunknown\b|\bunclassified\b|미분류|분류\s*없/.test(text)) return "unknown";
  if (/\bmajor\b|전공/.test(text)) return "major";
  if (/\belective\b|\bliberal\b|\bgeneral\b|교양|자유|일반/.test(text)) return "elective";
  return "unknown";
}

function plannerCategoryLabel(category: unknown, categoryLabel: unknown, normalized: PlannerCategory): string {
  const explicit = stringFrom(categoryLabel);
  if (explicit && !plannerLooksLikeCurriculumCode(explicit)) return explicit;
  const raw = stringFrom(category);
  if (/^major$/i.test(raw)) return "전공";
  if (/^(elective|liberal|general)$/i.test(raw)) return "교양/선택";
  if (/^(unknown|unclassified)$/i.test(raw)) return "미분류";
  if (raw && !plannerLooksLikeCurriculumCode(raw)) return raw;
  if (normalized === "major") return "전공";
  if (normalized === "elective") return "교양/선택";
  return "미분류";
}

function plannerLooksLikeCurriculumCode(value: string): boolean {
  return /^K[A-Z]{1,2}(?:\d{3,})?$/i.test(value.trim());
}

function plannerCategoryKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "unknown";
}

function buildPlannerCategoryTargets(
  courses: PlannerCourse[],
  rawTargets: unknown,
  requirementTargets: PlannerRequirementTarget[] = [],
): PlannerCategoryTarget[] {
  const counts = new Map<string, { label: string; parentCategory: PlannerCategory; courseKeys: Set<string>; count: number; aliases: string[] }>();
  for (const course of courses) {
    if (course.category === "unknown") continue;
    const current = counts.get(course.categoryKey) ?? {
      label: course.categoryLabel,
      parentCategory: course.category,
      courseKeys: new Set<string>(),
      count: 0,
      aliases: [course.categoryKey, course.categoryLabel, course.category],
    };
    current.courseKeys.add(plannerCourseDistinctKey(course));
    counts.set(course.categoryKey, current);
  }

  for (const target of requirementTargets) {
    const matchedCourses = courses.filter((course) => (course.requirementKeys ?? []).includes(target.key));
    const available = plannerDistinctCourseCount(matchedCourses);
    if (!available) continue;
    counts.set(target.key, {
      label: target.label,
      parentCategory: target.parentCategory,
      courseKeys: new Set(matchedCourses.map(plannerCourseDistinctKey)),
      count: 0,
      aliases: target.aliases,
    });
  }

  const requested = plannerRequestedTargetCounts(rawTargets);

  return [...counts.entries()]
    .sort((a, b) => a[1].parentCategory.localeCompare(b[1].parentCategory) || a[1].label.localeCompare(b[1].label, "ko"))
    .map(([key, value]) => ({
      key,
      label: value.label,
      parentCategory: value.parentCategory,
      count: plannerRequestedTargetCount(requested, key, value.aliases) ?? value.count,
      available: value.courseKeys.size,
    }));
}

function plannerDistinctCourseCount(courses: PlannerCourse[]): number {
  return new Set(courses.map(plannerCourseDistinctKey)).size;
}

function plannerCourseDistinctKey(course: Pick<PlannerCourse, "title" | "courseCode">): string {
  return plannerCourseMatchKey(course.title) || plannerCourseMatchKey(course.courseCode ?? "");
}

function plannerRequestedTargetCounts(rawTargets: unknown): Map<string, number> {
  const requested = new Map<string, number>();
  if (Array.isArray(rawTargets)) {
    for (const item of rawTargets) {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const rawKey = stringFrom(record.key ?? record.groupKey ?? record.category ?? record.label);
      const count = numberFrom(record.count);
      if (rawKey && count != null) {
        const clamped = clampCount(count, PLANNER_MAX_BASIC_COUNT);
        requested.set(rawKey, clamped);
        requested.set(plannerCategoryKey(rawKey), clamped);
      }
    }
  }
  return requested;
}

function plannerRequestedTargetCount(
  requested: Map<string, number>,
  key: string,
  aliases: string[],
): number | undefined {
  for (const alias of [key, ...aliases]) {
    if (requested.has(alias)) return requested.get(alias);
    const normalized = plannerCategoryKey(alias);
    if (requested.has(normalized)) return requested.get(normalized);
  }
  return undefined;
}

export function normalizePlannerMeeting(input: unknown): PlannerMeeting | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const record = input as CatalogMeetingInput;
  const raw = stringFrom(record.rawTimeRange ?? record.rawTime ?? record.timeRange ?? record.time) || "";
  const explicitStart = stringFrom(record.startTime ?? record.start);
  const explicitEnd = stringFrom(record.endTime ?? record.end);
  const parsed = explicitStart && explicitEnd
    ? { start: explicitStart, end: explicitEnd }
    : parsePlannerTimeRange(raw);
  const dayIndex = parsePlannerDay(record.dayOfWeek ?? record.weekday ?? record.day ?? record.dayLabel ?? raw);
  if (dayIndex < 0 || !parsed.start || !parsed.end) return undefined;
  const startMinutes = parseClockMinutes(parsed.start);
  const endMinutes = parseClockMinutes(parsed.end);
  if (startMinutes === Number.MAX_SAFE_INTEGER || endMinutes === Number.MAX_SAFE_INTEGER || startMinutes >= endMinutes) return undefined;
  return {
    dayIndex,
    dayLabel: PLANNER_DAYS[dayIndex],
    start: normalizeClockLabel(parsed.start),
    end: normalizeClockLabel(parsed.end),
    startMinutes,
    endMinutes,
    raw,
    location: stringFrom(record.location),
  };
}

export function parsePlannerTimeRange(raw: string): { start: string; end: string } {
  const match = raw.match(/(\d{1,2}:?\d{2})\s*(?:~|-|\u2013|\u2014)\s*(\d{1,2}:?\d{2})/);
  return {
    start: normalizeCompactClock(match?.[1] ?? ""),
    end: normalizeCompactClock(match?.[2] ?? ""),
  };
}

function parsePlannerDay(value: unknown): number {
  if (typeof value === "number") return value >= 1 && value <= 7 ? value - 1 : value;
  const text = stringFrom(value).toLowerCase();
  const labels = [
    /mon|monday|월/,
    /tue|tuesday|화/,
    /wed|wednesday|수/,
    /thu|thursday|목/,
    /fri|friday|금/,
    /sat|saturday|토/,
    /sun|sunday|일/,
  ];
  return labels.findIndex((pattern) => pattern.test(text));
}

const PLANNER_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PLANNER_DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const PLANNER_WEEKDAY_COUNT = 6;
const PLANNER_MAX_BASIC_COUNT = 8;
const PLANNER_MUTUALLY_EXCLUSIVE_COURSE_TITLE_GROUPS = [
  ["영어1", "영어2", "English 1", "English 2"],
  ["영어3", "영어4", "English 3", "English 4"],
  ["영어회화1", "영어회화2", "English Conversation 1", "English Conversation 2"],
  ["영어회화3", "영어회화4", "English Conversation 3", "English Conversation 4"],
].map((group) => group.map(plannerCourseMatchKey));
const PLANNER_PERIODS = Array.from({ length: 11 }, (_, index) => {
  const startMinutes = 9 * 60 + index * 60;
  return {
    index,
    label: `${index + 1}교시`,
    startMinutes,
    endMinutes: startMinutes + 50,
  };
});
const PLANNER_BLOCK_COLORS = [
  "rgba(61, 146, 255, 0.72)",
  "rgba(43, 194, 138, 0.72)",
  "rgba(245, 158, 11, 0.76)",
  "rgba(236, 87, 126, 0.72)",
  "rgba(132, 116, 255, 0.72)",
  "rgba(20, 184, 166, 0.72)",
  "rgba(239, 112, 72, 0.72)",
  "rgba(14, 165, 233, 0.72)",
  "rgba(168, 85, 247, 0.70)",
  "rgba(234, 179, 8, 0.72)",
  "rgba(16, 185, 129, 0.72)",
  "rgba(244, 63, 94, 0.72)",
  "rgba(99, 102, 241, 0.72)",
  "rgba(6, 182, 212, 0.72)",
  "rgba(217, 70, 239, 0.70)",
  "rgba(101, 163, 13, 0.74)",
  "rgba(249, 115, 22, 0.72)",
  "rgba(59, 130, 246, 0.72)",
  "rgba(45, 212, 191, 0.68)",
  "rgba(190, 24, 93, 0.70)",
];

export function generateTimetableSchedule(
  courses: PlannerCourse[],
  majorCount: number,
  electiveCount: number,
  seed = Date.now(),
  options: PlannerGenerateOptions = {},
): PlannerCourse[] {
  const disabledDays = new Set(options.disabledDays ?? []);
  const disabledPeriods = new Set(options.disabledPeriods ?? []);
  const disabledGradeKeys = new Set(options.disabledGradeKeys ?? []);
  const lockedIds = new Set(options.lockedCourseIds ?? []);
  const availableCourses = courses.filter((course) =>
    plannerCourseAllowed(course, disabledDays, disabledPeriods, disabledGradeKeys),
  );
  const locked = courses.filter((course) => lockedIds.has(course.id));
  if (locked.some((course) => !availableCourses.some((available) => available.id === course.id))) return [];
  if (locked.some((course, index) => hasPlannerConflict(course, locked.slice(0, index)))) return [];

  const targets = options.categoryTargets?.some((target) => target.count > 0)
    ? options.categoryTargets.filter((target) => target.count > 0).map((target) => ({
      key: target.key,
      count: clampCount(target.count, PLANNER_MAX_BASIC_COUNT),
    }))
    : [
      { key: "major", count: clampCount(majorCount, PLANNER_MAX_BASIC_COUNT) },
      { key: "elective", count: clampCount(electiveCount, PLANNER_MAX_BASIC_COUNT) },
    ];
  const selected = [...locked];

  for (const target of targets) {
    const already = selected.filter((course) => plannerCourseMatchesTarget(course, target.key)).length;
    const remaining = Math.max(0, target.count - already);
    const pool = seededShuffle(
      availableCourses.filter((course) =>
        !selected.some((picked) => picked.id === course.id || plannerSameCourse(picked, course)) &&
        plannerCourseMatchesTarget(course, target.key),
      ),
      seed + selected.length + target.count,
    );
    const picked = pickConflictFree(pool, remaining, selected);
    if (picked.length !== remaining) return [];
    selected.push(...picked);
  }
  return selected;
}

function plannerCourseMatchesTarget(course: PlannerCourse, key: string): boolean {
  return course.category === key || course.categoryKey === key || (course.requirementKeys ?? []).includes(key);
}

function plannerMeetingAllowed(
  meeting: PlannerMeeting,
  disabledDays: Set<number>,
  disabledPeriods: Set<number>,
): boolean {
  if (meeting.dayIndex < 0 || meeting.dayIndex >= PLANNER_WEEKDAY_COUNT) return false;
  if (disabledDays.has(meeting.dayIndex)) return false;
  for (const period of PLANNER_PERIODS) {
    if (
      disabledPeriods.has(period.index) &&
      meeting.startMinutes < period.endMinutes &&
      period.startMinutes < meeting.endMinutes
    ) {
      return false;
    }
  }
  return true;
}

function plannerCourseAllowed(
  course: PlannerCourse,
  disabledDays: Set<number>,
  disabledPeriods: Set<number>,
  disabledGradeKeys: Set<string>,
): boolean {
  if (!course.meetings.length) return false;
  if (course.gradeKey && disabledGradeKeys.has(course.gradeKey)) return false;
  return course.meetings.every((meeting) => plannerMeetingAllowed(meeting, disabledDays, disabledPeriods));
}

function plannerMeetingStartPeriod(meeting: PlannerMeeting): number {
  const index = PLANNER_PERIODS.findIndex((period) => meeting.startMinutes < period.endMinutes);
  return Math.max(0, index === -1 ? PLANNER_PERIODS.length - 1 : index);
}

function plannerMeetingEndPeriod(meeting: PlannerMeeting): number {
  const index = [...PLANNER_PERIODS].reverse().findIndex((period) => period.startMinutes < meeting.endMinutes);
  if (index === -1) return plannerMeetingStartPeriod(meeting) + 1;
  return PLANNER_PERIODS.length - index;
}

function pickConflictFree(pool: PlannerCourse[], count: number, base: PlannerCourse[]): PlannerCourse[] {
  const picked: PlannerCourse[] = [];
  function visit(start: number): boolean {
    if (picked.length === count) return true;
    for (let i = start; i < pool.length; i++) {
      const course = pool[i];
      if (hasPlannerConflict(course, [...base, ...picked])) continue;
      picked.push(course);
      if (visit(i + 1)) return true;
      picked.pop();
    }
    return false;
  }
  return visit(0) ? picked : [];
}

export function hasPlannerConflict(course: PlannerCourse, selected: PlannerCourse[]): boolean {
  return selected.some((other) =>
    plannerSameCourse(course, other) ||
    plannerMutuallyExclusiveCourse(course, other) ||
    course.meetings.some((a) => other.meetings.some((b) => meetingsOverlap(a, b))),
  );
}

function plannerSameCourse(a: PlannerCourse, b: PlannerCourse): boolean {
  if (a.id === b.id) return true;
  const titleA = plannerCourseMatchKey(a.title);
  const titleB = plannerCourseMatchKey(b.title);
  const codeA = a.courseCode ? plannerCourseMatchKey(a.courseCode) : "";
  const codeB = b.courseCode ? plannerCourseMatchKey(b.courseCode) : "";
  return Boolean((titleA && titleA === titleB) || (codeA && codeA === codeB));
}

function plannerMutuallyExclusiveCourse(a: PlannerCourse, b: PlannerCourse): boolean {
  const titleA = plannerCourseMatchKey(a.title);
  const titleB = plannerCourseMatchKey(b.title);
  if (!titleA || !titleB || titleA === titleB) return false;
  return PLANNER_MUTUALLY_EXCLUSIVE_COURSE_TITLE_GROUPS.some((group) =>
    group.includes(titleA) && group.includes(titleB),
  );
}

function meetingsOverlap(a: PlannerMeeting, b: PlannerMeeting): boolean {
  return a.dayIndex === b.dayIndex && a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function plannerCourseTitleWithCredit(course: Pick<PlannerCourse, "title" | "credit">): string {
  return course.credit > 0 ? `${course.title}(${course.credit})` : course.title;
}

function plannerCourseMetaLabel(course: Pick<PlannerCourse, "categoryLabel" | "requirementLabels">): string {
  return joinMeta([course.categoryLabel, ...(course.requirementLabels ?? [])]);
}

function plannerLocationLabel(location: unknown): string {
  return stringFrom(location);
}

function plannerMeetingSummary(course: PlannerCourse): string {
  return course.meetings.map((meeting) => {
    const label = `${plannerDayLabel(meeting.dayIndex)} ${meeting.start}-${meeting.end}`;
    const location = plannerLocationLabel(meeting.location);
    return location ? `${label} ${location}` : label;
  }).join(", ");
}

function clampCount(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.floor(value)));
}

function stringFrom(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberFrom(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function booleanFrom(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return /^(true|1|yes)$/i.test(value.trim());
  return false;
}

function normalizeClockLabel(clock: string): string {
  const minutes = parseClockMinutes(clock);
  if (minutes === Number.MAX_SAFE_INTEGER) return clock;
  return clockFromMinutes(minutes);
}

function normalizeCompactClock(clock: string): string {
  const trimmed = clock.trim();
  if (/^\d{3,4}$/.test(trimmed)) {
    const padded = trimmed.padStart(4, "0");
    return `${padded.slice(0, 2)}:${padded.slice(2)}`;
  }
  return trimmed;
}

function clockFromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function plannerDayLabel(dayIndex: number): string {
  return PLANNER_DAY_LABELS[dayIndex] ?? "?";
}

function jsonForInlineScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function plannerClientScript(): string {
  return `(() => {
const root = document.querySelector("[data-timetable-planner]");
if (!root) return;
const safePlannerJson = (text) => {
  try {
    const parsed = JSON.parse(text || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};
const normalizePlannerCourses = (value) => Array.isArray(value)
  ? value
      .filter(course => course && typeof course === "object")
      .map(course => ({
        ...course,
        meetings: Array.isArray(course.meetings)
          ? course.meetings.filter(meeting => meeting && typeof meeting === "object" && Number.isFinite(Number(meeting.dayIndex)) && Number.isFinite(Number(meeting.startMinutes)) && Number.isFinite(Number(meeting.endMinutes)))
          : [],
        requirementKeys: Array.isArray(course.requirementKeys) ? course.requirementKeys : [],
        requirementLabels: Array.isArray(course.requirementLabels) ? course.requirementLabels : [],
      }))
  : [];
const normalizePlannerPeriods = (value) => Array.isArray(value)
  ? value
      .filter(period => period && typeof period === "object" && Number.isFinite(Number(period.index)) && Number.isFinite(Number(period.startMinutes)) && Number.isFinite(Number(period.endMinutes)))
      .map(period => ({ ...period, index: Number(period.index), startMinutes: Number(period.startMinutes), endMinutes: Number(period.endMinutes), label: String(period.label || (Number(period.index) + 1) + "교시") }))
  : [];
const rawData = safePlannerJson(document.getElementById("planner-data") && document.getElementById("planner-data").textContent);
const data = {
  ...rawData,
  courses: normalizePlannerCourses(rawData.courses),
  categoryTargets: Array.isArray(rawData.categoryTargets) ? rawData.categoryTargets.filter(target => target && typeof target === "object") : [],
  initialCourseIds: Array.isArray(rawData.initialCourseIds) ? rawData.initialCourseIds : [],
  periods: normalizePlannerPeriods(rawData.periods),
  choiceGroups: Array.isArray(rawData.choiceGroups) ? rawData.choiceGroups.filter(group => group && typeof group === "object") : [],
  selectedChoiceKeys: rawData.selectedChoiceKeys && typeof rawData.selectedChoiceKeys === "object" && !Array.isArray(rawData.selectedChoiceKeys) ? rawData.selectedChoiceKeys : {},
};
let seed = Date.now();
const maxBasicCount = 8;
const controls = {
  major: root.querySelector('[data-planner-count="major"]'),
  elective: root.querySelector('[data-planner-count="elective"]')
};
const result = root.querySelector("[data-planner-result]");
const status = root.querySelector("[data-planner-status]");
const creditSummary = root.querySelector("[data-planner-credit-summary]");
const searchInput = root.querySelector("[data-planner-search]");
const searchResults = root.querySelector("[data-planner-search-results]");
const searchCount = root.querySelector("[data-planner-search-count]");
const generateButton = root.querySelector("[data-planner-generate]");
const advancedToggle = root.querySelector("[data-planner-advanced]");
const dayButtons = Array.from(root.querySelectorAll("[data-planner-day]"));
const periodButtons = Array.from(root.querySelectorAll("[data-planner-period]"));
const gradeButtons = Array.from(root.querySelectorAll("[data-planner-grade]"));
const categoryInputs = Array.from(root.querySelectorAll("[data-planner-category]"));
const lockedCourseIds = new Set();
const excludedCourseIds = new Set();
const disabledDays = new Set();
const disabledPeriods = new Set();
const disabledGrades = new Set();
let currentCourseIds = new Set(Array.isArray(data.initialCourseIds) ? data.initialCourseIds : []);
const e = (value) => String(value == null ? "" : value).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
if (!result || !generateButton) return;
const dayLabels = ${jsonForInlineScript(PLANNER_DAY_LABELS.slice(0, PLANNER_WEEKDAY_COUNT))};
const periods = data.periods.length ? data.periods : Array.from({ length: 11 }, (_, index) => ({ index, label: (index + 1) + "교시", startMinutes: 540 + index * 60, endMinutes: 590 + index * 60 }));
const blockColors = ${JSON.stringify(PLANNER_BLOCK_COLORS)};
const exclusiveCourseTitleGroups = ${jsonForInlineScript(PLANNER_MUTUALLY_EXCLUSIVE_COURSE_TITLE_GROUPS)};
const colorAt = (index) => {
  if (blockColors[index]) return blockColors[index];
  const hue = Math.round(((index * 137.508) % 360) * 1000) / 1000;
  return 'hsl(' + hue + ' 68% 48% / 0.72)';
};
const colorKey = (course) => String(course.title || course.id || "").trim().toLowerCase();
const colorMapFor = (courses) => new Map(Array.from(new Set(courses.map(colorKey).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko")).map((key, index) => [key, colorAt(index)]));
const colorForCourse = (course, colorMap) => {
  return colorMap.get(colorKey(course)) || colorAt(0);
};
const overlaps = (a, b) => a.dayIndex === b.dayIndex && a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
const matchKey = (value) => String(value || "").replace(/\\s+/g, "").trim().toLowerCase();
const choiceSelections = new Map(Object.entries(data.selectedChoiceKeys || {}).map(([key, value]) => [matchKey(key), matchKey(value)]).filter(([, value]) => value));
const sameCourse = (a, b) => {
  if (!a || !b) return false;
  const titleA = matchKey(a.title);
  const titleB = matchKey(b.title);
  const codeA = matchKey(a.courseCode);
  const codeB = matchKey(b.courseCode);
  return Boolean((a.id && a.id === b.id) || (titleA && titleA === titleB) || (codeA && codeA === codeB));
};
const mutuallyExclusiveCourse = (a, b) => {
  const titleA = matchKey(a && a.title);
  const titleB = matchKey(b && b.title);
  if (!titleA || !titleB || titleA === titleB) return false;
  return exclusiveCourseTitleGroups.some(group => group.includes(titleA) && group.includes(titleB));
};
const optionMatchesCourse = (option, course) => {
  const courseKeys = new Set([course.title, course.courseCode].concat(course.requirementKeys || []).map(matchKey).filter(Boolean));
  return []
    .concat(option.courseTitles || [], option.courseCodes || [], option.requirementKeys || [], option.courseGroupKeys || [])
    .map(matchKey)
    .some(key => courseKeys.has(key));
};
const courseExcludedByChoice = (course) => (data.choiceGroups || []).some(group => {
  if (!group || group.selectable === false) return false;
  const matched = (group.options || []).filter(option => optionMatchesCourse(option, course));
  if (!matched.length) return false;
  const selected = choiceSelections.get(matchKey(group.key));
  if (!selected) return true;
  return !matched.some(option => matchKey(option.key) === selected);
});
const requiredChoiceMissing = () => (data.choiceGroups || []).filter(group => {
  if (!group || !group.required || group.selectable === false) return false;
  const key = matchKey(group.key);
  const selected = choiceSelections.get(key);
  return !(group.options || []).some(option => matchKey(option.key) === selected);
});
const choiceBlockMessage = () => {
  const labels = requiredChoiceMissing().map(group => group.label).filter(Boolean).join(', ');
  return '선택형 요건을 먼저 선택해야 시간표를 만들 수 있습니다' + (labels ? ' (' + labels + ')' : '') + '.';
};
const syncChoiceUi = () => {
  for (const group of data.choiceGroups || []) {
    const key = matchKey(group && group.key);
    const selected = choiceSelections.get(key);
    const status = root.querySelector('[data-planner-choice-status="' + e(key) + '"]');
    if (status) status.textContent = selected ? '선택됨' : group.required ? '선택 필요' : '선택';
  }
};
const courseMeta = (course) => [course.categoryLabel].concat(course.requirementLabels || []).filter(Boolean).join(' · ');
const conflicts = (course, picked) => picked.some(other => sameCourse(course, other) || mutuallyExclusiveCourse(course, other) || course.meetings.some(a => other.meetings.some(b => overlaps(a, b))));
const clock = (minutes) => String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
const dayLabel = (dayIndex) => dayLabels[dayIndex] || "?";
const titleWithCredit = (course) => {
  const credit = Number(course && course.credit || 0);
  const title = String(course && course.title || "");
  return credit > 0 ? title + '(' + credit + ')' : title;
};
const locationLabel = (location) => {
  return String(location || "").trim();
};
const countValue = (control) => Math.max(0, Math.min(maxBasicCount, Number(control && control.value || 0)));
const allCountControls = () => [controls.major, controls.elective, ...categoryInputs].filter(Boolean);
const findCountControl = (key) => allCountControls().find(input => input.getAttribute("data-planner-count") === key || input.getAttribute("data-planner-category") === key);
const setCountValue = (control, value) => {
  if (!control) return;
  control.value = String(Math.max(0, Math.min(maxBasicCount, Number(value || 0))));
};
const targetMeta = new Map((data.categoryTargets || []).map(target => [target.key, target]));
const shuffle = (items, s) => {
  const out = items.slice();
  let state = s || 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const pick = (pool, count, base) => {
  const picked = [];
  const visit = (start) => {
    if (picked.length === count) return true;
    for (let i = start; i < pool.length; i++) {
      if (conflicts(pool[i], base.concat(picked))) continue;
      picked.push(pool[i]);
      if (visit(i + 1)) return true;
      picked.pop();
    }
    return false;
  };
  return visit(0) ? picked : [];
};
const meetingAllowedWith = (meeting, daySet, periodSet) => {
  if (meeting.dayIndex < 0 || meeting.dayIndex >= ${PLANNER_WEEKDAY_COUNT}) return false;
  if (daySet.has(meeting.dayIndex)) return false;
  for (const period of periods) {
    if (periodSet.has(period.index) && meeting.startMinutes < period.endMinutes && period.startMinutes < meeting.endMinutes) return false;
  }
  return true;
};
const gradeAllowedWith = (course, gradeSet) => !course.gradeKey || !gradeSet.has(course.gradeKey);
const courseAllowedWith = (course, daySet, periodSet, gradeSet) => course.meetings.length && gradeAllowedWith(course, gradeSet) && course.meetings.every(meeting => meetingAllowedWith(meeting, daySet, periodSet));
const meetingAllowed = (meeting) => meetingAllowedWith(meeting, disabledDays, disabledPeriods);
const courseAllowed = (course) => courseAllowedWith(course, disabledDays, disabledPeriods, disabledGrades);
const courseUsable = (course) => courseAllowed(course) && !courseExcludedByChoice(course);
const courseSelectable = (course) => courseUsable(course) && !excludedCourseIds.has(course.id);
const courseMatchesTarget = (course, key) => course.category === key || course.categoryKey === key || (course.requirementKeys || []).includes(key);
const targetLabel = (key) => {
  if (key === "major") return "전공";
  if (key === "elective") return "교양/선택";
  return (targetMeta.get(key) && targetMeta.get(key).label) || key;
};
const activeTargets = () => {
  if (advancedToggle && advancedToggle.checked) {
    return categoryInputs
      .map(input => ({ key: input.getAttribute("data-planner-category"), count: countValue(input) }))
      .filter(target => target.key && target.count > 0);
  }
  return [
    { key: "major", count: countValue(controls.major) },
    { key: "elective", count: countValue(controls.elective) }
  ];
};
const startPeriod = (meeting) => {
  const index = periods.findIndex(period => meeting.startMinutes < period.endMinutes);
  return Math.max(0, index === -1 ? periods.length - 1 : index);
};
const endPeriod = (meeting) => {
  for (let index = periods.length - 1; index >= 0; index--) {
    if (periods[index].startMinutes < meeting.endMinutes) return index + 1;
  }
  return startPeriod(meeting) + 1;
};
const render = (courses) => {
  const meetings = courses.flatMap(course => course.meetings.map(meeting => ({ course, meeting }))).sort((a, b) => a.meeting.dayIndex - b.meeting.dayIndex || a.meeting.startMinutes - b.meeting.startMinutes);
  if (!meetings.length) return '<div class="planner-no-solution">선택된 과목에 표시할 수 있는 수업 시간이 없습니다.</div>';
  const dayCount = ${PLANNER_WEEKDAY_COUNT};
  const rowCount = periods.length;
  const visibleColorMap = colorMapFor(courses);
  let html = '<div class="planner-calendar-wrap"><div class="planner-calendar" style="--planner-days:' + dayCount + ';--planner-rows:' + rowCount + '">';
  html += '<div class="planner-calendar-head time" style="grid-column:1;grid-row:1">시간</div>';
  for (let day = 0; day < dayCount; day++) html += '<div class="planner-calendar-head" style="grid-column:' + (day + 2) + ';grid-row:1">' + e(dayLabel(day)) + '</div>';
  for (const period of periods) html += '<div class="planner-time-label" style="grid-column:1;grid-row:' + (period.index + 2) + '"><strong>' + e(period.label) + '</strong><span>' + e(clock(period.startMinutes) + "~" + clock(period.endMinutes)) + '</span></div>';
  for (let day = 0; day < dayCount; day++) {
    for (let slot = 0; slot < rowCount; slot++) {
      html += '<div class="planner-calendar-cell' + (slot % 2 === 1 ? ' hour' : '') + '" style="grid-column:' + (day + 2) + ';grid-row:' + (slot + 2) + '"></div>';
    }
  }
  html += meetings.map(({ course, meeting }) => {
    const startSlot = startPeriod(meeting);
    const endSlot = Math.min(rowCount, endPeriod(meeting));
    const safeEndSlot = Math.max(startSlot + 1, endSlot);
    const displayTitle = titleWithCredit(course);
    const meta = [courseMeta(course), course.professor, locationLabel(meeting.location)].filter(Boolean).join(' · ');
    const locked = lockedCourseIds.has(course.id);
    return '<button class="planner-calendar-block' + (locked ? ' locked' : '') + '" type="button" data-course-id="' + e(course.id) + '" aria-pressed="' + locked + '" style="grid-column:' + (meeting.dayIndex + 2) + ';grid-row:' + (startSlot + 2) + ' / ' + (safeEndSlot + 2) + ';--planner-block:' + colorForCourse(course, visibleColorMap) + '" aria-label="' + e(displayTitle + ' ' + dayLabel(meeting.dayIndex) + ' ' + meeting.start + '-' + meeting.end) + '"><strong>' + e(displayTitle) + '</strong><span>' + e(meeting.start + '-' + meeting.end) + '</span>' + (meta ? '<small>' + e(meta) + '</small>' : '') + '</button>';
  }).join("");
  return html + '</div></div>';
};
const setStatus = (message, failed) => {
  if (!status) return;
  status.textContent = message;
  status.dataset.failed = String(Boolean(failed));
};
const meetingSummary = (course) => course.meetings.map(meeting => dayLabel(meeting.dayIndex) + ' ' + meeting.start + '-' + meeting.end + (locationLabel(meeting.location) ? ' ' + locationLabel(meeting.location) : '')).join(', ');
const creditValue = (course) => Number(course.credit || 0);
const updateCreditSummary = (courses) => {
  if (!creditSummary) return;
  const total = courses.reduce((sum, course) => sum + creditValue(course), 0);
  const major = courses.filter(course => course.category === 'major').reduce((sum, course) => sum + creditValue(course), 0);
  const elective = courses.filter(course => course.category === 'elective').reduce((sum, course) => sum + creditValue(course), 0);
  const excluded = Number(data.completedExcludedCount || 0);
  creditSummary.textContent = courses.length + '과목 · ' + total + '학점 / 전공 ' + major + '학점 · 교양 ' + elective + '학점' + (excluded ? ' · 이수/수강 중 제외 ' + excluded + '개' : '');
};
const renderSearchResults = () => {
  if (!searchResults) return;
  const query = String(searchInput && searchInput.value || '').trim().toLowerCase();
  if (!query) {
    searchResults.innerHTML = '<div class="planner-search-empty">검색어를 입력하면 추가 가능한 과목이 표시됩니다.</div>';
    if (searchCount) searchCount.textContent = '직접 추가';
    return;
  }
  const scheduled = currentCourses();
  const matches = data.courses
    .filter(course => !scheduled.some(current => sameCourse(course, current)))
    .filter(courseSelectable)
    .filter(course => [course.title, course.categoryLabel, ...(course.requirementLabels || []), course.professor, course.courseCode, meetingSummary(course)].filter(Boolean).join(' ').toLowerCase().includes(query))
    .slice(0, 8);
  if (searchCount) searchCount.textContent = matches.length + '개';
  searchResults.innerHTML = matches.length
    ? matches.map(course => '<div class="planner-search-row"><div><strong>' + e(titleWithCredit(course)) + '</strong><span>' + e([courseMeta(course), course.professor, meetingSummary(course)].filter(Boolean).join(' · ')) + '</span></div><button type="button" data-planner-add="' + e(course.id) + '">추가</button></div>').join('')
    : '<div class="planner-search-empty">추가할 수 있는 과목이 없습니다.</div>';
};
const syncLockedUi = () => {
  for (const el of root.querySelectorAll("[data-course-id]")) {
    const locked = lockedCourseIds.has(el.getAttribute("data-course-id"));
    el.classList.toggle("locked", locked);
    el.setAttribute("aria-pressed", String(locked));
  }
};
const currentCourses = () => data.courses.filter(course => currentCourseIds.has(course.id));
const toggledSet = (set, value) => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};
const replaceSet = (target, next) => {
  target.clear();
  next.forEach(value => target.add(value));
};
const lockedBlockedBy = (daySet, periodSet, gradeSet) => data.courses.find(course => lockedCourseIds.has(course.id) && !courseAllowedWith(course, daySet, periodSet, gradeSet));
const guardLockedAvailability = (daySet, periodSet, gradeSet) => {
  const blocked = lockedBlockedBy(daySet, periodSet, gradeSet);
  if (!blocked) return true;
  setStatus('잠금한 ' + blocked.title + ' 과목이 꺼질 조건에 포함되어 있어 변경할 수 없습니다. 먼저 잠금을 해제하세요.', true);
  return false;
};
const pruneUnavailableUnlockedCourses = () => {
  let removed = 0;
  for (const course of currentCourses()) {
    if (lockedCourseIds.has(course.id) || courseUsable(course)) continue;
    currentCourseIds.delete(course.id);
    removed += 1;
  }
  return removed;
};
const renderAvailabilityChange = (baseMessage) => {
  const removed = pruneUnavailableUnlockedCourses();
  renderCurrent(baseMessage + (removed ? ' 조건에서 벗어난 ' + removed + '개 과목을 시간표에서 뺐습니다.' : '') + ' 새 조합은 무작위 시간표 만들기를 눌러 적용하세요.', false);
};
const renderCurrent = (message, failed) => {
  const courses = currentCourses();
  const visible = courses.filter(courseUsable);
  const hiddenCount = Math.max(0, courses.length - visible.length);
  result.innerHTML = render(visible);
  syncLockedUi();
  updateCreditSummary(visible);
  renderSearchResults();
  if (message) {
    setStatus(message, failed);
    return;
  }
  setStatus(visible.length + '개 과목을 표시 중입니다.' + (hiddenCount ? ' 꺼둔 학년/요일/교시에 걸린 ' + hiddenCount + '개 과목은 숨겼습니다.' : '') + ' 새 조합은 무작위 시간표 만들기를 눌러 적용하세요.', false);
};
const markNeedsGenerate = () => {
  setStatus('조건이 변경되었습니다. 무작위 시간표 만들기를 눌러 새 조합을 만드세요.', false);
};
const addCourse = (course) => {
  if (!course) return;
  excludedCourseIds.delete(course.id);
  if (!courseAllowed(course)) {
    setStatus('꺼둔 학년, 요일 또는 교시에 있는 과목은 추가할 수 없습니다.', true);
    renderSearchResults();
    return;
  }
  if (courseExcludedByChoice(course)) {
    setStatus('선택하지 않은 요건 트랙의 과목은 추가할 수 없습니다.', true);
    renderSearchResults();
    return;
  }
  if (currentCourseIds.has(course.id)) {
    setStatus('이미 시간표에 있는 과목입니다.', false);
    renderSearchResults();
    return;
  }
  if (currentCourses().some(current => sameCourse(course, current))) {
    setStatus('동일 과목의 다른 분반은 중복으로 추가할 수 없습니다.', true);
    renderSearchResults();
    return;
  }
  if (conflicts(course, currentCourses().filter(courseAllowed))) {
    setStatus('현재 시간표와 시간이 겹쳐 추가할 수 없습니다.', true);
    renderSearchResults();
    return;
  }
  currentCourseIds.add(course.id);
  renderCurrent(course.title + ' 과목을 추가했습니다.', false);
};
const removeCourse = (course) => {
  if (!course) return;
  currentCourseIds.delete(course.id);
  lockedCourseIds.delete(course.id);
  excludedCourseIds.add(course.id);
  renderCurrent(course.title + ' 과목을 제거했습니다.', false);
};
const generate = (advanceSeed) => {
  if (advanceSeed) seed += 1;
  if (requiredChoiceMissing().length) {
    const message = choiceBlockMessage();
    result.innerHTML = '<div class="planner-no-solution" data-planner-choice-blocked>' + e(message) + '</div>';
    setStatus(message, true);
    syncChoiceUi();
    return;
  }
  const availableCourses = data.courses.filter(courseSelectable);
  const locked = data.courses.filter(course => lockedCourseIds.has(course.id));
  const disabledLocked = locked.find(course => !courseAllowed(course));
  if (disabledLocked) {
    result.innerHTML = '<div class="planner-no-solution">잠금한 과목이 꺼둔 학년, 요일 또는 교시에 포함되어 있습니다.</div>';
    setStatus('잠금한 과목이 꺼둔 학년, 요일 또는 교시에 포함되어 있습니다.', true);
    syncLockedUi();
    return;
  }
  if (locked.some((course, index) => conflicts(course, locked.slice(0, index)))) {
    result.innerHTML = '<div class="planner-no-solution">잠금한 과목끼리 시간이 겹치거나 동일 과목 분반이 중복되었습니다.</div>';
    setStatus('잠금한 과목끼리 시간이 겹치거나 동일 과목 분반이 중복되었습니다.', true);
    syncLockedUi();
    return;
  }
  const selected = locked.slice();
  const targets = activeTargets();
  if (data.showAllCourses && targets.every(target => !target.count)) {
    for (const course of availableCourses) {
      if (selected.some(picked => picked.id === course.id) || conflicts(course, selected)) continue;
      selected.push(course);
    }
    currentCourseIds = new Set(selected.map(course => course.id));
    renderCurrent(selected.length + '개 과목을 표시 중입니다.', false);
    return;
  }
  for (const target of targets) {
    const already = selected.filter(course => courseMatchesTarget(course, target.key)).length;
    const remaining = Math.max(0, target.count - already);
    const pool = shuffle(availableCourses.filter(course => !selected.some(picked => picked.id === course.id || sameCourse(picked, course)) && courseMatchesTarget(course, target.key)), seed + selected.length + target.count);
    const picked = pick(pool, remaining, selected);
    if (picked.length !== remaining) {
      const label = targetLabel(target.key);
      result.innerHTML = '<div class="planner-no-solution">선택한 조건으로 ' + e(label) + ' ' + target.count + '개를 충족할 수 없습니다.</div>';
      setStatus('선택한 조건으로 ' + label + ' ' + target.count + '개를 충족할 수 없습니다.', true);
      syncLockedUi();
      return;
    }
    selected.push(...picked);
  }
  currentCourseIds = new Set(selected.map(course => course.id));
  renderCurrent(selected.length + '개 과목이 선택됐습니다.', false);
};
const updateToggle = (button, enabled) => {
  button.classList.toggle("active", enabled);
  button.classList.toggle("disabled", !enabled);
  button.setAttribute("aria-pressed", String(enabled));
};
for (const button of dayButtons) {
  button.addEventListener("click", () => {
    const day = Number(button.getAttribute("data-planner-day"));
    const nextDays = toggledSet(disabledDays, day);
    if (!guardLockedAvailability(nextDays, disabledPeriods, disabledGrades)) return;
    replaceSet(disabledDays, nextDays);
    updateToggle(button, !disabledDays.has(day));
    renderAvailabilityChange('제외 요일을 현재 시간표에 반영했습니다.');
  });
}
for (const button of periodButtons) {
  button.addEventListener("click", () => {
    const period = Number(button.getAttribute("data-planner-period"));
    const nextPeriods = toggledSet(disabledPeriods, period);
    if (!guardLockedAvailability(disabledDays, nextPeriods, disabledGrades)) return;
    replaceSet(disabledPeriods, nextPeriods);
    updateToggle(button, !disabledPeriods.has(period));
    renderAvailabilityChange('제외 교시를 현재 시간표에 반영했습니다.');
  });
}
for (const button of gradeButtons) {
  button.addEventListener("click", () => {
    const grade = button.getAttribute("data-planner-grade");
    if (!grade) return;
    const nextGrades = toggledSet(disabledGrades, grade);
    if (!guardLockedAvailability(disabledDays, disabledPeriods, nextGrades)) return;
    replaceSet(disabledGrades, nextGrades);
    updateToggle(button, !disabledGrades.has(grade));
    renderAvailabilityChange('학년 제외를 현재 시간표에 반영했습니다.');
  });
}
root.addEventListener("click", (event) => {
  const addTarget = event.target.closest("[data-planner-add]");
  if (addTarget && root.contains(addTarget)) {
    const addId = addTarget.getAttribute("data-planner-add");
    addCourse(data.courses.find(item => item.id === addId));
    return;
  }
  const target = event.target.closest(".planner-calendar-block[data-course-id]");
  if (!target || !root.contains(target)) return;
  const id = target.getAttribute("data-course-id");
  const course = data.courses.find(item => item.id === id);
  if (!course) return;
  if (!lockedCourseIds.has(id) && !courseAllowed(course)) {
    setStatus('꺼둔 학년, 요일 또는 교시에 있는 과목은 잠글 수 없습니다.', true);
    return;
  }
  if (!lockedCourseIds.has(id)) {
    const locked = data.courses.filter(item => lockedCourseIds.has(item.id));
    if (conflicts(course, locked)) {
      setStatus('이미 잠근 과목과 시간이 겹쳐 잠글 수 없습니다.', true);
      return;
    }
    lockedCourseIds.add(id);
  } else {
    lockedCourseIds.delete(id);
  }
  syncLockedUi();
  setStatus('시간표에서 선택한 과목의 잠금 상태를 변경했습니다. 새 조합은 무작위 시간표 만들기를 눌러 적용하세요.', false);
});
root.addEventListener("contextmenu", (event) => {
  const target = event.target.closest(".planner-calendar-block[data-course-id]");
  if (!target || !root.contains(target)) return;
  event.preventDefault();
  const id = target.getAttribute("data-course-id");
  const course = data.courses.find(item => item.id === id);
  removeCourse(course);
});
for (const input of root.querySelectorAll("[data-planner-choice-option]")) {
  input.addEventListener("change", () => {
    const groupKey = matchKey(input.getAttribute("data-planner-choice-option"));
    const optionKey = matchKey(input.value);
    if (!groupKey || !optionKey || !input.checked) return;
    choiceSelections.set(groupKey, optionKey);
    syncChoiceUi();
    const removed = pruneUnavailableUnlockedCourses();
    renderCurrent('선택형 요건을 현재 시간표에 반영했습니다.' + (removed ? ' 선택과 맞지 않는 ' + removed + '개 과목을 시간표에서 뺐습니다.' : '') + ' 새 조합은 무작위 시간표 만들기를 눌러 적용하세요.', false);
  });
}
generateButton.addEventListener("click", () => generate(true));
for (const button of root.querySelectorAll("[data-planner-step]")) {
  button.addEventListener("click", () => {
    const key = button.getAttribute("data-planner-step");
    const control = findCountControl(key);
    const delta = Number(button.getAttribute("data-step-delta") || 0);
    setCountValue(control, countValue(control) + delta);
    markNeedsGenerate();
  });
}
for (const control of allCountControls()) {
  control.addEventListener("input", () => {
    setCountValue(control, control.value);
    markNeedsGenerate();
  });
  control.addEventListener("change", () => {
    setCountValue(control, control.value);
    markNeedsGenerate();
  });
}
if (searchInput) searchInput.addEventListener("input", renderSearchResults);
if (advancedToggle) advancedToggle.addEventListener("change", () => {
  root.classList.toggle("advanced-on", advancedToggle.checked);
  markNeedsGenerate();
});
updateCreditSummary(currentCourses().filter(courseUsable));
renderSearchResults();
syncLockedUi();
syncChoiceUi();
if (requiredChoiceMissing().length) setStatus(choiceBlockMessage(), true);
})();`;
}

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
  const parts = raw.split(/\s*(?:~|-|\u2013|\u2014)\s*/);
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

type GraduationCourseRef = string | {
  courseTitle?: string;
  title?: string;
  courseCode?: string;
  code?: string;
  category?: string;
  credits?: number;
  credit?: number;
  status?: string;
  note?: string;
  year?: number | string;
  academicYear?: number | string;
  semester?: number | string;
  term?: number | string;
  termLabel?: string;
  semesterLabel?: string;
  completedTermLabel?: string;
  takenTermLabel?: string;
  groupKey?: string | null;
  groupLabel?: string | null;
  groupRequiredCourseCodes?: string[];
  groupRequiredCourseTitles?: string[];
  groupMinCourses?: number;
  groupType?: string | null;
  alternativeGroup?: string | null;
  sourceTitle?: string;
  sourceUrl?: string;
};

type GraduationRequirementSource = {
  id?: number;
  department?: string;
  admissionYear?: number | string;
  sourceKind?: string;
  title?: string;
  url?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  publishedAt?: string;
  sourcePublishedAt?: string | null;
  retrievedAt?: string;
  sourceRetrievedAt?: string;
  status?: string;
  rules?: Array<Record<string, unknown>>;
};

type GraduationRequirementCourseGroup = {
  groupKey?: string | null;
  label?: string;
  requiredCredits?: number;
  minCourses?: number;
  requiredCourseCodes?: string[];
  requiredCourseTitles?: string[];
  groupType?: string | null;
  alternativeGroup?: string | null;
  appliesTo?: Record<string, unknown>;
  note?: string | null;
};

type GraduationRequirementRule = {
  id?: string;
  key?: string;
  requirementKey?: string;
  label: string;
  category?: string;
  requiredCredits?: number;
  earnedCredits?: number;
  status?: "completed" | "missing" | "unprovided" | string;
  requiredCourseCodes?: string[];
  requiredCourseTitles?: string[];
  courseGroups?: GraduationRequirementCourseGroup[];
  requiredCourses?: GraduationCourseRef[];
  missingCourses?: GraduationCourseRef[];
  completedCourses?: GraduationCourseRef[];
  satisfiedBy?: GraduationCourseRef[];
  programTrack?: string;
  minCourses?: number;
  appliesTo?: Record<string, unknown>;
  note?: string;
  source?: GraduationRequirementSource;
  sourceTitle?: string;
  sourceUrl?: string;
};

type GraduationRequirementSection = {
  label: string;
  earned?: number;
  required?: number;
  gap?: number;
  requiredCourses?: GraduationCourseRef[];
  missingRequiredCourses?: GraduationCourseRef[];
  completedRequiredCourses?: GraduationCourseRef[];
  detailCourses?: GraduationCourseRef[];
  completedCourses?: GraduationCourseRef[];
  missingCourses?: GraduationCourseRef[];
  sourceTitle?: string;
  sourceUrl?: string;
};

type GraduationAreaCourseRow = {
  name: string;
  status: "completed" | "missing" | "provided" | "unprovided";
  credits?: number;
  category?: string;
  note?: string;
  termLabel?: string;
  termOrder?: number;
  groupKey?: string;
  alternativeGroup?: string;
  matchKeys?: string[];
  requirementSummary?: boolean;
  satisfiedKeys?: string[];
  satisfiedByAlternative?: boolean;
  matchedCount?: number;
  requiredCount?: number;
  choiceGroupKey?: string;
  choiceOptionKey?: string;
  choicePrompt?: boolean;
  choiceHidden?: boolean;
  moreHidden?: boolean;
};

const GRADUATION_MORE_BATCH_SIZE = 10;

type GraduationQueryContext = {
  department?: unknown;
  departmentLabel?: unknown;
  displayDepartment?: unknown;
  admissionYear?: unknown;
  studentStanding?: unknown;
  studentNumber?: unknown;
  student_number?: unknown;
  studentId?: unknown;
  student_id?: unknown;
  studentNo?: unknown;
  student_no?: unknown;
  stdNo?: unknown;
  std_no?: unknown;
  hakbun?: unknown;
  학번?: unknown;
  studentNumberProvided?: unknown;
  studentType?: unknown;
  student_type?: unknown;
  expectedGraduationTerm?: unknown;
  graduationTerm?: unknown;
  unavailableReason?: unknown;
};

function graduationScalarText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function graduationStudentNumberValue(...sources: Array<Record<string, unknown> | undefined>): unknown {
  for (const source of sources) {
    if (!source) continue;
    const value = source.studentNumber
      ?? source.student_number
      ?? source.studentId
      ?? source.student_id
      ?? source.studentNo
      ?? source.student_no
      ?? source.stdNo
      ?? source.std_no
      ?? source.hakbun
      ?? source.학번;
    if (graduationScalarText(value)) return value;
  }
  return undefined;
}

function graduationQueryContext(
  d: {
    department?: unknown;
    departmentLabel?: unknown;
    displayDepartment?: unknown;
    studentStanding?: unknown;
    admissionYear?: unknown;
    expectedGraduationTerm?: unknown;
    graduationTerm?: unknown;
    studentNumber?: unknown;
    student_number?: unknown;
    studentId?: unknown;
    student_id?: unknown;
    studentNo?: unknown;
    student_no?: unknown;
    stdNo?: unknown;
    std_no?: unknown;
    hakbun?: unknown;
    학번?: unknown;
    studentNumberProvided?: unknown;
    studentType?: unknown;
    student_type?: unknown;
    studentCategory?: unknown;
    query?: GraduationQueryContext;
  },
  sources: GraduationRequirementSource[] = [],
): { department: string; admissionYear: string; expectedGraduationTerm: string; studentType: string; studentNumberBased: boolean; studentStanding: string } {
  const query = d.query ?? {};
  const firstSource = sources[0] ?? {};
  const inferredAdmissionYear = graduationAdmissionYearFromData(d);
  const studentNumberBased = graduationStudentNumberProvided(d);
  const rawStudentType = graduationScalarText(
    query.studentType
      ?? query.student_type
      ?? d.studentType
      ?? d.student_type
      ?? d.studentCategory,
  );
  const studentType = graduationNormalizeStudentType(rawStudentType);
  return {
    department: graduationDepartmentText(
      query.departmentLabel,
      query.displayDepartment,
      d.departmentLabel,
      d.displayDepartment,
      query.department,
      d.department,
      firstSource.department,
    ),
    admissionYear: graduationScalarText(query.admissionYear)
      || graduationScalarText(d.admissionYear)
      || (inferredAdmissionYear != null ? String(inferredAdmissionYear) : "")
      || graduationScalarText(firstSource.admissionYear),
    expectedGraduationTerm: graduationScalarText(query.expectedGraduationTerm ?? query.graduationTerm)
      || graduationScalarText(d.expectedGraduationTerm ?? d.graduationTerm),
    studentType: studentType === "foreign" ? "외국인학생" : studentType === "domestic" && rawStudentType ? "내국인학생" : "",
    studentNumberBased,
    studentStanding: graduationScalarText(query.studentStanding) || graduationScalarText(d.studentStanding),
  };
}

function graduationDepartmentText(...values: unknown[]): string {
  for (const value of values) {
    const text = graduationScalarText(value).replace(/^\d{5}\s+/u, "").trim();
    if (text) return text;
  }
  return "";
}

function graduationQueryMeta(context: { department: string; admissionYear: string; expectedGraduationTerm: string; studentType?: string; studentNumberBased?: boolean; studentStanding?: string }): string {
  return joinMeta([
    context.department ? `학과 ${context.department}` : "",
    context.admissionYear ? `${context.admissionYear}학번` : "",
    context.studentStanding || "",
    context.studentNumberBased ? "학번 기준 판별" : "",
    context.studentType || "",
    context.expectedGraduationTerm ? `졸업예정 ${context.expectedGraduationTerm}` : "",
  ]);
}

function graduationUnavailableReason(d: { query?: GraduationQueryContext; unavailableReason?: unknown }): string {
  const query = d.query ?? {};
  return graduationScalarText(query.unavailableReason ?? d.unavailableReason);
}

function graduationStudentTypeFromData(d: {
  query?: GraduationQueryContext;
  studentType?: unknown;
  student_type?: unknown;
  studentCategory?: unknown;
}): "domestic" | "foreign" {
  const query = d.query ?? {};
  const raw = graduationScalarText(
    query.studentType
      ?? query.student_type
      ?? d.studentType
      ?? d.student_type
      ?? d.studentCategory,
  );
  return graduationNormalizeStudentType(raw) ?? "domestic";
}

function graduationNormalizeStudentType(value: string): "domestic" | "foreign" | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["domestic", "local", "korean", "내국인", "국내"].includes(normalized)) return "domestic";
  if (["foreign", "international", "foreigner", "외국인", "유학생"].includes(normalized)) return "foreign";
  return undefined;
}

function graduationAppliesToStudentType(
  appliesTo: Record<string, unknown> | undefined,
  studentType: "domestic" | "foreign",
): boolean {
  const requiredStudentType = graduationNormalizeStudentType(
    graduationScalarText(appliesTo?.studentType ?? appliesTo?.student_type),
  );
  return !requiredStudentType || requiredStudentType === studentType;
}

function renderGraduationUnavailable(d: {
  department?: string;
  admissionYear?: number | string;
  expectedGraduationTerm?: string;
  graduationTerm?: string;
  query?: GraduationQueryContext;
  unavailableReason?: unknown;
  requirements?: GraduationRequirementRule[];
  graduationRequirements?: GraduationRequirementRule[];
}): string {
  const meta = graduationQueryMeta(graduationQueryContext(d));
  const reason = graduationUnavailableReason(d) || "공식 기준 확인 필요: 학과/학번 기준의 공식 졸업요건 데이터를 찾지 못했습니다.";
  return `<section class="section"><div class="section-title"><h2>졸업 로드맵</h2></div><div class="section-sub">${meta ? `${meta} · ` : ""}${esc(reason)}</div></section>`;
}

function renderGraduationAreaAccordion(
  creditGaps: GraduationRequirementSection[],
  doneCount: number,
  choiceGroups: RequirementChoiceGroup[] = [],
  selectedChoices: RequirementChoiceSelections = {},
): string {
  let html = `<section class="section"><div class="section-title"><h2>영역별<span class="count">${creditGaps.length}</span></h2></div><div class="section-sub">영역 카드를 눌러 상세내용을 확인할 수 있습니다.</div><div class="grad-area-tools"><div class="section-sub">완료 ${doneCount} · 진행 ${creditGaps.length - doneCount}</div><div class="grad-sort-controls" data-grad-sort-controls aria-label="이수과목 정렬"><button type="button" class="active" data-grad-sort="default">기본</button><button type="button" data-grad-sort="asc">학기 ↑</button><button type="button" data-grad-sort="desc">학기 ↓</button></div></div><div class="ring-grid grad-area-list">`;
  for (const g of creditGaps) {
    const earned = graduationCreditNumber(g.earned) ?? 0;
    const gap = graduationGap(g);
    const required = graduationCreditNumber(g.required) ?? Math.max(earned, gap);
    const perc = required > 0 ? Math.min(100, Math.round((earned / required) * 100)) : 100;
    const done = gap === 0;
    const rs = 40, rstroke = 4;
    const rr = (rs - rstroke) / 2;
    const rc = 2 * Math.PI * rr;
    const rdash = rc * (perc / 100);
    html += `<details class="ring-card grad-area-card"><summary><div class="ring-card-head"><div class="ring" style="width:${rs}px;height:${rs}px"><svg width="${rs}" height="${rs}"><circle class="ring-track" cx="${rs / 2}" cy="${rs / 2}" r="${rr}" stroke-width="${rstroke}"/><circle class="ring-fill ${done ? "done" : ""}" cx="${rs / 2}" cy="${rs / 2}" r="${rr}" stroke-width="${rstroke}" stroke-dasharray="${rdash} ${rc - rdash}"/></svg></div><div class="ring-card-pct ${done ? "done" : ""}">${done ? "✓ 완료" : `${perc}%`}</div></div><div><div class="ring-card-title">${esc(g.label)}</div><div class="ring-card-meta">${earned} / ${required} 학점 · ${done ? "완료" : `${gap}학점 부족`}</div></div></summary><div class="grad-area-body" data-grad-more-scope="rows">${renderGraduationAreaCourses(g, choiceGroups, selectedChoices)}</div></details>`;
  }
  html += `</div></section><script>${graduationClientScript()}</script>`;
  return html;
}

function renderGraduationAreaCourses(
  section: GraduationRequirementSection,
  choiceGroups: RequirementChoiceGroup[] = [],
  selectedChoices: RequirementChoiceSelections = {},
): string {
  const rows = graduationRowsWithDisplayState(
    graduationAreaCourseRows(section),
    section,
    choiceGroups,
    selectedChoices,
  );
  if (!rows.length) {
    const earned = graduationCreditNumber(section.earned) ?? 0;
    const required = graduationCreditNumber(section.required) ?? 0;
    if (earned === 0 && required === 0 && graduationGap(section) === 0) {
      return `<div class="grad-area-empty">선택 이수 과정이라 현재 표시할 세부 과목이 없습니다.</div>`;
    }
    return `<div class="grad-area-empty">공식 기준 확인 필요: 과목 단위 상세를 확인할 수 없습니다.</div>`;
  }
  const rowHtml = rows.map((row) => {
    const statusText = row.status === "completed"
      ? "이수"
      : row.status === "missing"
        ? "미수강"
        : row.status === "unprovided"
          ? "미제공"
          : "확인";
    const meta = joinMeta([
      row.termLabel,
      row.credits != null ? `${row.credits}학점` : "",
      row.category,
      row.note,
    ]);
    const termOrder = row.termOrder != null ? String(row.termOrder) : "";
    const hidden = row.choiceHidden || row.moreHidden ? " hidden" : "";
    const choiceAttrs = row.choiceGroupKey ? ` data-grad-choice-group-row="${esc(row.choiceGroupKey)}" data-grad-choice-option-row="${esc(row.choiceOptionKey || "")}"${row.choicePrompt ? " data-grad-choice-prompt=\"true\"" : ""}` : "";
    const moreAttrs = row.moreHidden ? " data-grad-more-row" : "";
    return `<div class="grad-course-detail-row" data-grad-course-row data-grad-status="${esc(row.status)}" data-grad-term-order="${esc(termOrder)}" data-grad-name="${esc(row.name)}"${choiceAttrs}${moreAttrs}${hidden}><div><strong>${esc(row.name)}</strong>${meta ? `<span>${meta}</span>` : ""}</div><em class="grad-course-status ${row.status}">${esc(statusText)}</em></div>`;
  }).join("");
  const moreHtml = graduationMoreButton(rows, section);
  return rowHtml + moreHtml;
}

function graduationRowsWithDisplayState(
  rows: GraduationAreaCourseRow[],
  section: GraduationRequirementSection,
  choiceGroups: RequirementChoiceGroup[],
  selectedChoices: RequirementChoiceSelections,
): GraduationAreaCourseRow[] {
  const displayRows = rows.map((row) => ({ ...row }));
  const promptRows: GraduationAreaCourseRow[] = [];
  for (const group of choiceGroups.filter((item) => item.selectable)) {
    const selectedKey = selectedChoices[group.key];
    let firstMatchIndex = -1;
    let hasMatchedRows = false;
    for (let index = 0; index < displayRows.length; index += 1) {
      const row = displayRows[index];
      const matchedOptions = group.options.filter((option) => graduationRowMatchesRequirementChoiceOption(row, option));
      if (!matchedOptions.length) continue;
      hasMatchedRows = true;
      if (firstMatchIndex === -1) firstMatchIndex = index;
      const selectedMatch = selectedKey
        ? matchedOptions.find((option) => option.key === selectedKey)
        : undefined;
      row.choiceGroupKey = group.key;
      row.choiceOptionKey = selectedMatch?.key ?? matchedOptions[0]?.key;
      row.choiceHidden = selectedKey ? !selectedMatch : true;
    }
    if (hasMatchedRows && group.required && !group.options.some((option) => option.key === selectedKey)) {
      promptRows.push({
        name: `${group.label} 선택 필요`,
        status: "unprovided",
        category: section.label,
        note: "공식 기준에 따라 사용자가 선택해야 표시됩니다.",
        choiceGroupKey: group.key,
        choicePrompt: true,
        termOrder: firstMatchIndex >= 0 ? -100000 + firstMatchIndex : undefined,
      });
    }
  }
  return graduationRowsWithMoreState([...promptRows, ...displayRows], section);
}

function graduationRowMatchesRequirementChoiceOption(
  row: GraduationAreaCourseRow,
  option: RequirementChoiceOption,
): boolean {
  const rowKeys = new Set([
    row.name,
    row.groupKey,
    ...row.name.split(/\s*[-:]\s*/),
  ].map(stringFrom).filter(Boolean).map(graduationCourseMatchKey));
  const optionKeys = [
    ...option.courseTitles,
    ...option.courseCodes,
    ...option.requirementKeys,
    ...option.courseGroupKeys,
  ].map(graduationCourseMatchKey);
  return optionKeys.some((key) => rowKeys.has(key));
}

function graduationRowsWithMoreState(
  rows: GraduationAreaCourseRow[],
  _section: GraduationRequirementSection,
): GraduationAreaCourseRow[] {
  const candidates = rows.filter((row) => !row.choiceHidden && !row.choicePrompt);
  if (candidates.length <= GRADUATION_MORE_BATCH_SIZE) return rows;
  let visibleCount = 0;
  return rows.map((row) => {
    if (row.choiceHidden || row.choicePrompt) return row;
    visibleCount += 1;
    return visibleCount > GRADUATION_MORE_BATCH_SIZE
      ? { ...row, moreHidden: true }
      : row;
  });
}

function graduationMoreButton(
  rows: GraduationAreaCourseRow[],
  _section: GraduationRequirementSection,
): string {
  const hiddenCount = rows.filter((row) => row.moreHidden).length;
  const potentialCount = rows.filter((row) => !row.choicePrompt).length;
  if (hiddenCount === 0 && potentialCount <= GRADUATION_MORE_BATCH_SIZE) return "";
  return `<button class="grad-more-button" type="button" data-grad-more data-grad-more-batch="${GRADUATION_MORE_BATCH_SIZE}"${hiddenCount ? "" : " hidden"}>더보기</button>`;
}

function renderGraduationSourceSummary(
  d: {
    query?: GraduationQueryContext;
    admissionYear?: unknown;
    studentNumber?: unknown;
    student_number?: unknown;
    studentId?: unknown;
    student_id?: unknown;
    studentNo?: unknown;
    student_no?: unknown;
    stdNo?: unknown;
    std_no?: unknown;
    hakbun?: unknown;
    studentType?: unknown;
    student_type?: unknown;
    studentCategory?: unknown;
    expectedGraduationTerm?: unknown;
    graduationTerm?: unknown;
    requirementSources?: GraduationRequirementSource[];
    graduationRequirementSources?: GraduationRequirementSource[];
    sources?: GraduationRequirementSource[];
    items?: GraduationRequirementSource[];
  },
  ruleSources: GraduationRequirementSource[],
): string {
  const sources = graduationSourceMetadataFromData(d, ruleSources);
  if (!sources.length) return "";
  const links = sources.map((source) => {
    const title = graduationSourceTitle(source);
    const url = graduationSourceUrl(source);
    return `<a class="grad-area-source" href="${esc(url)}" target="_blank" rel="noopener noreferrer">공식 출처: ${esc(title)}</a>`;
  }).join("");
  return `<section class="section"><div class="section-title"><h2>적용 공식 출처<span class="count">${sources.length}</span></h2></div><div class="section-sub">현재 학과와 학번 기준으로 필터링된 출처입니다.</div><div class="grad-source-list">${links}</div></section>`;
}

function renderGraduationChoiceSection(
  choiceGroups: RequirementChoiceGroup[],
  selectedChoiceKeys: RequirementChoiceSelections,
): string {
  if (!choiceGroups.length) return "";
  return `<section class="section"><div class="section-title"><h2>선택형 기준<span class="count">${choiceGroups.length}</span></h2></div>${renderRequirementChoiceControls(choiceGroups, selectedChoiceKeys, "graduation")}</section>`;
}

function graduationSourceMetadataFromData(
  d: {
    query?: GraduationQueryContext;
    admissionYear?: unknown;
    studentNumber?: unknown;
    student_number?: unknown;
    studentId?: unknown;
    student_id?: unknown;
    studentNo?: unknown;
    student_no?: unknown;
    stdNo?: unknown;
    std_no?: unknown;
    hakbun?: unknown;
    studentType?: unknown;
    student_type?: unknown;
    studentCategory?: unknown;
    expectedGraduationTerm?: unknown;
    graduationTerm?: unknown;
    requirementSources?: GraduationRequirementSource[];
    graduationRequirementSources?: GraduationRequirementSource[];
    sources?: GraduationRequirementSource[];
    items?: GraduationRequirementSource[];
    creditGaps?: GraduationRequirementSection[];
  },
  ruleSources: GraduationRequirementSource[],
): GraduationRequirementSource[] {
  const admissionYear = graduationAdmissionYearFromData(d);
  const candidates = [ruleSources, d.requirementSources, d.graduationRequirementSources, d.sources, d.items, d.creditGaps];
  const byKey = new Map<string, GraduationRequirementSource>();
  const addSource = (source: GraduationRequirementSource) => {
    const url = graduationSourceUrl(source);
    if (!url || !/^https?:\/\//i.test(url)) return;
    const title = graduationSourceTitle(source) || "공식 출처";
    const key = `${url}\u0000${title}`;
    if (!byKey.has(key)) byKey.set(key, source);
  };
  for (const sourceList of candidates) {
    if (!Array.isArray(sourceList)) continue;
    for (const source of sourceList) {
    if (!source || typeof source !== "object") continue;
      const sourceRecord = source as Record<string, unknown>;
      const hasRules = Array.isArray(sourceRecord.rules) && sourceRecord.rules.length > 0;
      if (hasRules && sourceList !== ruleSources) continue;
      if (!graduationSourceAppliesToContext(source, admissionYear)) continue;
      addSource(source);
    }
  }
  return [...byKey.values()];
}

function graduationAreaCourseRows(section: GraduationRequirementSection): GraduationAreaCourseRow[] {
  let rows: GraduationAreaCourseRow[] = [];
  const seen = new Set<string>();
  const completedCourseKeys: string[] = [];
  const push = (course: GraduationCourseRef, fallbackStatus: GraduationAreaCourseRow["status"]) => {
    const row = graduationCourseRow(course, fallbackStatus);
    if (!row.name) return;
    row.matchKeys = graduationCourseSearchKeys(course, row.name);
    const key = graduationAreaRowDedupeKey(row);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
    if (row.status === "completed") completedCourseKeys.push(...row.matchKeys);
  };

  for (const course of section.detailCourses ?? []) push(course, "provided");
  for (const course of section.completedCourses ?? []) push(course, "completed");
  for (const course of section.completedRequiredCourses ?? []) push(course, "completed");
  for (const course of section.missingCourses ?? []) push(course, "missing");
  for (const course of section.missingRequiredCourses ?? []) push(course, "missing");

  if (graduationFreeElectiveSection(section)) {
    rows.unshift({
      name: "자유선택 포함 기준",
      status: "provided",
      note: graduationFreeElectiveExplanation(),
    });
  }

  const completedKeySet = new Set(completedCourseKeys);
  rows = graduationRowsWithoutSupersededZeroCreditAttempts(rows);
  rows = rows.filter((row) =>
    row.status !== "missing" || !(row.matchKeys ?? [graduationCourseMatchKey(row.name)]).some((key) => completedKeySet.has(key)),
  );
  const requiredRows: GraduationAreaCourseRow[] = [];
  for (const course of section.requiredCourses ?? []) {
    const row = graduationRequirementCourseRow(course, completedCourseKeys);
    const rowKeys = graduationCourseSearchKeys(course, row.name);
    row.matchKeys = rowKeys;
    if (!row.name || rowKeys.some((key) => completedKeySet.has(key))) continue;
    const key = graduationAreaRowDedupeKey(row);
    if (!seen.has(key)) {
      seen.add(key);
      requiredRows.push(row);
    }
  }
  rows.push(...graduationRowsWithoutSatisfiedRequirementSummaries(
    graduationResolveAlternativeRows(requiredRows),
    completedKeySet,
  ));

  const gap = graduationGap(section);
  if (gap > 0 && !rows.some((row) => row.status === "missing")) {
    rows.push({
      name: graduationMissingCourseName(section),
      status: "missing",
      credits: gap,
      note: graduationMissingCourseNote(section),
    });
  }
  return rows;
}

function graduationRowsWithoutSatisfiedRequirementSummaries(
  rows: GraduationAreaCourseRow[],
  completedKeySet: Set<string>,
): GraduationAreaCourseRow[] {
  return rows.filter((row) => {
    if (!row.requirementSummary) return true;
    if (row.status === "missing" || row.status === "unprovided") return true;
    if (row.satisfiedByAlternative) return false;
    const satisfiedKeys = row.satisfiedKeys ?? [];
    return !satisfiedKeys.length || !satisfiedKeys.every((key) => completedKeySet.has(key));
  });
}

function graduationRowsWithoutSupersededZeroCreditAttempts(rows: GraduationAreaCourseRow[]): GraduationAreaCourseRow[] {
  const positiveCompleted = new Set(
    rows
      .filter((row) => row.status === "completed" && (row.credits ?? 0) > 0)
      .map(graduationDisplayCourseKey)
      .filter(Boolean),
  );
  if (!positiveCompleted.size) return rows;
  return rows.filter((row) => {
    if (row.status !== "completed" || (row.credits ?? 0) !== 0) return true;
    const key = graduationDisplayCourseKey(row);
    return !key || !positiveCompleted.has(key);
  });
}

function graduationDisplayCourseKey(row: GraduationAreaCourseRow): string {
  const displayName = row.name
    .replace(/^[A-Z]{2,}\d+\s*-\s*/u, "")
    .trim();
  return graduationCourseMatchKey(displayName);
}

function graduationAreaRowDedupeKey(row: GraduationAreaCourseRow): string {
  const nameKey = graduationCourseMatchKey(row.name);
  if (row.status !== "completed") return `${row.status}:${nameKey}`;
  return [
    row.status,
    nameKey,
    row.termLabel ?? "",
    row.termOrder != null ? String(row.termOrder) : "",
    row.note ?? "",
  ].join(":");
}

function graduationRequirementCourseRow(
  course: GraduationCourseRef,
  completedCourseKeys: string[],
): GraduationAreaCourseRow {
  if (typeof course === "string") return graduationCourseRow(course, "missing");
  const options = graduationRequirementCourseOptions(course);
  if (!options.length) return graduationCourseRow(course, "missing");
  const matchedOptions = options.filter((option) =>
    option.keys.some((optionKey) => completedCourseKeys.some((completedKey) => completedKey === optionKey)),
  );
  const requiredCount = Math.max(1, Math.min(course.groupMinCourses ?? options.length, options.length));
  const computedStatus = matchedOptions.length >= requiredCount ? "completed" : "missing";
  const row = graduationCourseRow({ ...course, status: computedStatus }, computedStatus);
  row.status = computedStatus;
  row.requirementSummary = true;
  row.satisfiedKeys = matchedOptions.flatMap((option) => option.keys);
  row.matchedCount = matchedOptions.length;
  row.requiredCount = requiredCount;
  row.alternativeGroup = stringFrom(course.alternativeGroup);
  if (matchedOptions.length >= requiredCount) {
    row.note = graduationPlainMeta([row.note, `충족: ${matchedOptions.map((option) => option.label).join(", ")}`]);
    return row;
  }
  const remainingOptions = options.filter((option) => !matchedOptions.includes(option));
  const remainingCount = Math.max(1, requiredCount - matchedOptions.length);
  const needed = remainingOptions.length > remainingCount
    ? `필요: ${remainingOptions.map((option) => option.label).join(", ")} 중 ${remainingCount}개`
    : `필요: ${remainingOptions.map((option) => option.label).join(", ")}`;
  row.note = graduationPlainMeta([
    row.note,
    matchedOptions.length ? `${matchedOptions.length}/${requiredCount}개 이수` : "",
    needed,
  ]);
  return row;
}

function graduationRequirementCourseOptions(
  course: Exclude<GraduationCourseRef, string>,
): Array<{ label: string; keys: string[] }> {
  const titles = Array.isArray(course.groupRequiredCourseTitles) ? course.groupRequiredCourseTitles : [];
  const codes = Array.isArray(course.groupRequiredCourseCodes) ? course.groupRequiredCourseCodes : [];
  if (!titles.length && !codes.length) {
    const label = stringFrom(course.courseTitle ?? course.title ?? course.courseCode ?? course.code);
    const keys = [course.courseTitle, course.title, course.courseCode, course.code]
      .map(stringFrom)
      .filter(Boolean)
      .map(graduationCourseMatchKey);
    return label && keys.length ? [{ label, keys: [...new Set(keys)] }] : [];
  }
  const count = Math.max(titles.length, codes.length);
  return Array.from({ length: count }, (_, index) => {
    const label = stringFrom(titles[index] ?? codes[index]);
    const keys = [titles[index], codes[index]]
      .map(stringFrom)
      .filter(Boolean)
      .map(graduationCourseMatchKey);
    return label && keys.length ? { label, keys: [...new Set(keys)] } : undefined;
  }).filter((option): option is { label: string; keys: string[] } => Boolean(option));
}

function graduationResolveAlternativeRows(rows: GraduationAreaCourseRow[]): GraduationAreaCourseRow[] {
  const satisfiedAlternatives = new Set(
    rows
      .filter((row) => row.alternativeGroup && row.status === "completed")
      .map((row) => row.alternativeGroup!),
  );
  return rows.map((row) => {
    if (!row.alternativeGroup || !satisfiedAlternatives.has(row.alternativeGroup) || row.status === "completed") {
      return row;
    }
    return {
      ...row,
      status: "provided",
      note: graduationPlainMeta([row.note, "대체군 충족"]),
      satisfiedByAlternative: true,
    };
  });
}

function graduationPlainMeta(parts: Array<string | number | null | undefined>, sep = " · "): string {
  return parts
    .filter((x): x is string | number => x !== null && x !== undefined && x !== "")
    .map((x) => String(x))
    .join(sep);
}

function graduationCourseRow(course: GraduationCourseRef, fallbackStatus: GraduationAreaCourseRow["status"]): GraduationAreaCourseRow {
  if (typeof course === "string") {
    return { name: course.trim(), status: fallbackStatus };
  }
  const status = course.status === "completed" || course.status === "done" || course.status === "이수"
    ? "completed"
    : course.status === "missing" || course.status === "required" || course.status === "미수강"
      ? "missing"
      : course.status === "unprovided" || course.status === "미제공"
        ? "unprovided"
      : fallbackStatus;
  const title = stringFrom(course.courseTitle ?? course.title);
  const code = stringFrom(course.courseCode ?? course.code);
  const name = [code, title].filter(Boolean).join(" - ") || title || code;
  const note = stringFrom(course.note);
  const term = graduationCourseTermInfo(course, note);
  return {
    name,
    status,
    credits: numberFrom(course.credits ?? course.credit),
    category: stringFrom(course.category),
    note: term.label && note === term.label ? "" : note,
    termLabel: term.label,
    termOrder: term.order,
    groupKey: stringFrom(course.groupKey),
  };
}

function graduationCourseSearchKeys(course: GraduationCourseRef, fallbackName: string): string[] {
  if (typeof course === "string") return [graduationCourseMatchKey(course)];
  const keys = [
    course.courseTitle,
    course.title,
    course.courseCode,
    course.code,
    fallbackName,
  ].map(stringFrom).filter(Boolean).map(graduationCourseMatchKey);
  return [...new Set(keys)];
}

function graduationCourseTermInfo(course: Exclude<GraduationCourseRef, string>, note: string): { label?: string; order?: number } {
  const directLabel = stringFrom(course.termLabel ?? course.semesterLabel ?? course.completedTermLabel ?? course.takenTermLabel);
  const year = numberFrom(course.year ?? course.academicYear);
  const semester = graduationSemesterNumber(course.semester ?? course.term);
  const label = directLabel || (year != null && semester != null ? `${year} ${semester}학기` : "");
  const parsed = graduationParseTermLabel(label || note);
  return {
    label: label || parsed.label,
    order: parsed.order ?? (year != null && semester != null ? year * 10 + semester : undefined),
  };
}

function graduationParseTermLabel(value: string): { label?: string; order?: number } {
  const raw = value.trim();
  if (!raw) return {};
  const korean = raw.match(/((?:19|20)\d{2})\s*(?:학년도|년)?\s*([12])\s*학기/);
  const compact = raw.match(/((?:19|20)\d{2})\s*[-.]\s*([12])\b/);
  const match = korean ?? compact;
  if (!match) return {};
  const year = Number(match[1]);
  const semester = Number(match[2]);
  return { label: `${year} ${semester}학기`, order: year * 10 + semester };
}

function graduationSemesterNumber(value: unknown): number | undefined {
  const direct = numberFrom(value);
  if (direct === 1 || direct === 2) return direct;
  const text = stringFrom(value);
  const match = text.match(/[12]/);
  const parsed = match ? Number(match[0]) : undefined;
  return parsed === 1 || parsed === 2 ? parsed : undefined;
}

function graduationFreeElectiveSection(section: GraduationRequirementSection): boolean {
  return /자유\s*선택|free\s*elective/i.test(section.label);
}

function graduationMajorSection(section: GraduationRequirementSection): boolean {
  return /전공|major/i.test(section.label);
}

function graduationMissingCourseName(section: GraduationRequirementSection): string {
  if (graduationFreeElectiveSection(section)) return "자유선택 인정 학점 추가 필요";
  if (graduationMajorSection(section)) return "전공 선택 이수 필요";
  return "영역 내 추가 이수 필요";
}

function graduationMissingCourseNote(section: GraduationRequirementSection): string {
  if (graduationFreeElectiveSection(section)) {
    return `${graduationFreeElectiveExplanation()} 현재 부족분은 자유선택으로 인정될 추가 학점 기준입니다.`;
  }
  if (graduationMajorSection(section)) {
    return "필수 미수강 항목이 표시되지 않은 상태입니다. 부족 학점은 전공 선택 과목으로 채우는 기준입니다.";
  }
  return "MSI 졸업사정 기준";
}

function graduationFreeElectiveExplanation(): string {
  return "전공·교양 필수/영역 기준을 먼저 충족한 뒤, 졸업사정에서 자유선택으로 분류되는 초과 인정 학점이나 일반선택 학점입니다.";
}

function graduationClientScript(): string {
  return `(() => {
const controls = document.querySelector("[data-grad-sort-controls]");
const rows = Array.from(document.querySelectorAll("[data-grad-course-row]"));
rows.forEach((row, index) => { row.dataset.gradOriginalIndex = String(index); });
const matchKey = (value) => String(value || "").replace(/\\s+/g, "").trim().toLowerCase();
const choiceSelections = new Map();
for (const input of document.querySelectorAll("[data-graduation-choice-option]")) {
  if (input.checked) choiceSelections.set(matchKey(input.getAttribute("data-graduation-choice-option")), matchKey(input.value));
}
const numeric = (value) => {
  const n = Number(value || "");
  return Number.isFinite(n) && n > 0 ? n : null;
};
const originalIndex = (row) => Number(row.dataset.gradOriginalIndex || 0);
const missingRank = (row) => row.dataset.gradStatus === "missing" ? 1 : 0;
const choiceHidden = (row) => {
  const group = matchKey(row.dataset.gradChoiceGroupRow);
  if (!group) return false;
  const selected = choiceSelections.get(group);
  const prompt = row.dataset.gradChoicePrompt === "true";
  if (!selected) return !prompt;
  if (prompt) return true;
  return matchKey(row.dataset.gradChoiceOptionRow) !== selected;
};
const updateChoiceStatus = () => {
  for (const group of document.querySelectorAll("[data-graduation-choice-group]")) {
    const key = matchKey(group.getAttribute("data-graduation-choice-group"));
    const status = document.querySelector('[data-graduation-choice-status="' + key + '"]');
    if (!status) continue;
    status.textContent = choiceSelections.get(key) ? "선택됨" : group.getAttribute("data-required") === "true" ? "선택 필요" : "선택";
  }
};
const updateMore = (body) => {
  const scoped = body && body.hasAttribute("data-grad-more-scope");
  if (!scoped) return;
  const button = body.querySelector("[data-grad-more]");
  if (!button) return;
  const batch = Number(button && button.getAttribute("data-grad-more-batch") || ${GRADUATION_MORE_BATCH_SIZE});
  const limit = Number(body.dataset.gradMoreLimit || ${GRADUATION_MORE_BATCH_SIZE});
  let visible = 0;
  let hidden = 0;
  for (const row of Array.from(body.querySelectorAll("[data-grad-course-row]"))) {
    row.removeAttribute("data-grad-more-row");
    if (choiceHidden(row)) {
      row.hidden = true;
      continue;
    }
    if (row.dataset.gradChoicePrompt === "true") {
      row.hidden = false;
      continue;
    }
    visible += 1;
    const hideByMore = visible > limit;
    row.hidden = hideByMore;
    if (hideByMore) {
      row.setAttribute("data-grad-more-row", "");
      hidden += 1;
    }
  }
  if (button) {
    button.hidden = hidden === 0;
    button.textContent = "더보기";
  }
};
const syncChoices = (resetMore) => {
  updateChoiceStatus();
  document.querySelectorAll(".grad-area-body").forEach((body) => {
    if (resetMore) body.dataset.gradMoreLimit = String(${GRADUATION_MORE_BATCH_SIZE});
    updateMore(body);
  });
};
const sortBody = (body, mode) => {
  const bodyRows = Array.from(body.querySelectorAll("[data-grad-course-row]"));
  bodyRows.sort((a, b) => {
    if (mode === "default") return originalIndex(a) - originalIndex(b);
    const miss = missingRank(a) - missingRank(b);
    if (miss) return miss;
    const at = numeric(a.dataset.gradTermOrder);
    const bt = numeric(b.dataset.gradTermOrder);
    if (at != null && bt == null) return -1;
    if (at == null && bt != null) return 1;
    if (at != null && bt != null && at !== bt) return mode === "desc" ? bt - at : at - bt;
    const nameCompare = String(a.dataset.gradName || "").localeCompare(String(b.dataset.gradName || ""), "ko");
    return nameCompare || originalIndex(a) - originalIndex(b);
  });
  const anchor = body.querySelector("[data-grad-more]");
  bodyRows.forEach((row) => anchor ? body.insertBefore(row, anchor) : body.appendChild(row));
  updateMore(body);
};
if (controls) {
  controls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-grad-sort]");
    if (!button) return;
    const mode = button.getAttribute("data-grad-sort") || "default";
    controls.querySelectorAll("[data-grad-sort]").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".grad-area-body").forEach((body) => sortBody(body, mode));
  });
}
document.addEventListener("change", (event) => {
  const input = event.target.closest("[data-graduation-choice-option]");
  if (!input || !input.checked) return;
  choiceSelections.set(matchKey(input.getAttribute("data-graduation-choice-option")), matchKey(input.value));
  syncChoices(true);
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-grad-more]");
  if (!button) return;
  const body = button.closest(".grad-area-body");
  if (!body) return;
  const batch = Number(button.getAttribute("data-grad-more-batch") || ${GRADUATION_MORE_BATCH_SIZE});
  body.dataset.gradMoreLimit = String(Number(body.dataset.gradMoreLimit || ${GRADUATION_MORE_BATCH_SIZE}) + batch);
  updateMore(body);
});
syncChoices(false);
})();`;
}

function graduationCourseMatchKey(value: string): string {
  return academicCourseMatchKey(value);
}

function graduationCreditNumber(value: unknown, preferredLabel?: string): number | undefined {
  const direct = numberFrom(value);
  if (direct != null) return direct;
  if (Array.isArray(value)) {
    const rows = value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
    const preferred = preferredLabel
      ? rows.find((row) => stringFrom(row.label).replace(/\s+/g, "") === preferredLabel.replace(/\s+/g, ""))
      : undefined;
    const row = preferred ?? rows[0];
    return row ? graduationCreditNumber(row.credits ?? row.credit ?? row.value ?? row.rawValue) : undefined;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return graduationCreditNumber(record.credits ?? record.credit ?? record.value ?? record.rawValue);
  }
  return undefined;
}

function graduationRequirementSourcesFromData(d: {
  requirementSources?: GraduationRequirementSource[];
  graduationRequirementSources?: GraduationRequirementSource[];
  sources?: GraduationRequirementSource[];
  items?: GraduationRequirementSource[];
  query?: GraduationQueryContext;
  admissionYear?: unknown;
  studentNumber?: unknown;
  studentId?: unknown;
  studentNo?: unknown;
  학번?: unknown;
  studentType?: unknown;
  student_type?: unknown;
  studentCategory?: unknown;
  expectedGraduationTerm?: unknown;
  graduationTerm?: unknown;
}): GraduationRequirementSource[] {
  const candidates = [d.requirementSources, d.graduationRequirementSources, d.sources, d.items];
  const sources: GraduationRequirementSource[] = [];
  const seen = new Set<string>();
  for (const source of candidates) {
    if (Array.isArray(source) && source.some((item) => Array.isArray(item?.rules))) {
      for (const item of source) {
        if (!item || !Array.isArray(item.rules)) continue;
        const key = graduationRequirementSourceIdentity(item);
        if (seen.has(key)) continue;
        seen.add(key);
        sources.push(item);
      }
    }
  }
  return graduationFilterRequirementSourcesForContext(sources, d);
}

function graduationRequirementSourceIdentity(source: GraduationRequirementSource): string {
  return [
    stringFrom(source.id),
    graduationSourceUrl(source),
    graduationSourceTitle(source),
    stringFrom(source.department),
    stringFrom(source.admissionYear),
    JSON.stringify(source.rules ?? []),
  ].join("\u0000");
}

function graduationFilterRequirementSourcesForContext(
  sources: GraduationRequirementSource[],
  d: {
    query?: GraduationQueryContext;
    admissionYear?: unknown;
    studentNumber?: unknown;
    studentId?: unknown;
    studentNo?: unknown;
    학번?: unknown;
    studentType?: unknown;
    student_type?: unknown;
    studentCategory?: unknown;
    expectedGraduationTerm?: unknown;
    graduationTerm?: unknown;
  },
): GraduationRequirementSource[] {
  const admissionYear = graduationAdmissionYearFromData(d);
  const expectedGraduationTerm = graduationExpectedTermFromData(d);
  const studentType = graduationStudentTypeFromData(d);

  return graduationPreferLatestRulesForContext(
    sources
      .filter((source) => graduationSourceAppliesToContext(source, admissionYear))
      .map((source) => {
      const rules = (source.rules ?? [])
        .filter((rule) =>
          graduationRuleAppliesToContext(rule as GraduationRequirementRule, admissionYear, expectedGraduationTerm, studentType),
        )
        .map((rule) =>
          graduationRuleForContext(rule as GraduationRequirementRule, admissionYear, expectedGraduationTerm, studentType),
        )
        .filter((rule): rule is GraduationRequirementRule => Boolean(rule));
      return { ...source, rules };
    })
    .filter((source) => Array.isArray(source.rules) && source.rules.length > 0),
  );
}

function graduationRuleForContext(
  rule: GraduationRequirementRule,
  admissionYear: number | undefined,
  expectedGraduationTerm: string,
  studentType: "domestic" | "foreign",
): GraduationRequirementRule | undefined {
  if (!Array.isArray(rule.courseGroups)) return rule;
  const courseGroups = rule.courseGroups.filter((group) =>
    graduationCourseGroupAppliesToContext(group, admissionYear, expectedGraduationTerm, studentType),
  );
  if (!courseGroups.length && rule.courseGroups.length > 0 && !graduationRuleHasDirectPayload(rule)) {
    return undefined;
  }
  return { ...rule, courseGroups };
}

function graduationRuleHasDirectPayload(rule: GraduationRequirementRule): boolean {
  return graduationCreditNumber(rule.requiredCredits) != null
    || Boolean(rule.requiredCourseCodes?.length)
    || Boolean(rule.requiredCourseTitles?.length)
    || Boolean(rule.requiredCourses?.length)
    || Boolean(rule.missingCourses?.length)
    || Boolean(rule.completedCourses?.length)
    || Boolean(rule.satisfiedBy?.length)
    || rule.status === "unprovided";
}

function graduationAdmissionYearFromData(d: {
  query?: GraduationQueryContext;
  admissionYear?: unknown;
  studentNumber?: unknown;
  student_number?: unknown;
  studentId?: unknown;
  student_id?: unknown;
  studentNo?: unknown;
  student_no?: unknown;
  stdNo?: unknown;
  std_no?: unknown;
  hakbun?: unknown;
  학번?: unknown;
}): number | undefined {
  const query = d.query ?? {};
  const year = numberFrom(query.admissionYear ?? d.admissionYear);
  if (year != null && Number.isInteger(year) && year >= 2000 && year <= 2100) return year;
  return graduationAdmissionYearFromStudentNumber(graduationStudentNumberValue(query as Record<string, unknown>, d));
}

function graduationStudentNumberProvided(d: {
  query?: GraduationQueryContext;
  studentNumber?: unknown;
  student_number?: unknown;
  studentId?: unknown;
  student_id?: unknown;
  studentNo?: unknown;
  student_no?: unknown;
  stdNo?: unknown;
  std_no?: unknown;
  hakbun?: unknown;
  학번?: unknown;
  studentNumberProvided?: unknown;
}): boolean {
  const query = d.query ?? {};
  if (query.studentNumberProvided === true || d.studentNumberProvided === true) return true;
  return Boolean(graduationScalarText(graduationStudentNumberValue(query as Record<string, unknown>, d)));
}

function graduationAdmissionYearFromStudentNumber(value: unknown): number | undefined {
  const digits = graduationScalarText(value).replace(/\D/g, "");
  if (!digits) return undefined;
  const fourDigitYear = Number(digits.slice(0, 4));
  if (Number.isInteger(fourDigitYear) && fourDigitYear >= 2000 && fourDigitYear <= 2100) {
    return fourDigitYear;
  }
  const mjuStyle = digits.match(/^\d{2}([0-3]\d)\d{4,}$/);
  if (!mjuStyle) return undefined;
  const inferred = 2000 + Number(mjuStyle[1]);
  return inferred >= 2000 && inferred <= 2040 ? inferred : undefined;
}

function graduationExpectedTermFromData(d: {
  query?: GraduationQueryContext;
  expectedGraduationTerm?: unknown;
  graduationTerm?: unknown;
}): string {
  const query = d.query ?? {};
  return graduationScalarText(query.expectedGraduationTerm ?? query.graduationTerm)
    || graduationScalarText(d.expectedGraduationTerm ?? d.graduationTerm);
}

function graduationSourceAppliesToContext(
  source: GraduationRequirementSource,
  admissionYear: number | undefined,
): boolean {
  if (admissionYear == null) return true;
  const range = graduationSourceCohortRange(source);
  if (range) return graduationCohortRangeApplies(range, admissionYear);
  const sourceAdmissionYear = numberFrom(source.admissionYear);
  return sourceAdmissionYear == null || sourceAdmissionYear <= admissionYear;
}

function graduationSourceCohortRange(source: GraduationRequirementSource): { from?: number; to?: number } | null {
  return graduationCohortRangeFromText([
    source.department,
    source.sourceTitle,
    source.title,
  ].map(stringFrom).filter(Boolean).join(" "));
}

function graduationCohortRangeFromText(value: string): { from?: number; to?: number } | null {
  const range = value.match(/\b((?:19|20)\d{2})\s*[-~\u2013\u2014]\s*((?:19|20)\d{2})\b/u);
  if (range) {
    return {
      from: Number(range[1]),
      to: Number(range[2]),
    };
  }

  const openEnded = value.match(/\b((?:19|20)\d{2})\s*\+/u);
  return openEnded ? { from: Number(openEnded[1]) } : null;
}

function graduationCohortRangeApplies(
  range: { from?: number; to?: number },
  admissionYear: number,
): boolean {
  if (range.from != null && admissionYear < range.from) return false;
  if (range.to != null && admissionYear > range.to) return false;
  return true;
}

function graduationPreferLatestRulesForContext(
  sources: GraduationRequirementSource[],
): GraduationRequirementSource[] {
  const latestByRule = new Map<string, number>();
  for (const source of sources) {
    const sourceAdmissionYear = numberFrom(source.admissionYear);
    if (sourceAdmissionYear == null) continue;
    for (const rule of source.rules ?? []) {
      const key = graduationRuleCohortKey(source, rule as GraduationRequirementRule);
      if (!key) continue;
      const previous = latestByRule.get(key);
      if (previous == null || sourceAdmissionYear > previous) {
        latestByRule.set(key, sourceAdmissionYear);
      }
    }
  }

  return sources
    .map((source) => {
      const sourceAdmissionYear = numberFrom(source.admissionYear);
      const rules = (source.rules ?? []).filter((rule) => {
        if (sourceAdmissionYear == null) return true;
        const key = graduationRuleCohortKey(source, rule as GraduationRequirementRule);
        const latest = key ? latestByRule.get(key) : undefined;
        return latest == null || latest === sourceAdmissionYear;
      });
      return { ...source, rules };
    })
    .filter((source) => Array.isArray(source.rules) && source.rules.length > 0);
}

function graduationRuleCohortKey(source: GraduationRequirementSource, rule: GraduationRequirementRule): string {
  const sourceKey = graduationCourseMatchKey(stringFrom(source.department));
  const ruleKey = graduationCourseMatchKey(stringFrom(rule.category) || rule.label || rule.requirementKey || "");
  return sourceKey && ruleKey ? `${sourceKey}\u0000${ruleKey}` : "";
}

function graduationRuleAppliesToContext(
  rule: GraduationRequirementRule,
  admissionYear: number | undefined,
  expectedGraduationTerm: string,
  studentType: "domestic" | "foreign",
): boolean {
  return graduationAppliesToContext(rule.appliesTo ?? {}, admissionYear, expectedGraduationTerm, studentType);
}

function graduationCourseGroupAppliesToContext(
  group: GraduationRequirementCourseGroup,
  admissionYear: number | undefined,
  expectedGraduationTerm: string,
  studentType: "domestic" | "foreign",
): boolean {
  return graduationAppliesToContext(group.appliesTo ?? {}, admissionYear, expectedGraduationTerm, studentType);
}

function graduationAppliesToContext(
  appliesTo: Record<string, unknown>,
  admissionYear: number | undefined,
  expectedGraduationTerm: string,
  studentType: "domestic" | "foreign",
): boolean {
  if (!graduationAppliesToStudentType(appliesTo, studentType)) return false;

  if (admissionYear != null) {
    const admissionYearFrom = numberFrom(appliesTo.admissionYearFrom ?? appliesTo.admission_year_from);
    if (admissionYearFrom != null && admissionYear < admissionYearFrom) return false;
    const admissionYearTo = numberFrom(appliesTo.admissionYearTo ?? appliesTo.admission_year_to);
    if (admissionYearTo != null && admissionYear > admissionYearTo) return false;
  }

  const expectedRank = graduationTermRank(expectedGraduationTerm);
  if (expectedRank == null) return true;
  const graduationTermFrom = stringFrom(appliesTo.graduationTermFrom ?? appliesTo.graduation_term_from);
  const graduationTermFromRank = graduationTermRank(graduationTermFrom);
  if (graduationTermFromRank != null && expectedRank < graduationTermFromRank) return false;
  const graduationTermTo = stringFrom(appliesTo.graduationTermTo ?? appliesTo.graduation_term_to);
  const graduationTermToRank = graduationTermRank(graduationTermTo);
  if (graduationTermToRank != null && expectedRank > graduationTermToRank) return false;
  return true;
}

function graduationTermRank(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^((?:19|20)\d{2})-(0[1-9]|1[0-2])$/);
  return match ? Number(match[1]) * 100 + Number(match[2]) : undefined;
}

function graduationSourceTitle(source: GraduationRequirementSource): string {
  return stringFrom(source.sourceTitle ?? source.title) || "공식 졸업요건";
}

function graduationSourceUrl(source: GraduationRequirementSource): string {
  return stringFrom(source.sourceUrl ?? source.url);
}

function graduationRuleKey(rule: GraduationRequirementRule): string {
  return graduationCourseMatchKey(stringFrom(rule.category) || rule.label);
}

function graduationRuleCourses(
  rule: GraduationRequirementRule,
  source: GraduationRequirementSource,
): GraduationCourseRef[] {
  if (rule.status === "unprovided") return [];
  const direct = [
    ...(rule.requiredCourses ?? []),
    ...(rule.missingCourses ?? []),
  ];
  const grouped = graduationRuleCourseGroups(rule, source);
  const titles = Array.isArray(rule.requiredCourseTitles) ? rule.requiredCourseTitles : [];
  const codes = Array.isArray(rule.requiredCourseCodes) ? rule.requiredCourseCodes : [];
  const inferred = titles.map((title, index) => ({
    courseTitle: title,
    courseCode: codes[index],
    category: rule.category ?? rule.label,
    note: graduationRuleNote(rule, source),
    status: "missing",
  }));
  return [...direct, ...grouped, ...inferred];
}

function graduationRuleNote(rule: GraduationRequirementRule, source: GraduationRequirementSource): string {
  return [
    stringFrom(rule.programTrack),
    rule.minCourses != null ? `${rule.minCourses}개 과목` : "",
    rule.note || graduationSourceTitle(source),
  ].filter(Boolean).join(" · ");
}

function graduationRuleCourseGroups(
  rule: GraduationRequirementRule,
  source: GraduationRequirementSource,
): GraduationCourseRef[] {
  const groups = Array.isArray(rule.courseGroups) ? rule.courseGroups : [];
  return groups
    .map((group) => {
      const titles = Array.isArray(group.requiredCourseTitles) ? group.requiredCourseTitles.filter(Boolean) : [];
      const codes = Array.isArray(group.requiredCourseCodes) ? group.requiredCourseCodes.filter(Boolean) : [];
      const choices = titles.length ? titles.join(", ") : codes.join(", ");
      const label = stringFrom(group.label) || "세부 이수군";
      const name = choices ? `${label}: ${choices}` : label;
      return {
        courseTitle: name,
        category: rule.category ?? rule.label,
        credits: numberFrom(group.requiredCredits),
        note: graduationRuleGroupNote(rule, group, source),
        status: "missing",
        groupKey: group.groupKey,
        groupLabel: label,
        groupRequiredCourseCodes: codes,
        groupRequiredCourseTitles: titles,
        groupMinCourses: group.minCourses,
        groupType: group.groupType,
        alternativeGroup: group.alternativeGroup,
      };
    })
    .filter((course) => course.courseTitle);
}

function graduationRuleGroupNote(
  rule: GraduationRequirementRule,
  group: GraduationRequirementCourseGroup,
  source: GraduationRequirementSource,
): string {
  return [
    stringFrom(rule.programTrack),
    group.minCourses != null ? `택 ${group.minCourses}개` : "",
    stringFrom(group.groupType) === "alternative" ? "대체군" : "",
    stringFrom(group.note),
    rule.note || graduationSourceTitle(source),
  ].filter(Boolean).join(" · ");
}

function graduationSectionsFromRequirementSources(
  sources: GraduationRequirementSource[],
): GraduationRequirementSection[] {
  const sections = new Map<string, GraduationRequirementSection>();
  for (const source of sources) {
    for (const rawRule of source.rules ?? []) {
      const rule = rawRule as GraduationRequirementRule;
      if (!rule?.label) continue;
      const label = stringFrom(rule.category) || rule.label;
      const key = graduationCourseMatchKey(label);
      const required = graduationCreditNumber(rule.requiredCredits);
      const section = sections.get(key) ?? {
        label,
        earned: 0,
        required: required ?? 0,
        gap: required ?? 0,
        requiredCourses: [],
        sourceTitle: graduationSourceTitle(source),
        sourceUrl: graduationSourceUrl(source),
      };
      if (required != null && (!section.required || section.required < required)) {
        section.required = required;
        section.gap = required;
      }
      section.requiredCourses = [
        ...(section.requiredCourses ?? []),
        ...graduationRuleCourses(rule, source),
      ];
      if (rule.status === "unprovided") {
        section.detailCourses = [
          ...(section.detailCourses ?? []),
          {
            courseTitle: rule.label,
            category: label,
            note: graduationRuleNote(rule, source) || "공식 source에서 세부 기준 미제공",
            status: "unprovided",
          },
        ];
      }
      sections.set(key, section);
    }
  }
  return [...sections.values()];
}

function graduationCompletedCoursesFromData(d: { completedCourses?: GraduationCourseRef[] }): GraduationCourseRef[] {
  if (!Array.isArray(d.completedCourses)) return [];
  return d.completedCourses.map((course) => {
    if (typeof course === "string") return course;
    return { ...course, status: course.status || "completed" };
  });
}

function graduationCourseCredit(course: GraduationCourseRef): number {
  if (typeof course === "string") return 0;
  return graduationCreditNumber(course.credits ?? course.credit) ?? 0;
}

function graduationCourseCategory(course: GraduationCourseRef): string {
  return typeof course === "string" ? "" : stringFrom(course.category);
}

function graduationCourseLooksLikeLiberal(course: GraduationCourseRef): boolean {
  return /교양|liberal/i.test(graduationCourseCategory(course));
}

function graduationCourseMatchesSectionScore(course: GraduationCourseRef, section: GraduationRequirementSection): number {
  const categoryKey = graduationCourseMatchKey(graduationCourseCategory(course));
  const sectionKey = graduationCourseMatchKey(section.label);
  if (!categoryKey || !sectionKey) return 0;
  if (categoryKey === sectionKey) return 100;
  if (/^전공|major/i.test(graduationCourseCategory(course)) && /전공|major/i.test(section.label)) return 80;
  if (/교양|liberal/i.test(graduationCourseCategory(course)) && /교양학점|liberal credits/i.test(section.label)) return 40;
  if (/자유선택|free elective/i.test(section.label)) return 5;
  return 0;
}

function graduationBestRequiredSection(
  sections: GraduationRequirementSection[],
  predicate: (section: GraduationRequirementSection) => boolean,
): GraduationRequirementSection | undefined {
  return sections
    .filter(predicate)
    .sort((a, b) => (graduationCreditNumber(b.required) ?? 0) - (graduationCreditNumber(a.required) ?? 0))[0];
}

function graduationCappedSectionCredits(section: GraduationRequirementSection | undefined): number {
  if (!section) return 0;
  const earned = graduationCreditNumber(section.earned) ?? 0;
  const required = graduationCreditNumber(section.required);
  return required == null ? earned : Math.min(earned, required);
}

function graduationResidualFreeElectiveCredits(
  sections: GraduationRequirementSection[],
  completedCourses: GraduationCourseRef[],
): number {
  const totalSection = sections.find(graduationSectionLooksLikeTotal);
  const totalEarned = graduationCreditNumber(totalSection?.earned) ??
    completedCourses.reduce((sum, course) => sum + graduationCourseCredit(course), 0);
  if (!totalEarned) return 0;

  const majorSection = graduationBestRequiredSection(
    sections,
    (section) => !graduationFreeElectiveSection(section) && graduationMajorSection(section),
  );
  const liberalSection = sections.find(graduationSectionLooksLikeLiberalCreditRollup) ??
    graduationBestRequiredSection(
      sections,
      (section) => !graduationFreeElectiveSection(section) && /교양|liberal/i.test(section.label),
    );

  const allocated = graduationCappedSectionCredits(majorSection) +
    graduationCappedSectionCredits(liberalSection);
  return Math.max(0, totalEarned - allocated);
}

function graduationApplyCompletedCourses(
  creditGaps: GraduationRequirementSection[],
  completedCourses: GraduationCourseRef[],
): GraduationRequirementSection[] {
  if (!creditGaps.length) return creditGaps;

  // Graduation roadmap readers can provide official requirements and taken-course history
  // as separate top-level payloads. The view must merge them before rendering area cards.
  const sections = creditGaps.map((section) => ({
    ...section,
    completedCourses: [...(section.completedCourses ?? [])],
  }));
  const assignments = new Map<number, GraduationCourseRef[]>();

  if (completedCourses.length) {
    completedCourses.forEach((course) => {
      let bestIndex = -1;
      let bestScore = 0;
      sections.forEach((section, index) => {
        if (graduationSectionLooksLikeTotal(section)) return;
        const score = graduationCourseMatchesSectionScore(course, section);
        if (score > bestScore) {
          bestIndex = index;
          bestScore = score;
        }
      });
      if (bestIndex < 0 || bestScore <= 0) return;
      assignments.set(bestIndex, [...(assignments.get(bestIndex) ?? []), course]);
    });
  }

  sections.forEach((section, index) => {
    const completed = assignments.get(index) ?? [];
    if (completed.length) {
      section.completedCourses = graduationAppendUniqueCourses(section.completedCourses ?? [], completed);
      const completedCredits = completed.reduce((sum, course) => sum + graduationCourseCredit(course), 0);
      const currentEarned = graduationCreditNumber(section.earned) ?? 0;
      if (completedCredits > currentEarned) section.earned = completedCredits;
    }
    const required = graduationCreditNumber(section.required);
    const earned = graduationCreditNumber(section.earned);
    if (required != null && earned != null) section.gap = Math.max(0, required - earned);
  });

  const liberalCreditSection = sections.find(graduationSectionLooksLikeLiberalCreditRollup);
  if (liberalCreditSection) {
    const liberalCredits = completedCourses
      .filter(graduationCourseLooksLikeLiberal)
      .reduce((sum, course) => sum + graduationCourseCredit(course), 0);
    const currentEarned = graduationCreditNumber(liberalCreditSection.earned) ?? 0;
    if (liberalCredits > currentEarned) liberalCreditSection.earned = liberalCredits;
    const required = graduationCreditNumber(liberalCreditSection.required);
    const earned = graduationCreditNumber(liberalCreditSection.earned);
    if (required != null && earned != null) liberalCreditSection.gap = Math.max(0, required - earned);
  }

  const totalSection = sections.find(graduationSectionLooksLikeTotal);
  if (totalSection) {
    const totalCompletedCredits = completedCourses.reduce((sum, course) => sum + graduationCourseCredit(course), 0);
    const currentEarned = graduationCreditNumber(totalSection.earned) ?? 0;
    if (totalCompletedCredits > currentEarned) totalSection.earned = totalCompletedCredits;
    const required = graduationCreditNumber(totalSection.required);
    const earned = graduationCreditNumber(totalSection.earned);
    if (required != null && earned != null) totalSection.gap = Math.max(0, required - earned);
  }

  const freeElectiveSection = sections.find(graduationFreeElectiveSection);
  if (freeElectiveSection) {
    const residualCredits = graduationResidualFreeElectiveCredits(sections, completedCourses);
    const currentEarned = graduationCreditNumber(freeElectiveSection.earned) ?? 0;
    if (residualCredits > currentEarned) freeElectiveSection.earned = residualCredits;
    const required = graduationCreditNumber(freeElectiveSection.required);
    const earned = graduationCreditNumber(freeElectiveSection.earned);
    if (required != null && earned != null) freeElectiveSection.gap = Math.max(0, required - earned);
  }

  return sections;
}

function mergeGraduationRequirementSources(
  creditGaps: GraduationRequirementSection[],
  sources: GraduationRequirementSource[],
): GraduationRequirementSection[] {
  if (!sources.length) return creditGaps;
  if (!creditGaps.length) return graduationSectionsFromRequirementSources(sources);

  const sections = creditGaps.map((section) => ({
    ...section,
    requiredCourses: [...(section.requiredCourses ?? [])],
    missingCourses: [...(section.missingCourses ?? [])],
    detailCourses: [...(section.detailCourses ?? [])],
  }));
  const byKey = new Map(sections.map((section) => [graduationCourseMatchKey(section.label), section]));

  for (const source of sources) {
    for (const rawRule of source.rules ?? []) {
      const rule = rawRule as GraduationRequirementRule;
      if (!rule?.label) continue;
      if (/총|최소/.test(rule.label) && !byKey.has(graduationRuleKey(rule))) continue;
      const key = graduationRuleKey(rule);
      const section = byKey.get(key);
      if (!section) continue;
      const required = graduationCreditNumber(rule.requiredCredits);
      if (required != null && !graduationCreditNumber(section.required)) {
        section.required = required;
      }
      section.requiredCourses = [
        ...(section.requiredCourses ?? []),
        ...graduationRuleCourses(rule, source),
      ];
      section.sourceTitle = section.sourceTitle || graduationSourceTitle(source);
      section.sourceUrl = section.sourceUrl || graduationSourceUrl(source);
    }
  }

  return sections;
}

function normalizeGraduationChapelSections(
  creditGaps: GraduationRequirementSection[],
): GraduationRequirementSection[] {
  const chapelIndex = creditGaps.findIndex(graduationChapelCountSection);
  if (chapelIndex < 0) return creditGaps;

  const sections = creditGaps.map((section) => ({
    ...section,
    detailCourses: [...(section.detailCourses ?? [])],
    completedCourses: [...(section.completedCourses ?? [])],
    completedRequiredCourses: [...(section.completedRequiredCourses ?? [])],
    requiredCourses: [...(section.requiredCourses ?? [])],
  }));
  const chapelSection = sections[chapelIndex];
  const movedDetails: GraduationCourseRef[] = [];
  const movedRequired: GraduationCourseRef[] = [];

  for (const section of sections) {
    if (section === chapelSection) continue;
    const detailPartition = graduationPartitionCourses(section.detailCourses ?? [], graduationCourseRefLooksLikeChapel);
    section.detailCourses = detailPartition.keep;
    movedDetails.push(...detailPartition.move);

    const completedPartition = graduationPartitionCourses(section.completedCourses ?? [], graduationCourseRefLooksLikeChapel);
    section.completedCourses = completedPartition.keep;
    movedDetails.push(...completedPartition.move);

    const completedRequiredPartition = graduationPartitionCourses(section.completedRequiredCourses ?? [], graduationCourseRefLooksLikeChapel);
    section.completedRequiredCourses = completedRequiredPartition.keep;
    movedDetails.push(...completedRequiredPartition.move);

    const requiredPartition = graduationPartitionCourses(section.requiredCourses ?? [], graduationCourseRefLooksLikeChapel);
    section.requiredCourses = requiredPartition.keep;
    movedRequired.push(...requiredPartition.move);
  }

  chapelSection.detailCourses = graduationAppendUniqueCourses(chapelSection.detailCourses ?? [], movedDetails);
  chapelSection.requiredCourses = graduationAppendUniqueCourses(chapelSection.requiredCourses ?? [], movedRequired);
  return sections;
}

function graduationChapelCountSection(section: GraduationRequirementSection): boolean {
  return /채플|chapel/i.test(section.label) && /횟수|이수|count|chapel/i.test(section.label);
}

function graduationCourseRefLooksLikeChapel(course: GraduationCourseRef): boolean {
  const values = typeof course === "string"
    ? [course]
    : [
      course.courseTitle,
      course.title,
      course.courseCode,
      course.code,
      course.category,
      course.groupLabel,
      ...(course.groupRequiredCourseTitles ?? []),
      ...(course.groupRequiredCourseCodes ?? []),
    ];
  return values.map(stringFrom).some((value) => /채플|chapel/i.test(value));
}

function graduationPartitionCourses(
  courses: GraduationCourseRef[],
  predicate: (course: GraduationCourseRef) => boolean,
): { keep: GraduationCourseRef[]; move: GraduationCourseRef[] } {
  const keep: GraduationCourseRef[] = [];
  const move: GraduationCourseRef[] = [];
  for (const course of courses) {
    (predicate(course) ? move : keep).push(course);
  }
  return { keep, move };
}

function graduationAppendUniqueCourses(
  base: GraduationCourseRef[],
  additions: GraduationCourseRef[],
): GraduationCourseRef[] {
  const seen = new Set(base.map(graduationCourseRefIdentity));
  const result = [...base];
  for (const course of additions) {
    const key = graduationCourseRefIdentity(course);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(course);
  }
  return result;
}

function graduationCourseRefIdentity(course: GraduationCourseRef): string {
  if (typeof course === "string") return `string:${graduationCourseMatchKey(course)}`;
  return [
    graduationCourseMatchKey(stringFrom(course.courseCode ?? course.code)),
    graduationCourseMatchKey(stringFrom(course.courseTitle ?? course.title)),
    graduationCourseMatchKey(stringFrom(course.note)),
    graduationCourseMatchKey(stringFrom(course.termLabel ?? course.semesterLabel ?? course.completedTermLabel ?? course.takenTermLabel)),
    stringFrom(course.year ?? course.academicYear),
  ].join(":");
}

function graduationTotalSection(creditGaps: GraduationRequirementSection[]): GraduationRequirementSection | undefined {
  return creditGaps.find((section) => /총|최소/.test(section.label));
}

function graduationSectionLooksLikeTotal(section: GraduationRequirementSection): boolean {
  return section === graduationTotalSection([section]) || /총|최소|total/i.test(section.label);
}

function graduationSectionLooksLikeLiberalCreditRollup(section: GraduationRequirementSection): boolean {
  return /교양학점|liberal credits/i.test(section.label);
}

function renderGraduation(data: unknown): string {
  const d = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as {
    creditGaps?: GraduationRequirementSection[];
    department?: string;
    admissionYear?: number | string;
    studentType?: unknown;
    student_type?: unknown;
    studentCategory?: unknown;
    expectedGraduationTerm?: string;
    graduationTerm?: string;
    query?: GraduationQueryContext;
    requirements?: GraduationRequirementRule[];
    graduationRequirements?: GraduationRequirementRule[];
    requirementSources?: GraduationRequirementSource[];
    sources?: GraduationRequirementSource[];
    items?: GraduationRequirementSource[];
    requiredCourses?: GraduationCourseRef[];
    missingRequiredCourses?: GraduationCourseRef[];
    completedRequiredCourses?: GraduationCourseRef[];
    completedCourses?: GraduationCourseRef[];
    overall?: { earned?: unknown; required?: unknown; pct?: unknown };
  };
  const choiceGroups = normalizeRequirementChoiceGroups(d as Record<string, unknown>, "graduation");
  const selectedChoiceKeys = selectedRequirementChoices(d as Record<string, unknown>, "graduation");
  const requirementSources = graduationRequirementSourcesFromData(d);
  const rawCreditGaps = Array.isArray(d.creditGaps) ? d.creditGaps : [];
  if (!rawCreditGaps.length && !requirementSources.length) {
    return renderGraduationUnavailable(d);
  }

  const queryMeta = graduationQueryMeta(graduationQueryContext(d, requirementSources));
  const mergedCreditGaps = mergeGraduationRequirementSources(rawCreditGaps, requirementSources);
  const creditGaps = normalizeGraduationChapelSections(
    graduationApplyCompletedCourses(mergedCreditGaps, graduationCompletedCoursesFromData(d)),
  );
  const totalSection = creditGaps.find(graduationSectionLooksLikeTotal);
  const rollupSections = totalSection ? creditGaps.filter((section) => section !== totalSection) : creditGaps;
  const totalEarned = graduationCreditNumber(d.overall?.earned, "총 취득학점") ?? graduationCreditNumber(totalSection?.earned) ?? rollupSections.reduce((a, g) => a + (graduationCreditNumber(g.earned) ?? 0), 0);
  const totalReq = graduationCreditNumber(d.overall?.required, "총 취득학점") ?? graduationCreditNumber(totalSection?.required) ?? rollupSections.reduce((a, g) => a + (graduationCreditNumber(g.required) ?? 0), 0);
  const rawPct = graduationCreditNumber(d.overall?.pct) ?? (totalReq > 0 ? Math.round((totalEarned / totalReq) * 100) : 0);
  const pct = graduationPercent(rawPct);
  const doneCount = creditGaps.filter((g) => graduationGap(g) === 0).length;
  const shortageItems = creditGaps.filter((g) => graduationGap(g) > 0);

  // Hero ring
  const size = 128, stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);

  let html = `<section class="section"><div class="grad-hero">`;
  html += `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/><circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${dash} ${c - dash}"/></svg><div class="ring-text"><div class="ring-pct">${pct}<span class="u">%</span></div><div class="ring-cap">완료</div></div></div>`;
  html += `<div style="flex:1;min-width:0"><div class="metric-label">총 취득 학점</div><div class="metric-value" style="font-size:26px;margin-top:4px">${totalEarned}<span class="unit"> / ${totalReq}</span></div><div class="metric-trend" style="margin-top:8px">남은 <strong style="color:var(--ink);font-weight:600">${Math.max(0, totalReq - totalEarned)}학점</strong></div>${queryMeta ? `<div class="section-sub" style="margin-top:8px;margin-bottom:0">${queryMeta}</div>` : ""}</div>`;
  html += `</div></section>`;
  html += renderGraduationChoiceSection(choiceGroups, selectedChoiceKeys);

  if (shortageItems.length) {
    html += `<section class="section"><div class="section-title"><h2>부족한 요건<span class="count">${shortageItems.length}</span></h2></div><div class="section-sub">총 취득 학점 아래에서 먼저 확인할 항목이에요.</div><div class="grad-shortage-list">`;
    for (const g of shortageItems) {
      const earned = graduationCreditNumber(g.earned) ?? 0;
      const required = graduationCreditNumber(g.required) ?? 0;
      const gap = graduationGap(g);
      html += `<article class="grad-shortage-row"><div><div class="grad-shortage-title">${esc(g.label)}</div><div class="grad-shortage-meta">${earned} / ${required} 학점</div></div><div class="grad-shortage-gap">${gap}학점 부족</div></article>`;
    }
    html += `</div></section>`;
  }

  html += renderGraduationAreaAccordion(creditGaps, doneCount, choiceGroups, selectedChoiceKeys);
  html += renderGraduationSourceSummary(d, requirementSources);

  return html;
}

function graduationGap(item: { earned?: unknown; required?: unknown; gap?: unknown }): number {
  const gap = graduationCreditNumber(item.gap);
  if (gap != null) return Math.max(0, gap);
  const required = graduationCreditNumber(item.required) ?? 0;
  const earned = graduationCreditNumber(item.earned) ?? 0;
  return Math.max(0, required - earned);
}

function graduationPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
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
  { key: "welfare", label: "복지동", aliases: ["welfare", "welfare-building", "복지동"] },
  { key: "bangmok", label: "방목기념관", aliases: ["bangmok", "bangmok-cafeteria", "방목기념관", "방목관", "교직원", "교직원식당", "직원식당"] },
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
