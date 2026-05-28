const assert = require("node:assert/strict");
const test = require("node:test");
const { renderViewHtml } = require("../dist/view-renderer.js");

function graduationEntry() {
  return {
    id: "graduation-test-view",
    dataType: "graduation",
    title: "Graduation Requirements",
    summary: "",
    aiResponse: "**SHOULD_NOT_RENDER_GRADUATION_AI**",
    createdAt: new Date("2026-05-03T08:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-03T08:30:00.000Z").getTime(),
    rawData: {
      department: "컴퓨터공학과",
      admissionYear: 2022,
      overall: { earned: 116, required: 130, pct: 89 },
      creditGaps: [
        { label: "Total Credits", earned: 116, required: 130, gap: 14 },
        { label: "Major Core", earned: 33, required: 33, gap: 0 },
        {
          label: "Major Elective",
          earned: 45,
          required: 54,
          gap: 9,
          requiredCourses: [{ courseCode: "LAW301", courseTitle: "Civil Procedure" }],
          missingRequiredCourses: [{ courseCode: "LAW402", courseTitle: "Commercial Law" }],
          completedRequiredCourses: ["Constitutional Law"],
        },
        { label: "General Education", earned: 18, required: 18, gap: 0 },
        { label: "Free Elective", earned: 8, required: 13, gap: 5 },
      ],
      requiredCourses: [{ courseCode: "LAW101", courseTitle: "Legal Method" }],
      missingRequiredCourses: ["Legal Ethics"],
      completedRequiredCourses: [{ courseCode: "LAW201", courseTitle: "Criminal Law" }],
      requirementSources: [
        {
          title: "MSI 졸업사정 조회",
          url: "mju-msi://graduation/computer-engineering/2022",
          retrievedAt: "2026-05-22T00:00:00.000Z",
        },
      ],
      requirements: [
        {
          label: "전공 학점",
          category: "전공",
          requiredCredits: 66,
          earnedCredits: 60,
          status: "missing",
          requiredCourses: [{ courseCode: "CSE401", courseTitle: "캡스톤디자인" }],
          missingCourses: [{ courseCode: "CSE401", courseTitle: "캡스톤디자인" }],
          completedCourses: [{ courseCode: "CSE201", courseTitle: "자료구조" }],
          sourceTitle: "MSI 졸업사정 조회",
          sourceUrl: "mju-msi://graduation/computer-engineering/2022",
        },
      ],
    },
  };
}

function graduationCourseRowHtml(html, name) {
  const nameIndex = html.indexOf(`data-grad-name="${name}"`);
  if (nameIndex < 0) return "";
  const start = html.lastIndexOf('<div class="grad-course-detail-row"', nameIndex);
  const end = html.indexOf("</em></div>", nameIndex);
  return start >= 0 && end >= 0 ? html.slice(start, end + "</em></div>".length) : "";
}

function countOccurrences(html, needle) {
  return html.split(needle).length - 1;
}

function graduationAreaCardHtml(html, label) {
  const labelIndex = html.indexOf(`<div class="ring-card-title">${label}</div>`);
  if (labelIndex < 0) return "";
  const start = html.lastIndexOf("<details", labelIndex);
  const end = html.indexOf("</details>", labelIndex);
  return start >= 0 && end >= 0 ? html.slice(start, end + "</details>".length) : "";
}

test("graduation keeps the total ring and inserts shortages before expandable area details", () => {
  const html = renderViewHtml(graduationEntry());
  const bodyHtml = html.slice(html.indexOf("</style>"));

  const heroIndex = bodyHtml.indexOf('class="grad-hero"');
  const shortagesIndex = bodyHtml.indexOf('class="grad-shortage-list"');
  const areaIndex = bodyHtml.indexOf('grad-area-list');

  assert.ok(heroIndex >= 0, "original total credit ring should render");
  assert.ok(shortagesIndex > heroIndex, "shortage list should sit below the total credit ring");
  assert.ok(areaIndex > shortagesIndex, "expandable area details should follow the shortage list");
  assert.doesNotMatch(bodyHtml, /grad-briefing/);
  assert.doesNotMatch(bodyHtml, /grad-requirement-list/);
  assert.match(bodyHtml, /class="grad-shortage-row/);
  assert.doesNotMatch(bodyHtml, /grad-shortage-item/);
  assert.doesNotMatch(bodyHtml, /grad-shortage-bar/);
  assert.match(bodyHtml, /class="ring-grid grad-area-list"/);
  assert.match(html, /\.grad-area-list\s*\{[\s\S]*align-items:\s*start;/);
  assert.match(html, /\.grad-area-card\s*\{[\s\S]*align-self:\s*start;/);
  assert.match(bodyHtml, /class="ring-card grad-area-card/);
  assert.match(bodyHtml, /<details class="ring-card grad-area-card"/);
  assert.doesNotMatch(bodyHtml, /<details class="ring-card grad-area-card" open/);
  assert.match(bodyHtml, /영역 카드를 눌러 상세내용을 확인할 수 있습니다/);
  assert.match(bodyHtml, /Major Elective/);
  assert.match(bodyHtml, /Free Elective/);
});

test("graduation keeps 0 of 0 credit meta but uses a neutral empty detail", () => {
  const creditLabel = "\uD559\uC810";
  const neutralEmpty = "\uC120\uD0DD \uC774\uC218 \uACFC\uC815\uC774\uB77C \uD604\uC7AC \uD45C\uC2DC\uD560 \uC138\uBD80 \uACFC\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.";
  const officialEmptyPrefix = "\uACF5\uC2DD \uAE30\uC900 \uD655\uC778 \uD544\uC694";
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      overall: { earned: 0, required: 0 },
      creditGaps: [
        { label: "Zero Requirement", earned: 0, required: 0, gap: 0 },
      ],
    },
  });

  assert.match(html, /Zero Requirement/);
  assert.equal(html.includes(`0 / 0 ${creditLabel}`), true);
  assert.equal(html.includes(neutralEmpty), true);
  assert.equal(html.includes(officialEmptyPrefix), false);
});

test("graduation renders a fallback instead of throwing on malformed source data", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      department: "컴퓨터공학전공",
      admissionYear: 2025,
      creditGaps: "not-an-array",
      sources: [{ sourceTitle: "깨진 source", rules: "not-an-array" }],
    },
  });

  assert.match(html, /졸업 로드맵/);
  assert.match(html, /학과 컴퓨터공학전공/);
  assert.match(html, /2025학번/);
  assert.match(html, /공식 기준 확인 필요/);
});

