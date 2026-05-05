const assert = require("node:assert/strict");
const test = require("node:test");
const { renderViewHtml } = require("../dist/view-renderer.js");

function actionItemsEntry() {
  return {
    id: "action-items-test-view",
    dataType: "action-items",
    title: "Action Items",
    summary: "",
    aiResponse: "**SHOULD_NOT_RENDER_ACTION_ITEMS_AI**",
    createdAt: new Date("2026-05-03T08:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-03T08:30:00.000Z").getTime(),
    rawData: {
      unsubmittedAssignments: [
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
          dueAt: "2026-05-04T18:00:00+09:00",
        },
        {
          title: "Lab report revision",
          courseTitle: "Database",
          weekLabel: "Week 11",
          dueLabel: "May 6",
          dueAt: "2026-05-06T23:59:00+09:00",
        },
      ],
      dueAssignments: [
        {
          title: "Discussion post",
          courseTitle: "Civil Law",
          weekLabel: "Week 13",
          dueLabel: "May 5",
          dueAt: "2026-05-05T23:59:00+09:00",
        },
      ],
      unreadNotices: [
        {
          title: "Final exam scope notice",
          courseTitle: "Constitutional Law",
          postedAt: "Today",
        },
      ],
      incompleteOnlineWeeks: [
        {
          courseTitle: "Introduction to Law",
          weekLabel: "Week 12",
          lectureTitle: "Contract liability lecture",
          dueLabel: "Today 20:00",
        },
        {
          courseTitle: "Introduction to Law",
          weekLabel: "Week 13",
          lectureTitle: "Tort summary",
          dueLabel: "May 6",
          dueAt: "2026-05-06T23:59:00+09:00",
        },
      ],
    },
  };
}

test("action-items renders a next action followed by urgency lanes", () => {
  const html = renderViewHtml(actionItemsEntry());
  const bodyHtml = html.slice(html.indexOf("</style>"));

  const nextIndex = bodyHtml.indexOf('class="action-next');
  const todayIndex = bodyHtml.indexOf("오늘 마감");
  const soonIndex = bodyHtml.indexOf("마감 예정");
  const confirmIndex = bodyHtml.indexOf("읽지 않은 공지");
  const onlineTodayIndex = bodyHtml.indexOf("Contract liability lecture");
  const caseReviewIndex = bodyHtml.indexOf("Case review note");
  const discussionIndex = bodyHtml.indexOf("Discussion post");
  const labIndex = bodyHtml.indexOf("Lab report revision");
  const tortIndex = bodyHtml.indexOf("Tort summary");

  assert.match(bodyHtml, /우선 처리 항목/);
  assert.ok(nextIndex >= 0, "next best action card should render first");
  assert.ok(todayIndex > nextIndex, "today lane should follow the next action");
  assert.ok(soonIndex > todayIndex, "soon lane should follow today's work");
  assert.ok(confirmIndex > soonIndex, "notice lane should be de-emphasized after actionable work");
  assert.ok(onlineTodayIndex > todayIndex && onlineTodayIndex < soonIndex, "online lectures with today's deadline should be grouped with today's work");
  assert.ok(caseReviewIndex < discussionIndex && discussionIndex < labIndex && labIndex < tortIndex, "soon lane should be sorted by deadline even across source buckets");
  assert.match(bodyHtml, /class="action-type">영상/);
  assert.doesNotMatch(bodyHtml, />온라인</);
  assert.doesNotMatch(bodyHtml, />시청</);
  assert.doesNotMatch(bodyHtml, /미제출 과제/);
  assert.doesNotMatch(bodyHtml, /마감 임박/);
  assert.doesNotMatch(bodyHtml, /안 읽은 공지/);
  assert.doesNotMatch(bodyHtml, /미수강 온라인/);
  assert.doesNotMatch(bodyHtml, /다음에 할 일/);
  assert.doesNotMatch(bodyHtml, /오늘 해야 함/);
  assert.doesNotMatch(bodyHtml, /곧 해야 함/);
  assert.doesNotMatch(bodyHtml, /확인만 하면 됨/);
  assert.doesNotMatch(bodyHtml, /시청 필요/);
});

test("action-items omits the generic AI summary even when an AI response exists", () => {
  const html = renderViewHtml(actionItemsEntry());

  assert.doesNotMatch(html, /class="briefing/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER_ACTION_ITEMS_AI/);
});
