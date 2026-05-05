const assert = require("node:assert/strict");
const test = require("node:test");
const { renderViewHtml } = require("../dist/view-renderer.js");

function timetableEntry() {
  return {
    id: "test-view",
    dataType: "timetable",
    title: "2026학년도 1학기 시간표",
    summary: "",
    aiResponse: "",
    createdAt: new Date("2026-05-03T06:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-03T06:30:00.000Z").getTime(),
    rawData: {
      entries: [
        {
          dayOfWeek: 1,
          dayLabel: "월",
          courseTitle: "캡스톤디자인",
          location: "S1350",
          timeRange: "13:30 – 15:00",
          professor: "김민준",
        },
        {
          dayOfWeek: 1,
          dayLabel: "월",
          courseTitle: "시스템클라우드보안",
          location: "S1402",
          timeRange: "15:10 – 16:40",
          professor: "박서연",
        },
        {
          dayOfWeek: 3,
          dayLabel: "수",
          courseTitle: "벤처창업과사업성평가",
          location: "S1205",
          timeRange: "09:00 – 10:30",
          professor: "정하린",
        },
      ],
    },
  };
}

test("timetable renders a today-first agenda layout", () => {
  const html = renderViewHtml(timetableEntry());

  assert.match(html, /timetable-focus/);
  assert.match(html, /다음 수업/);
  assert.match(html, /요일별 시간표/);
  assert.match(html, /timeline-course/);
  assert.match(html, /S1350/);
});

test("timetable omits the AI summary even when an AI response exists", () => {
  const entry = timetableEntry();
  entry.aiResponse = "**SHOULD_NOT_RENDER_TIMETABLE_AI**";

  const html = renderViewHtml(entry);

  const focusIndex = html.indexOf('class="timetable-focus"');
  const tabsIndex = html.indexOf('class="weekday-tabs"');

  assert.ok(focusIndex >= 0, "focus card should render");
  assert.ok(tabsIndex > focusIndex, "weekday tabs should appear directly after the focus area");
  assert.doesNotMatch(html, /class="briefing/);
  assert.doesNotMatch(html, /briefing-inline/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER_TIMETABLE_AI/);
});