test("graduation explains official-source gaps when the reader provides a reason", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      query: {
        department: "15420 스마트인프라공학부",
        admissionYear: 2025,
        unavailableReason: "학부 단위는 세부 전공별 졸업요건이 다를 수 있어 공식 전공 기준 데이터가 필요합니다.",
      },
      creditGaps: [],
      requirementSources: [],
    },
  });

  assert.match(html, /학과 스마트인프라공학부/);
  assert.doesNotMatch(html, /학과 15420 스마트인프라공학부/);
  assert.match(html, /2025학번/);
  assert.match(html, /학부 단위는 세부 전공별 졸업요건이 다를 수 있어 공식 전공 기준 데이터가 필요합니다/);
});

test("graduation accepts MSI total credit rows without rendering object text", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    title: "졸업 로드맵",
    rawData: {
      department: "컴퓨터공학과",
      admissionYear: 2021,
      overall: {
        earned: [{ label: "총 취득학점", credits: 105 }],
        required: [{ label: "총 취득학점", credits: 134 }],
      },
      creditGaps: [
        { label: "총 취득학점", earned: 105, required: 134, gap: 29 },
      ],
    },
  });

  assert.match(html, /105<span class="unit"> \/ 134<\/span>/);
  assert.doesNotMatch(html, /\[object Object\]/);
});

test("graduation clamps over-complete progress before rendering the ring", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      department: "Computer Engineering",
      admissionYear: 2024,
      overall: { earned: 150, required: 134, pct: 145 },
      creditGaps: [
        { label: "Total Credits", earned: 150, required: 134 },
      ],
    },
  });

  assert.match(html, /<div class="ring-pct">100<span class="u">%<\/span><\/div>/);
  assert.doesNotMatch(html, /stroke-dasharray="[^"]* -/);
});

test("graduation renders completed and missing course names inside expandable areas", () => {
  const html = renderViewHtml(graduationEntry());

  assert.doesNotMatch(html, /필수 과목 현황/);
  assert.doesNotMatch(html, /필수 요건 체크리스트/);
  assert.match(html, /LAW301 - Civil Procedure/);
  assert.match(html, /LAW402 - Commercial Law/);
  assert.match(html, /미수강/);
  assert.match(html, /이수/);
  assert.match(html, /Constitutional Law/);
  assert.doesNotMatch(html, /next-semester/i);
  assert.doesNotMatch(html, /recommendation/i);
});

test("graduation does not render completed required courses as missing again", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      department: "Computer Engineering",
      admissionYear: 2021,
      overall: { earned: 19, required: 19 },
      creditGaps: [
        {
          label: "Basic Science",
          earned: 19,
          required: 19,
          gap: 0,
          detailCourses: [
            {
              courseTitle: "Calculus I",
              courseCode: "KME02101",
              category: "Basic Science",
              credits: 3,
              note: "2021 1",
              status: "completed",
            },
          ],
        },
      ],
      requirementSources: [
        {
          department: "Computer Engineering",
          admissionYear: 2018,
          sourceTitle: "Official Engineering Accreditation Guide",
          sourceUrl: "https://example.edu/engineering",
          rules: [
            {
              requirementKey: "foundational-liberal-credit",
              label: "Basic Science",
              category: "Engineering Accreditation",
              requiredCourseTitles: ["Calculus I"],
              programTrack: "Engineering Accreditation",
              minCourses: 1,
              appliesTo: { admissionYearFrom: 2018, admissionYearTo: 2023 },
              status: "confirmed",
              note: "required science course",
            },
          ],
        },
      ],
    },
  });

  assert.equal(countOccurrences(html, 'data-grad-name="KME02101 - Calculus I"'), 1);
  assert.equal(countOccurrences(html, 'data-grad-name="Calculus I"'), 0);
  assert.doesNotMatch(graduationCourseRowHtml(html, "KME02101 - Calculus I"), /class="grad-course-status missing">/);
});

test("graduation renders top-level official sources without rule payloads", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      department: "컴퓨터공학전공",
      admissionYear: 2021,
      overall: { earned: 105, required: 134 },
      creditGaps: [
        { label: "전공", earned: 60, required: 70, gap: 10 },
      ],
      requirementSources: [
        {
          title: "명지대학교 컴퓨터공학전공 졸업이수가이드",
          url: "https://cs.mju.ac.kr/cs/10763/subview.do",
        },
      ],
    },
  });

  assert.match(html, /공식 출처/);
  assert.match(html, /명지대학교 컴퓨터공학전공 졸업이수가이드/);
  assert.match(html, /https:\/\/cs\.mju\.ac\.kr\/cs\/10763\/subview\.do/);
});

test("graduation does not duplicate official sources from selectable requirement groups", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      department: "컴퓨터공학전공",
      admissionYear: 2021,
      creditGaps: [{ label: "공통교양", earned: 4, required: 4, gap: 0 }],
      requirementSources: [
        {
          sourceTitle: "방목기초교육대학 공통교양",
          sourceUrl: "https://www.mju.ac.kr/bangmok/1649/subview.do",
          rules: [{ label: "공통교양", category: "공통교양", requiredCredits: 4 }],
        },
      ],
      choiceGroups: [
        {
          key: "english-track",
          label: "영어",
          required: true,
          selectable: true,
          sourceTitle: "방목기초교육대학 공통교양",
          sourceUrl: "https://www.mju.ac.kr/bangmok/1649/subview.do",
          options: [{ key: "basic", label: "영어1, 영어2", courseTitles: ["영어1", "영어2"] }],
        },
      ],
    },
  });

  assert.match(html, /class="grad-source-list"/);
  assert.doesNotMatch(html, /class="choice-source-list"/);
  assert.equal(countOccurrences(html, 'href="https://www.mju.ac.kr/bangmok/1649/subview.do"'), 1);
});

test("graduation keeps repeated completed chapel rows by taken semester", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      department: "컴퓨터공학전공",
      admissionYear: 2021,
      creditGaps: [
        {
          label: "공통교양",
          earned: 2,
          required: 2,
          gap: 0,
          detailCourses: [
            { courseTitle: "채플", status: "completed", credits: 0.5, note: "2021 1학기" },
            { courseTitle: "채플", status: "completed", credits: 0.5, note: "2021 2학기" },
            { courseTitle: "채플", status: "completed", credits: 0.5, note: "2024 1학기" },
            { courseTitle: "채플", status: "completed", credits: 0.5, note: "2024 2학기" },
          ],
        },
      ],
    },
  });

  assert.equal(countOccurrences(html, 'data-grad-name="채플"'), 4);
  assert.match(html, /2021 1학기/);
  assert.match(html, /2024 2학기/);
});

