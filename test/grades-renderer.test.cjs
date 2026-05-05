const assert = require("node:assert/strict");
const test = require("node:test");
const { renderViewHtml } = require("../dist/view-renderer.js");

function gradesEntry() {
  return {
    id: "grades-test-view",
    dataType: "grades",
    title: "Spring 2026 Grades",
    summary: "",
    aiResponse: "**SHOULD_NOT_RENDER_GRADES_AI**",
    createdAt: new Date("2026-05-03T07:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-03T07:30:00.000Z").getTime(),
    rawData: {
      gpa: 4.13,
      maxGpa: 4.5,
      totalCredits: 15,
      items: [
        { courseTitle: "Capstone Design", credits: 3, grade: "A+", score: 97 },
        { courseTitle: "Cloud Security", credits: 3, grade: "A0", score: 92 },
        { courseTitle: "Computer Networks", credits: 3, grade: "B+", score: 88 },
        { courseTitle: "Startup Evaluation", credits: 3, grade: "A+", score: 95 },
        { courseTitle: "AI Applications", credits: 3, grade: "B0", score: 84 },
      ],
    },
  };
}

test("grades renders a banded GPA rail before course evidence without a distribution section", () => {
  const html = renderViewHtml(gradesEntry());
  const bodyHtml = html.slice(html.indexOf("</style>"));

  const snapshotIndex = bodyHtml.indexOf('class="grades-snapshot"');
  const graphIndex = bodyHtml.indexOf('class="grades-gpa-graph"');
  const coursesIndex = bodyHtml.indexOf('class="grade-course-list"');

  assert.ok(snapshotIndex >= 0, "GPA snapshot should render");
  assert.ok(graphIndex > snapshotIndex, "GPA graph should sit inside the snapshot");
  assert.ok(coursesIndex > graphIndex, "course evidence should follow the GPA graph");
  assert.match(html, /class="grades-gpa-rail"/);
  assert.match(html, /class="grades-gpa-segments"/);
  assert.match(html, /class="grades-gpa-marker"/);
  assert.match(html, /class="grades-gpa-band-labels"/);
  assert.match(html, /3\.0 미만/);
  assert.match(html, /4\.0\+/);
  assert.match(html, /class="grades-stat"/);
  assert.equal((bodyHtml.match(/class="grades-stat"/g) || []).length, 2);
  assert.match(html, /class="grade-course-card/);
  assert.match(html, /class="grade-pill/);
  assert.doesNotMatch(bodyHtml, /평균 학점/);
  assert.doesNotMatch(bodyHtml, /평균 점수/);
  assert.doesNotMatch(bodyHtml, /97점/);
  assert.doesNotMatch(bodyHtml, /92점/);
  assert.doesNotMatch(bodyHtml, /class="grade-score"/);
  assert.doesNotMatch(bodyHtml, /grades-gpa-axis/);
  assert.doesNotMatch(bodyHtml, /grade-band-strip/);
  assert.doesNotMatch(bodyHtml, /성적 분포/);
});

test("grades omits the AI summary even when an AI response exists", () => {
  const html = renderViewHtml(gradesEntry());

  assert.doesNotMatch(html, /class="briefing/);
  assert.doesNotMatch(html, /AI 요약/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER_GRADES_AI/);
});
