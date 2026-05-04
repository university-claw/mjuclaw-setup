const assert = require("node:assert/strict");
const test = require("node:test");
const { renderViewHtml } = require("../dist/view-renderer.js");

function dueAtInKorea(dayOffset, time) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const base = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day));
  const date = new Date(base + dayOffset * 24 * 60 * 60 * 1000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}T${time}+09:00`;
}

function unsubmittedEntry() {
  return {
    id: "unsubmitted-test-view",
    dataType: "unsubmitted",
    title: "Unsubmitted Assignments",
    summary: "",
    aiResponse: "**SHOULD_NOT_RENDER_UNSUBMITTED_AI**",
    createdAt: new Date("2026-05-03T09:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-03T09:30:00.000Z").getTime(),
    rawData: {
      assignments: [
        {
          title: "Final project plan",
          courseTitle: "Capstone Design",
          weekLabel: "Week 13",
          dueLabel: "Today 23:59",
          priority: "high",
        },
        {
          title: "Case review note",
          courseTitle: "Constitutional Law",
          weekLabel: "Week 12",
          dueLabel: "Tomorrow 18:00",
          dueAt: dueAtInKorea(1, "18:00:00"),
        },
        {
          title: "Midterm replacement report",
          courseTitle: "Administrative Law",
          weekLabel: "Week 10",
          dueLabel: "Tomorrow 23:59",
          dueAt: dueAtInKorea(1, "23:59:00"),
        },
        {
          title: "Discussion post",
          courseTitle: "Civil Law",
          weekLabel: "Week 13",
          dueLabel: "May 5",
          dueAt: dueAtInKorea(2, "23:59:00"),
        },
        {
          title: "Lab report revision",
          courseTitle: "Database",
          weekLabel: "Week 11",
          dueLabel: "May 6",
          dueAt: dueAtInKorea(3, "23:59:00"),
        },
      ],
    },
  };
}

test("unsubmitted renders status briefing and deadline groups while preserving assignment rows", () => {
  const html = renderViewHtml(unsubmittedEntry());
  const bodyHtml = html.slice(html.indexOf("</style>"));

  const summaryIndex = bodyHtml.indexOf('class="unsubmitted-summary unsubmitted-band"');
  const todayIndex = bodyHtml.indexOf("<h2>오늘");
  const tomorrowIndex = bodyHtml.indexOf("<h2>내일");
  const weekIndex = bodyHtml.indexOf("<h2>이번 주");
  const firstAssignmentIndex = bodyHtml.indexOf("Final project plan");
  const caseReviewIndex = bodyHtml.indexOf("Case review note");
  const midtermIndex = bodyHtml.indexOf("Midterm replacement report");
  const discussionIndex = bodyHtml.indexOf("Discussion post");
  const labIndex = bodyHtml.indexOf("Lab report revision");

  assert.ok(summaryIndex >= 0, "status briefing band should render above the assignment list");
  assert.ok(todayIndex > summaryIndex, "today group should follow the status briefing");
  assert.ok(tomorrowIndex > todayIndex, "tomorrow group should follow today's assignments");
  assert.ok(weekIndex > tomorrowIndex, "this-week group should follow tomorrow's assignments");
  assert.ok(firstAssignmentIndex > todayIndex && firstAssignmentIndex < tomorrowIndex, "today assignment should be grouped under today");
  assert.ok(caseReviewIndex > tomorrowIndex && caseReviewIndex < weekIndex, "tomorrow assignment should be grouped under tomorrow");
  assert.ok(caseReviewIndex < midtermIndex, "tomorrow assignments should be sorted by deadline");
  assert.ok(discussionIndex > weekIndex && discussionIndex < labIndex, "this-week assignments should remain in deadline order");
  assert.match(bodyHtml, /미제출 5개/);
  assert.match(bodyHtml, /오늘 마감 1개/);
  assert.match(bodyHtml, /가장 임박/);
  assert.match(bodyHtml, /가까운 마감일부터 정리했어요/);
  assert.match(bodyHtml, /class="unsubmitted-band-main"/);
  assert.match(bodyHtml, /class="row assignment-row/);
});

test("unsubmitted omits the generic AI summary even when an AI response exists", () => {
  const html = renderViewHtml(unsubmittedEntry());

  assert.doesNotMatch(html, /class="briefing/);
  assert.doesNotMatch(html, /AI 요약/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER_UNSUBMITTED_AI/);
});