test("graduation moves chapel details into the dedicated chapel count card", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      department: "컴퓨터공학전공",
      admissionYear: 2021,
      creditGaps: [
        {
          label: "공통교양",
          earned: 2,
          required: 2,
          gap: 0,
          detailCourses: [
            { courseTitle: "채플", courseCode: "KMA02101", status: "completed", credits: 0.5, note: "2021 1학기" },
            { courseTitle: "채플", courseCode: "KMA02101", status: "completed", credits: 0.5, note: "2021 2학기" },
          ],
        },
        {
          label: "채플 이수횟수",
          earned: 2,
          required: 2,
          gap: 0,
          detailCourses: [],
        },
      ],
      requirementSources: [
        {
          department: "컴퓨터공학전공",
          admissionYear: 2020,
          sourceTitle: "방목기초교육대학 공통교양",
          sourceUrl: "https://www.mju.ac.kr/bangmok/1649/subview.do",
          rules: [
            {
              requirementKey: "common-liberal-chapel",
              label: "공통교양",
              category: "공통교양",
              courseGroups: [
                {
                  groupKey: "chapel",
                  label: "채플",
                  requiredCourseTitles: ["채플"],
                  minCourses: 2,
                  requiredCredits: 1,
                },
              ],
              status: "confirmed",
            },
          ],
        },
      ],
    },
  });

  const commonCard = graduationAreaCardHtml(html, "공통교양");
  const chapelCard = graduationAreaCardHtml(html, "채플 이수횟수");
  assert.equal(countOccurrences(commonCard, 'data-grad-name="KMA02101 - 채플"'), 0);
  assert.equal(countOccurrences(chapelCard, 'data-grad-name="KMA02101 - 채플"'), 2);
  assert.match(chapelCard, /2021 1학기/);
  assert.match(chapelCard, /2021 2학기/);
});

test("graduation hides superseded zero-credit completed retake rows", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      department: "컴퓨터공학전공",
      admissionYear: 2021,
      creditGaps: [
        {
          label: "공통교양",
          earned: 3,
          required: 3,
          gap: 0,
          detailCourses: [
            { courseTitle: "글쓰기", courseCode: "KMA02104", status: "completed", credits: 0, note: "2021 2학기" },
            { courseTitle: "글쓰기", courseCode: "KMA02104", status: "completed", credits: 3, note: "2024 2학기" },
          ],
        },
      ],
    },
  });

  assert.equal(countOccurrences(html, 'data-grad-name="KMA02104 - 글쓰기"'), 1);
  const row = graduationCourseRowHtml(html, "KMA02104 - 글쓰기");
  assert.match(row, /2024 2학기/);
  assert.doesNotMatch(row, /2021 2학기/);
});

test("graduation hides completed official summaries already shown as taken courses", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      department: "컴퓨터공학전공",
      admissionYear: 2021,
      creditGaps: [
        {
          label: "공통교양",
          earned: 17,
          required: 17,
          gap: 0,
          detailCourses: [
            { courseTitle: "4차산업혁명과미래사회진로선택", courseCode: "KMA02141", status: "completed", credits: 2, note: "2021 1학기" },
            { courseTitle: "현대사회와기독교윤리", courseCode: "KMA02102", status: "completed", credits: 2, note: "2021 2학기" },
            { courseTitle: "기독교와문화", courseCode: "KMA02122", status: "completed", credits: 2, note: "2024 1학기" },
            { courseTitle: "글쓰기", courseCode: "KMA02104", status: "completed", credits: 3, note: "2024 2학기" },
          ],
        },
      ],
      requirementSources: [
        {
          sourceTitle: "방목기초교육대학 공통교양",
          sourceUrl: "https://www.mju.ac.kr/bangmok/1649/subview.do",
          rules: [
            {
              label: "공통교양",
              category: "공통교양",
              courseGroups: [
                { groupKey: "career", label: "진로", requiredCredits: 2, minCourses: 1, requiredCourseTitles: ["4차산업혁명과 미래사회 진로선택"] },
                { groupKey: "christianity", label: "기독교 교과목", requiredCredits: 4, minCourses: 2, requiredCourseTitles: ["성서와 인간이해", "현대사회와 기독교 윤리", "종교와 과학", "기독교와 문화"] },
                { groupKey: "writing", label: "사고와 표현", requiredCredits: 3, minCourses: 1, requiredCourseTitles: ["글쓰기", "발표와토의"] },
              ],
              status: "confirmed",
            },
          ],
        },
      ],
    },
  });

  assert.match(html, /KMA02141 - 4차산업혁명과미래사회진로선택/);
  assert.match(html, /KMA02102 - 현대사회와기독교윤리/);
  assert.match(html, /KMA02122 - 기독교와문화/);
  assert.match(html, /KMA02104 - 글쓰기/);
  assert.doesNotMatch(html, /진로: 4차산업혁명과 미래사회 진로선택/);
  assert.doesNotMatch(html, /기독교 교과목: 성서와 인간이해/);
  assert.doesNotMatch(html, /사고와 표현: 글쓰기, 발표와토의/);
});

test("graduation can sort completed courses by taken semester", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      department: "컴퓨터공학전공",
      admissionYear: 2022,
      creditGaps: [
        {
          label: "핵심교양",
          earned: 6,
          required: 12,
          gap: 6,
          detailCourses: [
            { courseTitle: "역사와철학", credits: 3, status: "completed", note: "2025 1학기", category: "핵심교양" },
            { courseTitle: "과학기술과사회", credits: 3, status: "completed", note: "2024 2학기", category: "핵심교양" },
          ],
          missingCourses: [{ courseTitle: "핵심교양 추가 이수", credits: 6, status: "missing" }],
        },
      ],
    },
  });

  assert.match(html, /data-grad-sort="asc"/);
  assert.match(html, /data-grad-sort="desc"/);
  assert.match(html, /학기 ↑/);
  assert.match(html, /학기 ↓/);
  assert.match(html, /data-grad-term-order="20251"/);
  assert.match(html, /data-grad-term-order="20242"/);
  assert.match(html, /2025 1학기/);
  assert.match(html, /2024 2학기/);
  assert.match(html, /핵심교양 추가 이수/);
});

