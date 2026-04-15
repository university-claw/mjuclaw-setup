import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";
import type { ViewEntry } from "./types";

export function renderViewHtml(entry: ViewEntry): string {
  const dataHtml = renderData(entry.dataType, entry.rawData);
  const aiSummaryHtml = renderMarkdown(entry.aiResponse);
  const time = new Date(entry.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(entry.title)}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; padding: 16px; }
.wrap { max-width: 500px; margin: 0 auto; }
.header { text-align: center; padding: 16px 0; }
.header h1 { font-size: 18px; color: #1a1a1a; margin-top: 8px; }
.card { background: #fff; border-radius: 14px; box-shadow: 0 1px 8px rgba(0,0,0,0.06); padding: 20px; margin-bottom: 12px; }
.card-title { font-size: 14px; font-weight: 600; color: #3B82F6; margin-bottom: 10px; }
.ai-text { font-size: 14px; line-height: 1.7; color: #333; word-break: break-word; }
.ai-text p { margin-bottom: 8px; }
.ai-text ul, .ai-text ol { padding-left: 18px; margin-bottom: 8px; }
.ai-text li { margin-bottom: 4px; }
.ai-text strong { font-weight: 600; }
.ai-text h1, .ai-text h2, .ai-text h3 { font-size: 15px; font-weight: 600; margin-bottom: 6px; margin-top: 12px; }
.ai-text hr { border: none; border-top: 1px solid #eee; margin: 10px 0; }
.section { margin-bottom: 16px; }
.section-title { font-size: 13px; font-weight: 600; color: #666; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
.item { padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
.item:last-child { border-bottom: none; }
.item-title { font-size: 14px; font-weight: 500; color: #1a1a1a; }
.item-sub { font-size: 12px; color: #888; margin-top: 2px; }
.badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
.badge-red { background: #FEE2E2; color: #DC2626; }
.badge-yellow { background: #FEF9C3; color: #A16207; }
.badge-green { background: #DCFCE7; color: #16A34A; }
.badge-blue { background: #DBEAFE; color: #2563EB; }
.badge-gray { background: #F3F4F6; color: #6B7280; }
.day-group { margin-bottom: 14px; }
.day-label { font-size: 13px; font-weight: 600; color: #3B82F6; margin-bottom: 6px; }
.progress-wrap { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.progress-bar { flex: 1; height: 8px; background: #E5E7EB; border-radius: 4px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 4px; }
.progress-text { font-size: 12px; color: #666; min-width: 60px; text-align: right; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; font-weight: 500; color: #888; padding: 6px 8px; border-bottom: 2px solid #eee; }
td { padding: 8px; border-bottom: 1px solid #f0f0f0; color: #333; }
.footer { text-align: center; font-size: 11px; color: #aaa; padding: 16px 0; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>${esc(entry.title)}</h1>
  </div>
  <div class="card">
    <div class="card-title">AI 요약</div>
    <div class="ai-text">${aiSummaryHtml}</div>
  </div>
  ${dataHtml}
  <div class="footer">${esc(time)} 조회 · 30분 후 만료</div>
</div>
</body>
</html>`;
}

export function renderExpiredHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>만료됨</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
.card { background: #fff; border-radius: 14px; box-shadow: 0 1px 8px rgba(0,0,0,0.06); padding: 32px 24px; text-align: center; max-width: 400px; }
.icon { font-size: 48px; margin-bottom: 12px; }
.title { font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px; }
.desc { font-size: 14px; color: #888; line-height: 1.6; }
</style>
</head>
<body>
<div class="card">
  <div class="icon">⏳</div>
  <div class="title">데이터가 만료되었습니다</div>
  <div class="desc">Discord에서 다시 조회해주세요</div>
</div>
</body>
</html>`;
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

  let html = `<div class="card"><div class="card-title">상세 시간표</div>`;
  for (const day of days) {
    const entries = byDay.get(day);
    if (!entries) continue;
    entries.sort((a, b) => (a.timeRange || "").localeCompare(b.timeRange || ""));
    html += `<div class="day-group"><div class="day-label">${day}요일</div>`;
    for (const e of entries) {
      html += `<div class="item"><div class="item-title">${esc(e.courseTitle)}</div><div class="item-sub">${esc(e.timeRange || "")} · ${esc(e.location || "")}${e.professor ? ` · ${esc(e.professor)}` : ""}</div></div>`;
    }
    html += `</div>`;
  }
  return html + `</div>`;
}

// ── 성적 ────────────────────────────────────────────────────────

function renderGrades(data: unknown): string {
  const d = data as { items?: Array<{ courseTitle: string; credits?: number; grade?: string; statusMessage?: string }> };
  if (!d.items?.length) return "";

  let html = `<div class="card"><div class="card-title">성적 상세</div><table><tr><th>과목</th><th>학점</th><th>성적</th></tr>`;
  for (const item of d.items) {
    const grade = item.grade || item.statusMessage || "-";
    html += `<tr><td>${esc(item.courseTitle)}</td><td>${item.credits ?? "-"}</td><td>${esc(grade)}</td></tr>`;
  }
  return html + `</table></div>`;
}

// ── 졸업요건 ────────────────────────────────────────────────────

function renderGraduation(data: unknown): string {
  const d = data as { creditGaps?: Array<{ label: string; earned?: number; required?: number; gap?: number }> };
  if (!d.creditGaps?.length) return "";

  let html = `<div class="card"><div class="card-title">졸업요건 상세</div>`;
  for (const g of d.creditGaps) {
    const earned = g.earned ?? 0;
    const required = g.required ?? 1;
    const pct = Math.min(100, Math.round((earned / required) * 100));
    const color = (g.gap ?? 0) > 0 ? "#EF4444" : "#22C55E";
    const badgeCls = (g.gap ?? 0) > 0 ? "badge-red" : "badge-green";
    html += `<div class="item">
      <div class="item-title">${esc(g.label)} <span class="badge ${badgeCls}">${(g.gap ?? 0) > 0 ? `부족 ${g.gap}` : "충족"}</span></div>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="progress-text">${earned} / ${required}</div>
      </div>
    </div>`;
  }
  return html + `</div>`;
}

// ── 수강과목 ────────────────────────────────────────────────────

function renderCourses(data: unknown): string {
  const d = data as { courses?: Array<{ title: string; professor?: string; code?: string }> };
  if (!d.courses?.length) return "";

  let html = `<div class="card"><div class="card-title">수강과목 (${d.courses.length}개)</div>`;
  for (const c of d.courses) {
    html += `<div class="item"><div class="item-title">${esc(c.title)}</div><div class="item-sub">${esc(c.professor || "")}${c.code ? ` · ${esc(c.code)}` : ""}</div></div>`;
  }
  return html + `</div>`;
}

// ── 할 일 목록 ──────────────────────────────────────────────────

function renderActionItems(data: unknown): string {
  const d = data as Record<string, unknown>;
  let html = "";

  const unsub = d.unsubmittedAssignments as AssignmentItem[] | undefined;
  if (unsub?.length) {
    html += `<div class="card"><div class="card-title">미제출 과제 (${unsub.length}건)</div>`;
    for (const a of unsub) {
      const expired = a.isExpired === true || a.statusLabel === "마감";
      const badgeCls = expired ? "badge-red" : "badge-yellow";
      const badgeText = a.statusLabel || (expired ? "만료" : "진행중");
      const dueLabel = a.dueLabel || a.dueAt || a.statusText || "";
      const sub = [a.courseTitle, a.weekLabel, dueLabel].filter(Boolean).join(" · ");
      html += `<div class="item"><div class="item-title">${esc(a.title || "")} <span class="badge ${badgeCls}">${esc(badgeText)}</span></div><div class="item-sub">${esc(sub)}</div></div>`;
    }
    html += `</div>`;
  }

  const due = d.dueAssignments as AssignmentItem[] | undefined;
  if (due?.length) {
    html += `<div class="card"><div class="card-title">마감 임박 (${due.length}건)</div>`;
    for (const a of due) {
      const dueLabel = a.dueLabel || a.dueAt || a.statusText || "";
      const sub = [a.courseTitle, a.weekLabel, dueLabel].filter(Boolean).join(" · ");
      html += `<div class="item"><div class="item-title">${esc(a.title || "")}</div><div class="item-sub">${esc(sub)}</div></div>`;
    }
    html += `</div>`;
  }

  const notices = d.unreadNotices as NoticeItem[] | undefined;
  if (notices?.length) {
    html += `<div class="card"><div class="card-title">안읽은 공지 (${notices.length}건)</div>`;
    for (const n of notices) {
      const sub = [n.courseTitle, n.postedAt].filter(Boolean).join(" · ");
      html += `<div class="item"><div class="item-title">${esc(n.title || "")}</div><div class="item-sub">${esc(sub)}</div></div>`;
    }
    html += `</div>`;
  }

  const online = d.incompleteOnlineWeeks as Array<{ courseTitle?: string; weekLabel?: string; lectureTitle?: string }> | undefined;
  if (online?.length) {
    html += `<div class="card"><div class="card-title">미수강 온라인 (${online.length}건)</div>`;
    for (const o of online) {
      const sub = [o.courseTitle, o.weekLabel].filter(Boolean).join(" · ");
      html += `<div class="item"><div class="item-title">${esc(o.lectureTitle || o.weekLabel || "")}</div><div class="item-sub">${esc(sub)}</div></div>`;
    }
    html += `</div>`;
  }

  return html;
}

// ── 과제 리스트 ─────────────────────────────────────────────────

function renderAssignmentList(data: unknown): string {
  // mju-cli는 +unsubmitted → {assignments: [...]}, +due-assignments → {assignments: [...]}, items도 지원
  const items: AssignmentItem[] = Array.isArray(data)
    ? (data as AssignmentItem[])
    : ((data as { assignments?: AssignmentItem[]; items?: AssignmentItem[] }).assignments
        || (data as { items?: AssignmentItem[] }).items
        || []);
  if (!items.length) return "";

  let html = `<div class="card"><div class="card-title">과제 상세 (${items.length}건)</div>`;
  for (const a of items) {
    // 마감/만료 여부: statusLabel이 "마감"이거나 isExpired가 true
    const expired = a.isExpired === true || a.statusLabel === "마감";
    const badgeCls = expired ? "badge-red" : "badge-yellow";
    const badgeText = a.statusLabel || (expired ? "만료" : "진행중");
    const dueLabel = a.dueLabel || a.dueAt || a.statusText || "";
    const sub = [a.courseTitle, a.weekLabel, dueLabel].filter(Boolean).join(" · ");
    html += `<div class="item"><div class="item-title">${esc(a.title || "")} <span class="badge ${badgeCls}">${esc(badgeText)}</span></div><div class="item-sub">${esc(sub)}</div></div>`;
  }
  return html + `</div>`;
}

// ── 공지 리스트 ─────────────────────────────────────────────────

function renderNoticeList(data: unknown): string {
  // +unread-notices → {notices: [...]}, items도 지원
  const items: NoticeItem[] = Array.isArray(data)
    ? (data as NoticeItem[])
    : ((data as { notices?: NoticeItem[]; items?: NoticeItem[] }).notices
        || (data as { items?: NoticeItem[] }).items
        || []);
  if (!items.length) return "";

  let html = `<div class="card"><div class="card-title">공지 상세 (${items.length}건)</div>`;
  for (const n of items) {
    const sub = [n.courseTitle, n.postedAt].filter(Boolean).join(" · ");
    html += `<div class="item"><div class="item-title">${esc(n.title || "")}</div><div class="item-sub">${esc(sub)}</div>`;
    if (n.previewText) {
      html += `<div class="item-sub" style="margin-top:4px;color:#666;">${esc(n.previewText.slice(0, 200))}</div>`;
    }
    html += `</div>`;
  }
  return html + `</div>`;
}

// ── 학교 공지 (mju-news) ────────────────────────────────────────

const NEWS_SOURCE_LABEL: Record<string, string> = {
  general: "일반공지",
  scholarship: "장학공지",
  event: "행사공지",
  career: "진로/취업공지",
};

function renderNewsList(data: unknown): string {
  const d = data as { items?: Array<{ title: string; url: string; source: string; postedAt?: string; author?: string }> };
  if (!d.items?.length) return "";

  let html = `<div class="card"><div class="card-title">학교 공지 (${d.items.length}건)</div>`;
  for (const n of d.items) {
    const label = NEWS_SOURCE_LABEL[n.source] || n.source;
    const dateLabel = n.postedAt ? new Date(n.postedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "";
    const meta = [label, dateLabel, n.author].filter(Boolean).join(" · ");
    html += `<div class="item"><div class="item-title"><a href="${esc(n.url)}" target="_blank" rel="noopener" style="color:#1a1a1a;text-decoration:none;">${esc(n.title)}</a></div><div class="item-sub">${esc(meta)}</div></div>`;
  }
  return html + `</div>`;
}

// ── 출석 ────────────────────────────────────────────────────────

// ucheck가 반환하는 attendance JSON을 예쁘게 렌더링 (과거 카카오 호환으로 문자열도 지원)
function renderAttendanceText(data: unknown): string {
  if (typeof data === "string") {
    return `<div class="card"><div class="card-title">출석 상세</div><div class="ai-text">${esc(data)}</div></div>`;
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
    html += `<div class="card"><div class="card-title">${esc(c.courseTitle || "출석")}</div>`;
    if (c.professor) html += `<div class="item-sub">${esc(c.professor)} 교수</div>`;
    if (c.scheduleSummary) {
      const sched = c.scheduleSummary.split("\n").map((s) => esc(s)).join("<br>");
      html += `<div class="item-sub" style="margin-top:6px;">${sched}</div>`;
    }
    html += `</div>`;
  }

  // 요약 배지
  if (d.summary) {
    const s = d.summary;
    const total = d.completedSessions ?? 0;
    html += `<div class="card"><div class="card-title">요약</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span class="badge badge-blue">진행 ${total}회</span>
        <span class="badge badge-green">출석 ${s.attendedCount ?? 0}</span>`;
    if ((s.tardyCount ?? 0) > 0) html += `<span class="badge badge-yellow">지각 ${s.tardyCount}</span>`;
    if ((s.earlyLeaveCount ?? 0) > 0) html += `<span class="badge badge-yellow">조퇴 ${s.earlyLeaveCount}</span>`;
    if ((s.absentCount ?? 0) > 0) html += `<span class="badge badge-red">결석 ${s.absentCount}</span>`;
    html += `</div></div>`;
  }

  // 세션 테이블
  if (d.sessions && d.sessions.length > 0) {
    html += `<div class="card"><div class="card-title">세션별 출석</div>`;
    html += `<table><tr><th>주차</th><th>날짜</th><th>시간</th><th>상태</th><th>입실</th></tr>`;
    // 지난 세션만, 날짜 내림차순 (최근 먼저)
    const past = d.sessions.filter((s) => s.isPast).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    for (const s of past) {
      const status = s.statusLabel || "-";
      let badgeCls = "badge-gray";
      if (status === "출석") badgeCls = "badge-green";
      else if (status === "결석") badgeCls = "badge-red";
      else if (status === "지각" || status === "조퇴") badgeCls = "badge-yellow";
      html += `<tr>
        <td>${esc(s.sessionLabel || "-")}</td>
        <td>${esc(s.dateLabel || s.date || "-")}</td>
        <td>${esc(s.timeRange || "-")}</td>
        <td><span class="badge ${badgeCls}">${esc(status)}</span></td>
        <td>${esc(s.attendAt || "-")}</td>
      </tr>`;
    }
    html += `</table></div>`;

    // 예정된 세션
    const upcoming = d.sessions.filter((s) => !s.isPast).slice(0, 5);
    if (upcoming.length > 0) {
      html += `<div class="card"><div class="card-title">다가오는 수업</div>`;
      for (const s of upcoming) {
        html += `<div class="item"><div class="item-title">${esc(s.dateLabel || s.date || "")} · ${esc(s.timeRange || "")}</div>`;
        if (s.classroom) html += `<div class="item-sub">${esc(s.classroom)}</div>`;
        html += `</div>`;
      }
      html += `</div>`;
    }
  }

  return html || renderGeneric(data);
}

// ── 기본 (JSON) ─────────────────────────────────────────────────

function renderGeneric(data: unknown): string {
  const json = JSON.stringify(data, null, 2);
  return `<div class="card"><div class="card-title">원본 데이터</div><pre style="font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;color:#333;">${esc(json)}</pre></div>`;
}

function renderMarkdown(markdown: string): string {
  const rendered = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(rendered);
}

// ── HTML 이스케이프 ─────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
