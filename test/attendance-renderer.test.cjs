const assert = require("node:assert/strict");
const test = require("node:test");
const { renderViewHtml } = require("../dist/view-renderer.js");

function attendanceEntry() {
  const present = "\uCD9C\uC11D";
  const tardy = "\uC9C0\uAC01";
  const absent = "\uACB0\uC11D";

  return {
    id: "attendance-test-view",
    dataType: "attendance",
    title: present,
    summary: "",
    aiResponse: "**SHOULD_NOT_RENDER_ATTENDANCE_AI**",
    createdAt: new Date("2026-05-03T10:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-03T10:30:00.000Z").getTime(),
    rawData: {
      course: {
        courseTitle: "\uCEA1\uC2A4\uD1A4\uB514\uC790\uC778",
        professor: "\uAE40\uAD50\uC218",
        scheduleSummary: "\uC6D4 13:00-15:50 / S1350",
      },
      summary: {
        attendedCount: 10,
        tardyCount: 1,
        earlyLeaveCount: 0,
        absentCount: 1,
      },
      totalSessions: 16,
      completedSessions: 12,
      sessions: [
        { sessionLabel: "12\uC8FC\uCC28 1\uAD50\uC2DC", date: "2026-05-18", dateLabel: "5\uC6D4 18\uC77C", isPast: true, statusLabel: present, attendAt: "13:00" },
        { sessionLabel: "6\uC8FC\uCC28 1\uAD50\uC2DC", date: "2026-04-06", dateLabel: "4\uC6D4 6\uC77C", isPast: true, statusLabel: absent },
        { sessionLabel: "3\uC8FC\uCC28 1\uAD50\uC2DC", date: "2026-03-16", dateLabel: "3\uC6D4 16\uC77C", isPast: true, statusLabel: tardy, attendAt: "13:18" },
      ],
    },
  };
}

test("attendance renders absence-first counts without the percent hero", () => {
  const html = renderViewHtml(attendanceEntry());
  const bodyHtml = html.slice(html.indexOf("</style>"));

  const summaryIndex = bodyHtml.indexOf('class="attendance-briefing"');
  const gridIndex = bodyHtml.indexOf("\uCD9C\uACB0 \uD604\uD669");
  const recentIndex = bodyHtml.indexOf("\uCD5C\uADFC \uCD9C\uACB0");

  assert.ok(summaryIndex >= 0, "attendance count briefing should replace the percent hero");
  assert.ok(gridIndex > summaryIndex, "existing attendance dot grid should remain below the count briefing");
  assert.ok(recentIndex > gridIndex, "recent attendance list should remain below the dot grid");
  assert.match(bodyHtml, /class="attendance-count danger"[\s\S]*\uACB0\uC11D[\s\S]*1<span class="unit">\uD68C<\/span>/);
  assert.match(bodyHtml, /class="attendance-count warn"[\s\S]*\uC9C0\uAC01[\s\S]*1<span class="unit">\uD68C<\/span>/);
  assert.match(bodyHtml, /\uCD9C\uC11D 10\uD68C \u00B7 \uC9C4\uD589\uB41C \uC218\uC5C5 12\uD68C/);
  assert.doesNotMatch(bodyHtml, /\uCD9C\uC11D\uB960/);
  assert.doesNotMatch(bodyHtml, /83<span class="unit">%<\/span>/);
});

test("attendance omits the generic AI summary even when an AI response exists", () => {
  const html = renderViewHtml(attendanceEntry());

  assert.doesNotMatch(html, /class="briefing/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER_ATTENDANCE_AI/);
});