test("graduation explains free elective shortages as recognized elective credits", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      department: "컴퓨터공학전공",
      admissionYear: 2022,
      creditGaps: [
        { label: "자유선택", earned: 8, required: 13, gap: 5 },
      ],
    },
  });

  assert.match(html, /자유선택 포함 기준/);
  assert.match(html, /자유선택 인정 학점 추가 필요/);
  assert.match(html, /전공·교양 필수\/영역 기준을 먼저 충족한 뒤/);
  assert.match(html, /졸업사정에서 자유선택으로 분류되는 초과 인정 학점이나 일반선택 학점/);
  assert.match(html, /5학점/);
  assert.match(html, /미수강/);
});

test("graduation summarizes major credit shortages without inventing missing electives", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      department: "컴퓨터공학전공",
      admissionYear: 2021,
      creditGaps: [
        {
          label: "전공",
          earned: 53,
          required: 74,
          gap: 21,
          detailCourses: [{ courseTitle: "자료구조", status: "completed", credits: 3, note: "2022 1학기" }],
        },
      ],
    },
  });

  assert.match(html, /전공 선택 이수 필요/);
  assert.match(html, /필수 미수강 항목이 표시되지 않은 상태입니다/);
  assert.match(html, /21학점/);
});

test("graduation omits the checklist and asks for official-check state without area data", () => {
  const html = renderViewHtml(graduationEntry());

  assert.doesNotMatch(html, /필수 요건 체크리스트/);
  assert.match(html, /영역별/);
  assert.match(html, /Major Elective/);
  assert.doesNotMatch(html, /CSE401 - 캡스톤디자인/);
  assert.doesNotMatch(html, /CSE201 - 자료구조/);

  const unprovidedHtml = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      department: "컴퓨터공학과",
      admissionYear: 2022,
    },
  });
  assert.match(unprovidedHtml, /공식 기준 확인 필요/);
});

test("graduation renders official requirements-only output without the removed checklist", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    title: "졸업 로드맵",
    rawData: {
      total: 1,
      items: [
        {
          id: 3,
          department: "컴퓨터공학과",
          admissionYear: 2022,
          sourceKind: "department_page",
          sourceTitle: "명지대학교 컴퓨터공학전공 졸업이수가이드",
          sourceUrl: "https://cs.mju.ac.kr/cs/10763/subview.do",
          sourcePublishedAt: null,
          sourceRetrievedAt: "2026-05-22T00:00:00.000Z",
          rules: [
            {
              requirementKey: "major-credit",
              label: "전공",
              category: "전공",
              requiredCredits: 66,
              requiredCourseCodes: ["CSE401"],
              requiredCourseTitles: ["캡스톤디자인"],
              programTrack: "비인증",
              minCourses: 1,
              status: "confirmed",
              note: null,
            },
          ],
        },
      ],
    },
  });

  assert.doesNotMatch(html, /필수 요건 체크리스트/);
  assert.match(html, /졸업 로드맵/);
  assert.match(html, /총 취득 학점/);
  assert.match(html, /전공/);
  assert.match(html, /66학점 부족/);
  assert.match(html, /CSE401 - 캡스톤디자인/);
  assert.match(html, /비인증 · 1개 과목/);
  assert.match(html, /미수강/);
  assert.match(html, /class="grad-area-source"/);
  assert.match(html, /공식 출처: 명지대학교 컴퓨터공학전공 졸업이수가이드/);
  assert.match(html, /href="https:\/\/cs\.mju\.ac\.kr\/cs\/10763\/subview\.do"/);
});

test("graduation keeps official requirements query context in the roadmap", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    title: "졸업 로드맵",
    rawData: {
      total: 1,
      query: {
        department: "Chemical Engineering",
        admissionYear: 2024,
        studentType: "foreign",
        expectedGraduationTerm: "2027-08",
      },
      items: [
        {
          id: 5,
          department: "화학공학전공",
          admissionYear: 2024,
          sourceKind: "department_page",
          sourceTitle: "명지대학교 화학공학전공 교과과정",
          sourceUrl: "https://www.mju.ac.kr/mjukr/759/subview.do",
          sourcePublishedAt: null,
          sourceRetrievedAt: "2026-05-23T00:00:00.000Z",
          rules: [
            {
              requirementKey: "major-required-courses-2027-aug-plus",
              label: "전공필수",
              category: "전공",
              requiredCredits: 27,
              requiredCourseTitles: ["화공양론"],
              courseGroups: [],
              programTrack: null,
              minCourses: null,
              status: "confirmed",
              note: null,
            },
          ],
        },
      ],
    },
  });

  assert.match(html, /학과 Chemical Engineering/);
  assert.match(html, /2024학번/);
  assert.match(html, /외국인학생/);
  assert.match(html, /졸업예정 2027-08/);
  assert.match(html, /화공양론/);
});

test("graduation filters official requirements by admission year before rendering", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    title: "졸업 로드맵",
    rawData: {
      query: {
        department: "컴퓨터공학전공",
        admissionYear: 2024,
      },
      items: [
        {
          department: "컴퓨터공학전공",
          admissionYear: 2025,
          sourceTitle: "컴퓨터공학전공 2025 기준",
          sourceUrl: "https://www.mju.ac.kr/mjukr/808/subview.do",
          rules: [
            {
              requirementKey: "major-credit-2025",
              label: "전공",
              category: "전공",
              requiredCredits: 70,
              requiredCourseTitles: ["운영체제"],
              appliesTo: { admissionYearFrom: 2025 },
              status: "confirmed",
              note: "2025학번 기준",
            },
          ],
        },
        {
          department: "컴퓨터공학전공",
          admissionYear: 2024,
          sourceTitle: "컴퓨터공학전공 2024 기준",
          sourceUrl: "https://cs.mju.ac.kr/cs/10763/subview.do",
          rules: [
            {
              requirementKey: "major-credit-2024",
              label: "전공",
              category: "전공",
              requiredCredits: 66,
              requiredCourseTitles: ["자료구조"],
              appliesTo: { admissionYearFrom: 2024, admissionYearTo: 2024 },
              status: "confirmed",
              note: "2024학번 기준",
            },
          ],
        },
      ],
    },
  });

  assert.match(html, /2024학번/);
  assert.match(html, /66학점 부족/);
  assert.match(html, /2024학번 기준/);
  assert.doesNotMatch(html, /70학점 부족/);
  assert.doesNotMatch(html, /2025학번 기준/);
});

