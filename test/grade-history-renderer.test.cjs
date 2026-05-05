const assert = require("node:assert/strict");
const test = require("node:test");
const { renderViewHtml } = require("../dist/view-renderer.js");

function gradeHistoryEntry() {
  return {
    id: "grade-history-test-view",
    dataType: "grade-history",
    title: "학기별 성적",
    summary: "",
    aiResponse: "**SHOULD_NOT_RENDER_GRADE_HISTORY_AI**",
    createdAt: new Date("2026-05-03T07:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-03T07:30:00.000Z").getTime(),
    rawData: {
      overview: {
        전체평점: "4.08",
        전체취득학점: "96",
      },
      termRecords: [
        {
          title: "2025학년도 2학기",
          year: 2025,
          termLabel: "2학기",
          earnedCredits: 18,
          gpa: 4.22,
          courses: [
            { courseTitle: "캡스톤디자인", credits: 3, grade: "A+" },
            { courseTitle: "컴퓨터네트워크", credits: 3, grade: "A0" },
            { courseTitle: "정보보호개론", credits: 3, grade: "B+" },
            { courseTitle: "AI응용", credits: 3, grade: "A+" },
          ],
        },
        {
          title: "2025학년도 1학기",
          year: 2025,
          termLabel: "1학기",
          earnedCredits: 15,
          gpa: 3.93,
          courses: [
            { courseTitle: "알고리즘", credits: 3, grade: "A0" },
            { courseTitle: "운영체제", credits: 3, grade: "B+" },
          ],
        },
      ],
    },
  };
}

test("grade-history renders cumulative summary, connected grade-point flow, and term cards", () => {
  const html = renderViewHtml(gradeHistoryEntry());
  const bodyHtml = html.slice(html.indexOf("</style>"));

  const overviewIndex = bodyHtml.indexOf('class="history-overview"');
  const flowIndex = bodyHtml.indexOf('class="history-flow"');
  const listIndex = bodyHtml.indexOf('class="history-term-list"');

  assert.ok(overviewIndex >= 0, "cumulative overview should render");
  assert.ok(flowIndex > overviewIndex, "grade-point flow should follow the overview");
  assert.ok(listIndex > flowIndex, "term cards should follow the grade-point flow");
  assert.match(html, /누적 평균 학점/);
  assert.match(html, /취득 학점/);
  assert.match(html, /조회 학기/);
  assert.match(html, /학기별 학점 흐름/);
  assert.match(html, /class="history-flow-svg"/);
  assert.match(html, /class="history-flow-line"/);
  assert.match(html, /class="history-flow-point latest"/);
  assert.doesNotMatch(bodyHtml, /history-flow-bar/);
  assert.doesNotMatch(bodyHtml, /history-flow-fill/);
  assert.doesNotMatch(bodyHtml, /GPA/);
  assert.match(html, /2025학년도 2학기/);
  assert.match(html, /class="history-term-summary"/);
  assert.match(html, /평균 4\.22/);
  assert.match(html, /4\.22/);
  assert.match(html, /18학점/);
  assert.doesNotMatch(bodyHtml, /class="history-term-stats"/);
  assert.doesNotMatch(bodyHtml, /class="history-term-stat/);
  assert.doesNotMatch(bodyHtml, /총 이수 학점/);
  assert.doesNotMatch(bodyHtml, /class="history-term-count"/);
  assert.doesNotMatch(bodyHtml, /4과목/);
  assert.match(html, /캡스톤디자인/);
  assert.match(bodyHtml, /class="grade-pill history-grade-pill"/);
  assert.doesNotMatch(bodyHtml, /history-course-card top/);
  assert.doesNotMatch(bodyHtml, /class="grade-pill high"/);
});

test("grade-history omits the AI summary even when an AI response exists", () => {
  const html = renderViewHtml(gradeHistoryEntry());

  assert.doesNotMatch(html, /class="briefing/);
  assert.doesNotMatch(html, /AI 요약/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER_GRADE_HISTORY_AI/);
});
