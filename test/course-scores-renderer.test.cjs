const assert = require("node:assert/strict");
const test = require("node:test");
const { renderViewHtml } = require("../dist/view-renderer.js");

function courseScoresEntry() {
  return {
    id: "course-scores-test-view",
    dataType: "course-scores",
    title: "수강점수",
    summary: "",
    aiResponse: "**SHOULD_NOT_RENDER_COURSE_SCORES_AI**",
    createdAt: new Date("2026-05-03T07:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-03T07:30:00.000Z").getTime(),
    rawData: {
      year: 2026,
      termCode: "10",
      termLabel: "1학기",
      courses: [
        {
          title: "0752 - 시스템클라우드보안",
          courseCode: "0752",
          courseTitle: "시스템클라우드보안",
          items: [
            {
              assessmentCategory: "수시시험(중간시험, QUIZ포함)",
              itemName: "중간시험",
              ratio: { rawValue: "40 / 40 %" },
              rawScore: { rawValue: "0 / 100 점" },
              averageScore: { rawValue: "0 점" },
              note: "미입력",
            },
          ],
        },
      ],
    },
  };
}

test("course-scores renders detail section and assessment rows", () => {
  const html = renderViewHtml(courseScoresEntry());
  const bodyHtml = html.slice(html.indexOf("</style>"));

  assert.match(html, /COURSE SCORES/);
  assert.match(html, /수강점수/);
  assert.match(html, /2026학년도 · 1학기/);
  assert.match(bodyHtml, /course-score-detail-section/);
  assert.match(bodyHtml, /과목별 상세/);
  assert.match(bodyHtml, /class="course-score-course"/);
  assert.match(bodyHtml, /class="course-score-course-head"/);
  assert.match(bodyHtml, /class="course-score-course-list"/);
  assert.doesNotMatch(bodyHtml, /grades-snapshot/);
  assert.doesNotMatch(bodyHtml, /<span class="count">/);
  assert.doesNotMatch(bodyHtml, /개 항목/);
  assert.match(bodyHtml, /class="badge badge-gray">미공개<\/span>/);
  assert.match(html, /0752 - 시스템클라우드보안/);
  assert.match(html, /중간시험/);
  assert.match(html, /수시시험\(중간시험, QUIZ포함\)/);
  assert.match(html, /40 \/ 40 %/);
  assert.match(html, /course-score-metric-label">내 점수<\/div><div class="course-score-metric-value">미공개/);
  assert.match(html, /0 점/);
});

test("course-scores summarizes only published scores and average comparison", () => {
  const entry = courseScoresEntry();
  entry.rawData.courses = [
    {
      title: "0752 - 시스템클라우드보안",
      items: [
        {
          assessmentCategory: "과제",
          itemName: "클라우드 보안 실습 리포트",
          ratio: { rawValue: "10 / 10 %" },
          rawScore: { rawValue: "9 / 10 점" },
          averageScore: { rawValue: "8.2 점" },
          note: "입력",
        },
      ],
    },
  ];

  const html = renderViewHtml(entry);
  const bodyHtml = html.slice(html.indexOf("</style>"));
  const summaryHtml = bodyHtml.slice(
    bodyHtml.indexOf('class="course-score-summary"'),
    bodyHtml.indexOf('class="section course-score-detail-section"'),
  );

  assert.match(summaryHtml, /공개된 수강점수/);
  assert.match(summaryHtml, /1과목에서 1개 평가 항목이 공개됐어요/);
  assert.match(summaryHtml, /<strong>1<\/strong><span>평균보다 높음<\/span>/);
  assert.match(summaryHtml, /<strong>0<\/strong><span>평균 동일<\/span>/);
  assert.match(summaryHtml, /<strong>0<\/strong><span>평균보다 낮음<\/span>/);
  assert.doesNotMatch(summaryHtml, /반영비율/);
});

test("course-scores treats producer Not entered rows as pending", () => {
  const entry = courseScoresEntry();
  entry.rawData.courses[0].items[0].rawScore = { rawValue: "Not entered" };
  entry.rawData.courses[0].items[0].note = "Pending";

  const html = renderViewHtml(entry);
  const bodyHtml = html.slice(html.indexOf("</style>"));

  assert.match(bodyHtml, /class="badge badge-gray">미공개<\/span>/);
  assert.match(bodyHtml, /course-score-metric-label">내 점수<\/div><div class="course-score-metric-value">미공개/);
  assert.match(bodyHtml, /아직 공개된 평가 항목이 없습니다/);
  assert.doesNotMatch(bodyHtml, /grades-level/);
  assert.doesNotMatch(bodyHtml, /Pending/);
});

test("course-scores renders empty and all-entered edge states", () => {
  const emptyEntry = courseScoresEntry();
  emptyEntry.rawData.courses = [];
  const emptyHtml = renderViewHtml(emptyEntry);
  assert.match(emptyHtml, /과목별 상세/);
  assert.match(emptyHtml, /course-score-empty/);
  assert.match(emptyHtml, /조회된 수강점수 항목이 없습니다/);

  const enteredEntry = courseScoresEntry();
  enteredEntry.rawData.courses = [
    {
      courseCode: "0752",
      courseTitle: "시스템클라우드보안",
      items: [
        {
          assessmentCategory: "기말시험",
          itemName: "기말시험",
          ratio: { earned: 30, total: 40 },
          rawScore: { earned: 87, total: 100 },
          averageScore: { value: 71.5 },
        },
      ],
    },
  ];

  const html = renderViewHtml(enteredEntry);
  const bodyHtml = html.slice(html.indexOf("</style>"));
  assert.match(html, /0752 - 시스템클라우드보안/);
  assert.match(html, /30 \/ 40/);
  assert.match(html, /87 \/ 100/);
  assert.match(html, /71.5/);
  assert.doesNotMatch(bodyHtml, /전체 입력/);
  assert.doesNotMatch(bodyHtml, /badge-green/);
});

test("course-scores omits the AI summary even when an AI response exists", () => {
  const html = renderViewHtml(courseScoresEntry());

  assert.doesNotMatch(html, /class="briefing/);
  assert.doesNotMatch(html, /AI 요약/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER_COURSE_SCORES_AI/);
});