test("graduation keeps the latest source cohort for each department", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    title: "Graduation Roadmap",
    rawData: {
      query: {
        department: "Computer Engineering",
        admissionYear: 2025,
      },
      items: [
        {
          department: "Computer Engineering",
          admissionYear: 2024,
          sourceTitle: "Computer Engineering 2024 requirements",
          sourceUrl: "https://example.test/cse/2024",
          rules: [
            {
              requirementKey: "major-credit-2024",
              label: "Major",
              category: "Major",
              requiredCredits: 66,
              requiredCourseTitles: ["Legacy Systems"],
              status: "confirmed",
              note: "2024 cohort",
            },
          ],
        },
        {
          department: "Computer Engineering",
          admissionYear: 2025,
          sourceTitle: "Computer Engineering 2025 requirements",
          sourceUrl: "https://example.test/cse/2025",
          rules: [
            {
              requirementKey: "major-credit-2025",
              label: "Major",
              category: "Major",
              requiredCredits: 70,
              requiredCourseTitles: ["Operating Systems"],
              status: "confirmed",
              note: "2025 cohort",
            },
          ],
        },
        {
          department: "All departments",
          admissionYear: 2023,
          sourceTitle: "Common liberal requirements",
          sourceUrl: "https://example.test/common/2023",
          rules: [
            {
              requirementKey: "common-liberal-2023",
              label: "Common Liberal",
              category: "Common Liberal",
              requiredCredits: 17,
              requiredCourseTitles: ["English 1"],
              status: "confirmed",
              note: "Common 2023 cohort",
            },
          ],
        },
      ],
    },
  });

  assert.match(html, /Operating Systems/);
  assert.match(html, /English 1/);
  assert.doesNotMatch(html, /Legacy Systems/);
  assert.doesNotMatch(html, /2024 cohort/);
});

test("graduation filters source-level cohort ranges without rule appliesTo", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    title: "Graduation Roadmap",
    rawData: {
      query: {
        department: "Physics",
        admissionYear: 2025,
      },
      items: [
        {
          department: "Natural Science 2018-2024 cohort",
          admissionYear: 2018,
          sourceTitle: "Natural Science 2018-2024 cohort requirements",
          sourceUrl: "https://example.test/natural-science/2018-2024",
          rules: [
            {
              requirementKey: "legacy-natural-science",
              label: "Major",
              category: "Major",
              requiredCredits: 63,
              requiredCourseTitles: ["Legacy Lab"],
              status: "confirmed",
              note: "legacy cohort",
            },
          ],
        },
        {
          department: "Physics",
          admissionYear: 2025,
          sourceTitle: "Physics 2025+ requirements unavailable",
          sourceUrl: "https://example.test/physics/2025",
          rules: [
            {
              requirementKey: "official-graduation-requirements-unprovided-2025",
              label: "Official graduation requirements",
              category: "Official graduation requirements",
              status: "unprovided",
              note: "2025 cohort is unavailable",
            },
          ],
        },
      ],
    },
  });

  assert.match(html, /Physics 2025\+ requirements unavailable/);
  assert.match(html, /2025 cohort is unavailable/);
  assert.doesNotMatch(html, /Natural Science 2018-2024 cohort requirements/);
  assert.doesNotMatch(html, /Legacy Lab/);
  assert.doesNotMatch(html, /legacy cohort/);
});

test("graduation filters official requirements by expected graduation term before rendering", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    title: "졸업 로드맵",
    rawData: {
      query: {
        department: "화학공학전공",
        admissionYear: 2024,
        expectedGraduationTerm: "2027-02",
      },
      items: [
        {
          department: "화학공학전공",
          admissionYear: 2024,
          sourceTitle: "화학공학전공 교과과정",
          sourceUrl: "https://www.mju.ac.kr/mjukr/759/subview.do",
          rules: [
            {
              requirementKey: "foundational-2027-aug",
              label: "학문기초교양",
              category: "학문기초교양",
              requiredCredits: 24,
              requiredCourseTitles: ["화학실험2"],
              appliesTo: { graduationTermFrom: "2027-08" },
              status: "confirmed",
              note: "2027년 8월 이후 기준",
            },
            {
              requirementKey: "foundational-before-2027-aug",
              label: "학문기초교양",
              category: "학문기초교양",
              requiredCredits: 15,
              requiredCourseTitles: ["공학수학1"],
              appliesTo: { graduationTermTo: "2027-02" },
              status: "confirmed",
              note: "2027년 2월 이전 기준",
            },
          ],
        },
      ],
    },
  });

  assert.match(html, /졸업예정 2027-02/);
  assert.match(html, /15학점 부족/);
  assert.match(html, /2027년 2월 이전 기준/);
  assert.doesNotMatch(html, /24학점 부족/);
  assert.doesNotMatch(html, /2027년 8월 이후 기준/);
});

test("graduation infers admission year from MSI-style student number", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    title: "졸업 로드맵",
    rawData: {
      department: "컴퓨터공학전공",
      학번: "TEST-99241234",
      items: [
        {
          department: "컴퓨터공학전공",
          admissionYear: 2025,
          sourceTitle: "컴퓨터공학전공 2025 기준",
          sourceUrl: "https://www.mju.ac.kr/mjukr/808/subview.do",
          rules: [
            {
              requirementKey: "major-credit-2025",
              label: "전공",
              category: "전공",
              requiredCredits: 70,
              requiredCourseTitles: ["운영체제"],
              appliesTo: { admissionYearFrom: 2025 },
              status: "confirmed",
              note: "2025학번 기준",
            },
          ],
        },
        {
          department: "컴퓨터공학전공",
          admissionYear: 2024,
          sourceTitle: "컴퓨터공학전공 2024 기준",
          sourceUrl: "https://cs.mju.ac.kr/cs/10763/subview.do",
          rules: [
            {
              requirementKey: "major-credit-2024",
              label: "전공",
              category: "전공",
              requiredCredits: 66,
              requiredCourseTitles: ["자료구조"],
              appliesTo: { admissionYearFrom: 2024, admissionYearTo: 2024 },
              status: "confirmed",
              note: "2024학번 기준",
            },
          ],
        },
      ],
    },
  });

  assert.match(html, /2024학번/);
  assert.match(html, /학번 기준 판별/);
  assert.match(html, /2024학번 기준/);
  assert.doesNotMatch(html, /2025학번 기준/);
});

test("graduation accepts snake_case student number aliases for cohort filtering", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    title: "Graduation Roadmap",
    rawData: {
      query: {
        department: "Computer Engineering",
        student_number: "TEST-99241234",
      },
      items: [
        {
          department: "Computer Engineering",
          admissionYear: 2025,
          sourceTitle: "Computer Engineering 2025",
          sourceUrl: "https://www.mju.ac.kr/mjukr/808/subview.do",
          rules: [
            {
              requirementKey: "major-credit-2025",
              label: "Major 2025",
              category: "Major",
              requiredCredits: 70,
              requiredCourseTitles: ["AI Capstone"],
              appliesTo: { admissionYearFrom: 2025 },
              status: "confirmed",
              note: "2025 cohort",
            },
          ],
        },
        {
          department: "Computer Engineering",
          admissionYear: 2024,
          sourceTitle: "Computer Engineering 2024",
          sourceUrl: "https://cs.mju.ac.kr/cs/10763/subview.do",
          rules: [
            {
              requirementKey: "major-credit-2024",
              label: "Major 2024",
              category: "Major",
              requiredCredits: 66,
              requiredCourseTitles: ["Data Structures"],
              appliesTo: { admissionYearFrom: 2024, admissionYearTo: 2024 },
              status: "confirmed",
              note: "2024 cohort",
            },
          ],
        },
      ],
    },
  });

  assert.match(html, /2024학번/);
  assert.match(html, /학번 기준 판별/);
  assert.doesNotMatch(html, /학번 기준 판별 기준/);
  assert.match(html, /Data Structures/);
  assert.doesNotMatch(html, /AI Capstone/);
});

test("graduation keeps 2025 unavailable department stubs separated from earlier cohorts", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    title: "졸업 로드맵",
    rawData: {
      query: {
        department: "물리학과",
        studentNumber: "TEST-99251234",
        studentNumberProvided: true,
      },
      items: [
        {
          department: "2018-2024학번 자연과학 공통",
          admissionYear: 2018,
          sourceTitle: "명지대학교 졸업요건 2018학년도~2024학년도 입학생",
          sourceUrl: "https://www.mju.ac.kr/mjukr/473/subview.do",
          rules: [
            {
              requirementKey: "natural-science-legacy-major",
              label: "전공",
              category: "전공",
              requiredCredits: 63,
              appliesTo: { admissionYearFrom: 2018, admissionYearTo: 2024 },
              status: "confirmed",
              note: "2018~2024학번 자연과학 공통 학점표 기준",
            },
          ],
        },
        {
          department: "물리학과",
          admissionYear: 2025,
          sourceTitle: "명지대학교 졸업요건 2025학번 이후",
          sourceUrl: "https://www.mju.ac.kr/mjukr/473/subview.do",
          rules: [
            {
              requirementKey: "official-graduation-requirements-unprovided-2025",
              label: "공식 졸업요건",
              category: "공식 졸업요건",
              appliesTo: { admissionYearFrom: 2025 },
              status: "unprovided",
              note: "2025학번 물리학과의 영역별 졸업요건 세부 기준은 공식 source에서 미제공 상태로 표시",
            },
          ],
        },
      ],
    },
  });

  assert.match(html, /학과 물리학과/);
  assert.match(html, /2025학번/);
  assert.match(html, /학번 기준 판별/);
  assert.match(html, /공식 졸업요건/);
  assert.match(html, /미제공 상태로 표시/);
  assert.match(html, /class="grad-course-status unprovided">미제공/);
  assert.match(html, /공식 출처: 명지대학교 졸업요건 2025학번 이후/);
  assert.doesNotMatch(html, /2018~2024학번 자연과학 공통/);
});

test("graduation renders official course groups for alternative and pick-N requirements", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    title: "졸업 로드맵",
    rawData: {
      items: [
        {
          id: 4,
          department: "전기공학전공",
          admissionYear: 2024,
          sourceKind: "department_page",
          sourceTitle: "명지대학교 전기공학전공 교과과정",
          sourceUrl: "https://www.mju.ac.kr/mjukr/745/subview.do",
          sourceRetrievedAt: "2026-05-23T00:00:00.000Z",
          rules: [
            {
              requirementKey: "foundational-liberal-credit",
              label: "학문기초교양",
              category: "학문기초교양",
              requiredCredits: 25,
              programTrack: "비인증",
              courseGroups: [
                {
                  groupKey: "science-lab",
                  label: "실험",
                  requiredCredits: 1,
                  minCourses: 1,
                  requiredCourseTitles: ["물리학실험1", "물리학실험2", "일반화학실험"],
                  note: "중 택1",
                },
              ],
              status: "confirmed",
              note: "2024학년도 이후 입학생 기준",
            },
          ],
        },
      ],
    },
  });

  assert.match(html, /실험: 물리학실험1, 물리학실험2, 일반화학실험/);
  assert.match(html, /비인증 · 택 1개 · 중 택1/);
  assert.match(html, /1학점/);
});

test("graduation marks pick-N course groups completed from taken course details", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      creditGaps: [
        {
          label: "학문기초교양",
          earned: 19,
          required: 25,
          gap: 6,
          detailCourses: [
            { courseTitle: "물리학실험1", credits: 1, status: "completed", note: "2024 1학기" },
          ],
        },
      ],
      requirementSources: [
        {
          sourceTitle: "명지대학교 전기공학전공 교과과정",
          sourceUrl: "https://www.mju.ac.kr/mjukr/745/subview.do",
          rules: [
            {
              requirementKey: "foundational-liberal-credit",
              label: "학문기초교양",
              category: "학문기초교양",
              requiredCredits: 25,
              programTrack: "비인증",
              courseGroups: [
                {
                  groupKey: "science-lab",
                  label: "실험",
                  requiredCredits: 1,
                  minCourses: 1,
                  requiredCourseTitles: ["물리학실험1", "물리학실험2", "일반화학실험"],
                  note: "중 택1",
                },
              ],
              status: "confirmed",
              note: "2024학년도 이후 입학생 기준",
            },
          ],
        },
      ],
    },
  });

  assert.match(graduationCourseRowHtml(html, "물리학실험1"), /class="grad-course-status completed">이수/);
  assert.doesNotMatch(html, /실험: 물리학실험1, 물리학실험2, 일반화학실험/);
});

test("graduation resolves alternative English groups when one sequence is completed", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      creditGaps: [
        {
          label: "공통교양",
          earned: 17,
          required: 17,
          gap: 0,
          detailCourses: [
            { courseTitle: "영어3", credits: 2, status: "completed", note: "2024 1학기" },
            { courseTitle: "영어4", credits: 2, status: "completed", note: "2024 2학기" },
          ],
        },
      ],
      requirementSources: [
        {
          sourceTitle: "명지대학교 방목기초교육대학 공통교양",
          sourceUrl: "https://www.mju.ac.kr/bangmok/1649/subview.do",
          rules: [
            {
              requirementKey: "common-liberal-english-2023-plus",
              label: "공통교양 언어(영어)",
              category: "공통교양",
              courseGroups: [
                {
                  groupKey: "english-basic",
                  label: "영어 기본",
                  requiredCredits: 4,
                  minCourses: 2,
                  requiredCourseTitles: ["영어1", "영어2"],
                  groupType: "alternative",
                  alternativeGroup: "english-sequence",
                  note: "영어1, 영어2 이수",
                },
                {
                  groupKey: "english-advanced",
                  label: "영어 심화",
                  requiredCredits: 4,
                  minCourses: 2,
                  requiredCourseTitles: ["영어3", "영어4"],
                  groupType: "alternative",
                  alternativeGroup: "english-sequence",
                  note: "영어3, 영어4 이수",
                },
              ],
              status: "confirmed",
              note: "영어 대체군 기준",
            },
          ],
        },
      ],
    },
  });

  assert.match(graduationCourseRowHtml(html, "영어3"), /class="grad-course-status completed">이수/);
  assert.match(graduationCourseRowHtml(html, "영어4"), /class="grad-course-status completed">이수/);
  assert.doesNotMatch(html, /영어 심화: 영어3, 영어4/);
  assert.doesNotMatch(html, /영어 기본: 영어1, 영어2/);
});

test("graduation shows remaining courses for partially completed groups", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      creditGaps: [
        {
          label: "공통교양",
          earned: 2,
          required: 4,
          gap: 2,
          detailCourses: [
            { courseTitle: "영어1", credits: 2, status: "completed", note: "2024 1학기" },
          ],
        },
      ],
      requirementSources: [
        {
          sourceTitle: "명지대학교 방목기초교육대학 공통교양",
          sourceUrl: "https://www.mju.ac.kr/bangmok/1649/subview.do",
          rules: [
            {
              requirementKey: "common-liberal-english-basic",
              label: "공통교양 언어(영어)",
              category: "공통교양",
              courseGroups: [
                {
                  groupKey: "english-basic",
                  label: "영어 기본",
                  requiredCredits: 4,
                  minCourses: 2,
                  requiredCourseTitles: ["영어1", "영어2"],
                  note: "영어1, 영어2 이수",
                },
              ],
              status: "confirmed",
              note: "영어 기본 기준",
            },
          ],
        },
      ],
    },
  });

  const groupRow = graduationCourseRowHtml(html, "영어 기본: 영어1, 영어2");
  assert.match(groupRow, /1\/2개 이수/);
  assert.match(groupRow, /필요: 영어2/);
  assert.match(groupRow, /class="grad-course-status missing">미수강/);
});

test("graduation matches grouped requirements by paired course code without double counting", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      creditGaps: [
        {
          label: "학문기초교양",
          earned: 1,
          required: 1,
          gap: 0,
          detailCourses: [
            { courseTitle: "물리학실험2", courseCode: "PHY102", credits: 1, status: "completed", note: "2025 1학기" },
          ],
        },
      ],
      requirementSources: [
        {
          sourceTitle: "명지대학교 전기공학전공 교과과정",
          sourceUrl: "https://www.mju.ac.kr/mjukr/745/subview.do",
          rules: [
            {
              requirementKey: "science-lab",
              label: "학문기초교양 실험",
              category: "학문기초교양",
              courseGroups: [
                {
                  groupKey: "science-lab",
                  label: "실험",
                  requiredCredits: 1,
                  minCourses: 1,
                  requiredCourseCodes: ["PHY101", "PHY102"],
                  requiredCourseTitles: ["물리학실험1", "물리학실험2"],
                  note: "중 택1",
                },
              ],
              status: "confirmed",
            },
          ],
        },
      ],
    },
  });

  assert.match(graduationCourseRowHtml(html, "PHY102 - 물리학실험2"), /class="grad-course-status completed">이수/);
  assert.doesNotMatch(html, /실험: 물리학실험1, 물리학실험2/);
});

test("graduation filters foreign-only course groups by student type", () => {
  const rawData = {
    query: {
      department: "Computer Engineering",
      admissionYear: 2024,
    },
    requirementSources: [
      {
        sourceTitle: "Common liberal requirements",
        sourceUrl: "https://www.mju.ac.kr/bangmok/1649/subview.do",
        rules: [
          {
            requirementKey: "common-liberal-language",
            label: "Language requirements",
            category: "Common liberal",
            courseGroups: [
              {
                groupKey: "english-basic",
                label: "English basic",
                requiredCredits: 4,
                minCourses: 2,
                requiredCourseTitles: ["English 1", "English 2"],
              },
              {
                groupKey: "korean-basic-foreign",
                label: "Korean basic",
                requiredCredits: 4,
                minCourses: 2,
                requiredCourseTitles: ["Korean 1", "Korean 2"],
                appliesTo: { studentType: "foreign" },
              },
            ],
            status: "confirmed",
          },
        ],
      },
    ],
  };

  const domesticHtml = renderViewHtml({
    ...graduationEntry(),
    rawData,
  });
  assert.match(domesticHtml, /English basic: English 1, English 2/);
  assert.doesNotMatch(domesticHtml, /Korean basic: Korean 1, Korean 2/);

  const foreignHtml = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      ...rawData,
      query: {
        ...rawData.query,
        studentType: "foreign",
      },
    },
  });
  assert.match(foreignHtml, /English basic: English 1, English 2/);
  assert.match(foreignHtml, /Korean basic: Korean 1, Korean 2/);
});

test("graduation filters course groups by inferred admission year", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      query: {
        department: "Computer Engineering",
        studentNumber: "TEST-99241234",
        expectedGraduationTerm: "2027-02",
      },
      requirementSources: [
        {
          admissionYear: 2023,
          sourceTitle: "Computer Engineering requirements",
          sourceUrl: "https://www.mju.ac.kr/mjukr/808/subview.do",
          rules: [
            {
              requirementKey: "language-track",
              label: "Language",
              category: "Common liberal",
              courseGroups: [
                {
                  groupKey: "legacy-track",
                  label: "Legacy group",
                  requiredCourseTitles: ["Legacy Course"],
                  appliesTo: { admissionYearTo: 2024, graduationTermTo: "2027-02" },
                },
                {
                  groupKey: "future-track",
                  label: "Future group",
                  requiredCourseTitles: ["Future Course"],
                  appliesTo: { admissionYearFrom: 2025 },
                },
                {
                  groupKey: "late-track",
                  label: "Late group",
                  requiredCourseTitles: ["Late Course"],
                  appliesTo: { graduationTermFrom: "2027-08" },
                },
              ],
              status: "confirmed",
            },
          ],
        },
      ],
    },
  });

  assert.match(html, /Legacy group: Legacy Course/);
  assert.doesNotMatch(html, /Future group: Future Course/);
  assert.doesNotMatch(html, /Late group: Late Course/);
});

test("graduation renders official choice groups as user-selected fixed tracks", () => {
  const choiceGroups = [
    {
      key: "english-track",
      label: "English track",
      required: true,
      sourceTitle: "Bangmok common liberal English requirements",
      sourceUrl: "https://www.mju.ac.kr/bangmok/1649/subview.do",
      options: [
        { key: "basic", label: "English 1/2", courseGroupKeys: ["english-basic"] },
        { key: "advanced", label: "English 3/4", courseGroupKeys: ["english-advanced"] },
      ],
    },
  ];
  const creditGaps = [
    {
      label: "Common Liberal",
      earned: 0,
      required: 6,
      gap: 6,
      requiredCourses: [
        {
          courseTitle: "Basic English: English 1, English 2",
          category: "Common Liberal",
          groupKey: "english-basic",
          groupRequiredCourseTitles: ["English 1", "English 2"],
          groupMinCourses: 2,
        },
        {
          courseTitle: "Advanced English: English 3, English 4",
          category: "Common Liberal",
          groupKey: "english-advanced",
          groupRequiredCourseTitles: ["English 3", "English 4"],
          groupMinCourses: 2,
        },
      ],
    },
  ];

  const unselectedHtml = renderViewHtml({
    ...graduationEntry(),
    rawData: { choiceGroups, creditGaps },
  });
  assert.match(unselectedHtml, /data-graduation-choice-option="english-track"/);
  assert.doesNotMatch(unselectedHtml, /class="choice-source-list"/);
  assert.match(unselectedHtml, /data-grad-choice-prompt="true"/);
  assert.match(graduationCourseRowHtml(unselectedHtml, "Basic English: English 1, English 2"), /hidden/);
  assert.match(graduationCourseRowHtml(unselectedHtml, "Advanced English: English 3, English 4"), /hidden/);
  assert.doesNotMatch(unselectedHtml, /recommended/i);

  const selectedHtml = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      choiceGroups,
      graduationSelectedChoiceKeys: { "english-track": "advanced" },
      creditGaps,
    },
  });
  const basicRow = graduationCourseRowHtml(selectedHtml, "Basic English: English 1, English 2");
  const advancedRow = graduationCourseRowHtml(selectedHtml, "Advanced English: English 3, English 4");
  assert.match(basicRow, /hidden/);
  assert.doesNotMatch(advancedRow, /hidden/);
  assert.match(advancedRow, /data-grad-choice-option-row="advanced"/);
});

test("graduation collapses large major course lists in batches without hiding official sources", () => {
  const detailCourses = Array.from({ length: 12 }, (_, index) => ({
    courseTitle: `Major elective ${String(index + 1).padStart(2, "0")}`,
    category: "Major Elective",
    credits: 3,
    status: "missing",
  }));
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      creditGaps: [
        {
          label: "Major Elective",
          earned: 0,
          required: 36,
          gap: 36,
          detailCourses,
          sourceTitle: "Official major requirements",
          sourceUrl: "https://cs.mju.ac.kr/cs/10763/subview.do",
        },
      ],
    },
  });

  assert.match(html, /data-grad-more/);
  assert.match(html, /\[hidden\]\s*\{\s*display:\s*none !important;/);
  assert.match(html, /\.grad-course-detail-row\[hidden\]\s*\{\s*display:\s*none !important;/);
  assert.match(html, /10개 더보기/);
  assert.doesNotMatch(graduationCourseRowHtml(html, "Major elective 10"), /hidden/);
  assert.match(graduationCourseRowHtml(html, "Major elective 11"), /hidden/);
  assert.match(graduationCourseRowHtml(html, "Major elective 12"), /hidden/);
  assert.match(html, /class="grad-area-source"/);
  assert.equal(countOccurrences(html, 'href="https://cs.mju.ac.kr/cs/10763/subview.do"'), 1);
});

test("graduation collapses large non-major area course lists in batches", () => {
  const detailCourses = Array.from({ length: 12 }, (_, index) => ({
    courseTitle: `Common liberal ${String(index + 1).padStart(2, "0")}`,
    category: "공통교양",
    credits: 2,
    status: "completed",
  }));
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      creditGaps: [
        {
          label: "공통교양",
          earned: 24,
          required: 17,
          gap: 0,
          detailCourses,
        },
      ],
    },
  });

  assert.match(html, /data-grad-more/);
  assert.match(html, /10개 더보기/);
  assert.doesNotMatch(graduationCourseRowHtml(html, "Common liberal 10"), /hidden/);
  assert.match(graduationCourseRowHtml(html, "Common liberal 11"), /hidden/);
  assert.match(graduationCourseRowHtml(html, "Common liberal 12"), /hidden/);
});

test("graduation merges requirement rules from every source array", () => {
  const html = renderViewHtml({
    ...graduationEntry(),
    rawData: {
      department: "컴퓨터공학전공",
      admissionYear: 2021,
      creditGaps: [
        { label: "전공", earned: 0, required: 3, gap: 3 },
        { label: "공통교양", earned: 0, required: 3, gap: 3 },
      ],
      requirementSources: [
        {
          department: "컴퓨터공학전공",
          admissionYear: 2021,
          sourceTitle: "학과 졸업요건",
          sourceUrl: "https://cs.mju.ac.kr/cs/10763/subview.do",
          rules: [
            {
              requirementKey: "major-required",
              label: "전공",
              category: "전공",
              requiredCourseTitles: ["캡스톤디자인"],
              status: "confirmed",
            },
          ],
        },
      ],
      graduationRequirementSources: [
        {
          department: "공통교양",
          admissionYear: 2020,
          sourceTitle: "공통교양 졸업요건",
          sourceUrl: "https://www.mju.ac.kr/bangmok/1649/subview.do",
          rules: [
            {
              requirementKey: "common-writing",
              label: "공통교양",
              category: "공통교양",
              requiredCourseTitles: ["글쓰기"],
              status: "confirmed",
            },
          ],
        },
      ],
    },
  });

  assert.match(graduationAreaCardHtml(html, "전공"), /캡스톤디자인/);
  assert.match(graduationAreaCardHtml(html, "공통교양"), /글쓰기/);
});

test("graduation omits the generic AI summary even when an AI response exists", () => {
  const html = renderViewHtml(graduationEntry());

  assert.doesNotMatch(html, /class="briefing/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER_GRADUATION_AI/);
});
