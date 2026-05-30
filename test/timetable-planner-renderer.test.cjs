const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildTimetablePlannerModel,
  generateTimetableSchedule,
  hasPlannerConflict,
  normalizePlannerMeeting,
  parsePlannerTimeRange,
  renderViewHtml,
} = require("../dist/view-renderer.js");

function plannerEntry(rawData) {
  return {
    id: "planner-test-view",
    dataType: "timetable-planner",
    title: "Planner",
    summary: "",
    aiResponse: "**SHOULD_NOT_RENDER_PLANNER_AI**",
    createdAt: new Date("2026-05-03T08:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-03T08:30:00.000Z").getTime(),
    rawData,
  };
}

function catalog() {
  return {
    majorCount: 2,
    electiveCount: 1,
    entries: [
      { courseTitle: "Civil Procedure", category: "major", gradeLevel: "1학년", credit: 3, meetings: [{ dayOfWeek: 1, startTime: "09:00", endTime: "10:15", location: "Y5441" }, { dayOfWeek: 2, startTime: "09:00", endTime: "09:50" }] },
      { courseTitle: "Contracts", categoryLabel: "Major Core", gradeLevel: "2학년", credit: 3, meetings: [{ weekday: "Tue", rawTime: "10:30~11:45" }] },
      { courseTitle: "Legal Writing", category: "liberal", gradeLevel: "전학년", credit: 2, meetings: [{ day: "Wed", rawTime: "13:00-14:15" }] },
      { courseTitle: "Mystery Seminar", category: "unknown", gradeLevel: "4학년", credit: 1, meetings: [{ dayLabel: "Thu", rawTime: "15:00–16:00" }] },
    ],
  };
}

test("timetable planner renders controls, button, and the interactive calendar", () => {
  const html = renderViewHtml(plannerEntry(catalog()));
  const bodyHtml = html.slice(html.indexOf("</style>"));

  assert.match(html, /시간표 설계/);
  assert.match(html, /data-planner-count="major"/);
  assert.match(html, /data-planner-count="elective"/);
  assert.match(html, /data-planner-generate/);
  assert.match(html, /data-planner-day="4"/);
  assert.match(html, /data-planner-day="5"/);
  assert.match(html, /data-planner-period="0"/);
  assert.match(html, /data-planner-period="10"/);
  assert.match(html, /data-planner-grade="1학년"/);
  assert.match(html, /학년 제외/);
  assert.doesNotMatch(html, /학년 선택/);
  assert.match(html, /세부 카테고리 설정/);
  assert.match(html, /planner-count-grid/);
  assert.match(html, /planner-status-sr/);
  assert.doesNotMatch(html, /class="planner-status"/);
  assert.match(html, /data-course-id=/);
  assert.match(html, /무작위 시간표 만들기/);
  assert.match(html, /좌클릭 잠금/);
  assert.match(html, /우클릭 제거/);
  assert.match(html, /검색으로 직접 추가/);
  assert.match(html, /data-planner-search/);
  assert.match(html, /data-planner-add/);
  assert.match(html, /safePlannerJson/);
  assert.match(html, /normalizePlannerCourses/);
  assert.match(html, /generateButton/);
  assert.match(html, /data-planner-step="major"/);
  assert.doesNotMatch(html, /type="number"/);
  assert.match(html, /학점/);
  assert.match(html, /planner-calendar/);
  assert.match(html, /planner-calendar-block/);
  assert.match(html, /Civil Procedure\(3\)/);
  assert.match(html, /Y5441/);
  assert.doesNotMatch(html, /Y5441\(/);
  const civilBlock = html.match(/<button class="planner-calendar-block"[\s\S]*?<strong>Civil Procedure\(3\)<\/strong>[\s\S]*?<\/button>/)?.[0] ?? "";
  assert.ok(civilBlock);
  assert.doesNotMatch(civilBlock, /3학점/);
  const civilColors = [...html.matchAll(/--planner-block:([^"]+)"[^>]*><strong>Civil Procedure\(3\)<\/strong>/g)].map((match) => match[1]);
  const contractColor = html.match(/--planner-block:([^"]+)"[^>]*><strong>Contracts\(3\)<\/strong>/)?.[1];
  assert.equal(civilColors.length, 2);
  assert.equal(new Set(civilColors).size, 1);
  assert.ok(contractColor);
  assert.notEqual(contractColor, civilColors[0]);
  assert.match(html, /initialCourseIds/);
  assert.doesNotMatch(bodyHtml, /planner-pools/);
  assert.match(html, /월/);
  assert.match(html, /Civil Procedure/);
  assert.match(html, /Contracts/);
  assert.match(html, /Legal Writing/);
  assert.match(html, /미분류/);
  assert.match(html, /Mystery Seminar/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER_PLANNER_AI/);
});

test("timetable planner keeps course catalog query context", () => {
  const rawData = {
    query: {
      year: 2026,
      termCode: "10",
      category: "major",
    },
    items: [
      { courseTitle: "AI Programming", category: "major", credit: 3, meetings: [{ dayOfWeek: 1, rawTime: "09:00-09:50" }] },
    ],
  };
  const model = buildTimetablePlannerModel(rawData);
  const html = renderViewHtml(plannerEntry(rawData));

  assert.match(model.queryMeta, /2026학년도/);
  assert.match(model.queryMeta, /1학기/);
  assert.match(model.queryMeta, /분류 전공/);
  assert.match(html, /2026학년도/);
  assert.match(html, /1학기/);
  assert.match(html, /분류 전공/);
});

test("timetable planner hides curriculum codes from category labels", () => {
  const model = buildTimetablePlannerModel({
    entries: [
      { courseTitle: "글쓰기", category: "elective", categoryLabel: "KMA02101", credit: 3, meetings: [{ dayOfWeek: 1, rawTime: "09:00-09:50" }] },
      { courseTitle: "분류누락", category: "KMR02638", credit: 3, meetings: [{ dayOfWeek: 2, rawTime: "10:00-10:50" }] },
    ],
  });

  assert.equal(model.courses[0].categoryLabel, "교양/선택");
  assert.equal(model.courses[1].categoryLabel, "미분류");
  assert.equal(model.categoryTargets.some((target) => /KMA|KMR/.test(target.label)), false);
});

test("timetable planner only regenerates from the randomize button", () => {
  const html = renderViewHtml(plannerEntry(catalog()));

  assert.match(html, /generateButton\.addEventListener\("click", \(\) => generate\(true\)\)/);
  assert.doesNotMatch(html, /generate\(false\)/);
  assert.doesNotMatch(html, /잠금 ' \+ lockedCourseIds\.size/);
  assert.match(html, /renderAvailabilityChange\('제외 요일을 현재 시간표에 반영했습니다/);
  assert.match(html, /closest\("\.planner-calendar-block\[data-course-id\]"\)/);
  assert.match(html, /addEventListener\("contextmenu"/);
  assert.match(html, /removeCourse\(course\)/);
});

test("timetable planner prunes filtered unlocked courses and protects locked courses", () => {
  const html = renderViewHtml(plannerEntry(catalog()));

  assert.match(html, /const pruneUnavailableUnlockedCourses = \(\) =>/);
  assert.match(html, /currentCourseIds\.delete\(course\.id\)/);
  assert.match(html, /guardLockedAvailability\(nextDays, disabledPeriods, disabledGrades\)/);
  assert.match(html, /먼저 잠금을 해제하세요/);
  assert.match(html, /조건에서 벗어난 ' \+ removed \+ '개 과목을 시간표에서 뺐습니다/);
});

test("timetable planner keeps classroom locations unexpanded", () => {
  const html = renderViewHtml(plannerEntry({
    showAllCourses: true,
    entries: [
      { courseTitle: "Student Hall", category: "major", meetings: [{ dayOfWeek: 1, rawTime: "09:00-09:50", location: "S2808" }] },
      { courseTitle: "Engineering Lecture", category: "major", meetings: [{ dayOfWeek: 2, rawTime: "10:00-10:50", location: "Y5219" }] },
      { courseTitle: "Bangmok Conference", category: "elective", meetings: [{ dayOfWeek: 3, rawTime: "11:00-11:50", location: "S9114" }] },
      { courseTitle: "MCC Lecture", category: "elective", meetings: [{ dayOfWeek: 4, rawTime: "12:00-12:50", location: "10311" }] },
      { courseTitle: "Semiconductor Lab", category: "major", meetings: [{ dayOfWeek: 5, rawTime: "13:00-13:50", location: "Y17704" }] },
      { courseTitle: "Basketball", category: "elective", meetings: [{ dayOfWeek: 1, rawTime: "14:00-14:50", location: "Y7100" }] },
    ],
  }));

  assert.match(html, /S2808/);
  assert.match(html, /Y5219/);
  assert.match(html, /S9114/);
  assert.match(html, /10311/);
  assert.doesNotMatch(html, /S2808\(/);
  assert.doesNotMatch(html, /Y5219\(/);
  assert.doesNotMatch(html, /S9114\(/);
  assert.doesNotMatch(html, /10311\(/);
  assert.match(html, /Y17704/);
  assert.doesNotMatch(html, /Y17704\(/);
  assert.match(html, /Y7100/);
  assert.doesNotMatch(html, /Y7100\(/);
});

test("timetable planner builds a conflict-free schedule and excludes unknown from counts", () => {
  const model = buildTimetablePlannerModel(catalog());

  assert.equal(model.majorAvailable, 2);
  assert.equal(model.electiveAvailable, 1);
  assert.equal(model.unknownCourses.length, 1);
  assert.deepEqual(model.gradeFilters.map((grade) => grade.label), ["1학년", "2학년", "4학년", "전학년"]);
  assert.equal(model.initialSchedule.length, 3);
  for (let i = 0; i < model.initialSchedule.length; i++) {
    const rest = model.initialSchedule.slice(0, i);
    assert.equal(hasPlannerConflict(model.initialSchedule[i], rest), false);
  }
});

test("timetable planner excludes already completed courses from random candidates", () => {
  const rawData = {
    majorCount: 2,
    electiveCount: 0,
    completedCourses: [{ courseTitle: "Completed-Major", courseCode: "CSE101" }],
    entries: [
      { courseTitle: "Completed Major", courseCode: "CSE101", category: "major", credit: 3, meetings: [{ dayOfWeek: 1, rawTime: "09:00-09:50" }] },
      { courseTitle: "Open Major A", courseCode: "CSE102", category: "major", credit: 3, meetings: [{ dayOfWeek: 2, rawTime: "10:00-10:50" }] },
      { courseTitle: "Open Major B", courseCode: "CSE103", category: "major", credit: 3, meetings: [{ dayOfWeek: 3, rawTime: "11:00-11:50" }] },
    ],
  };
  const model = buildTimetablePlannerModel(rawData);
  const html = renderViewHtml(plannerEntry(rawData));

  assert.equal(model.completedExcludedCount, 1);
  assert.equal(model.courses.some((course) => course.title === "Completed Major"), false);
  assert.equal(model.initialSchedule.length, 2);
  assert.doesNotMatch(html, /<strong>Completed Major<\/strong>/);
  assert.match(html, /이수\/수강 중 제외/);
});

test("timetable planner reports no solution when requested courses all conflict", () => {
  const rawData = {
    majorCount: 2,
    electiveCount: 0,
    entries: [
      { courseTitle: "Major A", category: "major", meetings: [{ dayOfWeek: 1, rawTime: "09:00-10:30" }] },
      { courseTitle: "Major B", category: "major", meetings: [{ dayOfWeek: 1, rawTime: "10:00-11:00" }] },
    ],
  };
  const model = buildTimetablePlannerModel(rawData);
  const html = renderViewHtml(plannerEntry(rawData));

  assert.equal(model.noSolution, true);
  assert.deepEqual(generateTimetableSchedule(model.courses, 2, 0, 1), []);
  assert.match(html, /시간이 겹치지 않는 시간표를 만들 수 없습니다/);
});

test("timetable planner parses tilde, hyphen, and en dash raw time ranges", () => {
  assert.deepEqual(parsePlannerTimeRange("Mon 09:00~10:15"), { start: "09:00", end: "10:15" });
  assert.deepEqual(parsePlannerTimeRange("09:00-10:15"), { start: "09:00", end: "10:15" });
  assert.deepEqual(parsePlannerTimeRange("09:00–10:15"), { start: "09:00", end: "10:15" });
  assert.deepEqual(parsePlannerTimeRange("월 0900~1050"), { start: "09:00", end: "10:50" });

  assert.equal(normalizePlannerMeeting({ weekday: "Mon", rawTime: "09:00~10:15" }).startMinutes, 540);
  assert.equal(normalizePlannerMeeting({ dayOfWeek: 2, rawTimeRange: "09:00~10:15" }).dayLabel, "Tue");
  assert.equal(normalizePlannerMeeting({ dayLabel: "Tue", rawTime: "09:00-10:15" }).endMinutes, 615);
  assert.equal(normalizePlannerMeeting({ rawTime: "Wed 09:00–10:15" }).dayLabel, "Wed");
});

test("timetable planner ignores malformed meeting payloads instead of throwing", () => {
  const model = buildTimetablePlannerModel({
    showAllCourses: true,
    entries: [
      { courseTitle: "Malformed Meetings", category: "major", meetings: "not-an-array" },
      {
        courseTitle: "Mixed Meetings",
        category: "major",
        meetings: [
          null,
          "bad",
          { weekday: "Mon", rawTime: "09:00~09:50", location: "Y5441" },
        ],
      },
    ],
  });

  assert.equal(model.courses.length, 2);
  assert.equal(model.courses.find((course) => course.title === "Malformed Meetings").meetings.length, 0);
  assert.equal(model.courses.find((course) => course.title === "Mixed Meetings").meetings.length, 1);
  assert.equal(normalizePlannerMeeting(null), undefined);
});

test("timetable planner applies disabled days, disabled periods, locks, and category targets", () => {
  const rawData = {
    majorCount: 2,
    electiveCount: 0,
    entries: [
      { courseTitle: "전공필수 A", category: "major", categoryLabel: "전공필수", meetings: [{ dayOfWeek: 1, rawTime: "09:00-09:50" }] },
      { courseTitle: "전공필수 B", category: "major", categoryLabel: "전공필수", meetings: [{ dayOfWeek: 5, rawTime: "09:00-09:50" }] },
      { courseTitle: "전공선택 A", category: "major", categoryLabel: "전공선택", meetings: [{ dayOfWeek: 2, rawTime: "10:00-10:50" }] },
      { courseTitle: "전공선택 B", category: "major", categoryLabel: "전공선택", meetings: [{ dayOfWeek: 3, rawTime: "11:00-11:50" }] },
    ],
  };
  const model = buildTimetablePlannerModel(rawData);
  const locked = model.courses.find((course) => course.title === "전공필수 A");

  const schedule = generateTimetableSchedule(model.courses, 2, 0, 1, {
    disabledDays: [4],
    disabledPeriods: [2],
    lockedCourseIds: [locked.id],
    categoryTargets: [
      { key: "전공필수", label: "전공필수", parentCategory: "major", count: 1, available: 2 },
      { key: "전공선택", label: "전공선택", parentCategory: "major", count: 1, available: 2 },
    ],
  });

  assert.equal(schedule.length, 2);
  assert.equal(schedule.some((course) => course.title === "전공필수 A"), true);
  assert.equal(schedule.some((course) => course.title === "전공필수 B"), false);
  assert.equal(schedule.some((course) => course.title === "전공선택 B"), false);
  assert.equal(schedule.some((course) => course.title === "전공선택 A"), true);
});

test("timetable planner exposes graduation requirement groups as detailed targets", () => {
  const rawData = {
    majorCount: 0,
    electiveCount: 0,
    entries: [
      { courseTitle: "영어3", courseCode: "ENG301", category: "liberal", categoryLabel: "공통교양", credit: 2, meetings: [{ dayOfWeek: 1, rawTime: "09:00-09:50" }] },
      { courseTitle: "영어4", courseCode: "ENG302", category: "liberal", categoryLabel: "공통교양", credit: 2, meetings: [{ dayOfWeek: 2, rawTime: "10:00-10:50" }] },
      { courseTitle: "영어회화", courseCode: "ENG-CV", category: "liberal", categoryLabel: "공통교양", credit: 2, meetings: [{ dayOfWeek: 3, rawTime: "11:00-11:50" }] },
      { courseTitle: "사회봉사", courseCode: "GEN999", category: "liberal", categoryLabel: "공통교양", credit: 1, meetings: [{ dayOfWeek: 4, rawTime: "12:00-12:50" }] },
    ],
    requirementSources: [
      {
        title: "Official common liberal requirements",
        rules: [
          {
            label: "공통교양 언어",
            category: "공통교양",
            courseGroups: [
              {
                groupKey: "english-advanced",
                label: "영어 심화",
                minCourses: 2,
                requiredCourseTitles: ["영어3", "영어4"],
              },
              {
                groupKey: "english-conversation",
                label: "영어 회화",
                minCourses: 1,
                requiredCourseCodes: ["ENG-CV"],
              },
            ],
          },
        ],
      },
    ],
  };
  const model = buildTimetablePlannerModel(rawData);
  const advanced = model.categoryTargets.find((target) => target.label === "영어 심화");
  const conversation = model.categoryTargets.find((target) => target.label === "영어 회화");

  assert.ok(advanced);
  assert.ok(conversation);
  assert.equal(advanced.available, 2);
  assert.equal(conversation.available, 1);
  assert.equal(advanced.parentCategory, "elective");
  assert.deepEqual(model.courses.find((course) => course.title === "영어3").requirementLabels, ["영어 심화"]);
  assert.deepEqual(model.courses.find((course) => course.courseCode === "ENG-CV").requirementLabels, ["영어 회화"]);

  const advancedSchedule = generateTimetableSchedule(model.courses, 0, 0, 1, {
    categoryTargets: [{ ...advanced, count: 2 }],
  });
  assert.deepEqual(advancedSchedule.map((course) => course.title).sort(), []);
  assert.equal(
    hasPlannerConflict(
      model.courses.find((course) => course.title === "영어4"),
      [model.courses.find((course) => course.title === "영어3")],
    ),
    true,
  );

  const conversationSchedule = generateTimetableSchedule(model.courses, 0, 0, 1, {
    categoryTargets: [{ ...conversation, count: 1 }],
  });
  assert.deepEqual(conversationSchedule.map((course) => course.title), ["영어회화"]);
});

test("timetable planner merges requirement targets from every source array", () => {
  const rawData = {
    majorCount: 0,
    electiveCount: 0,
    entries: [
      { courseTitle: "Capstone Design", category: "major", credit: 3, meetings: [{ dayOfWeek: 1, rawTime: "09:00-09:50" }] },
      { courseTitle: "Writing", category: "liberal", credit: 3, meetings: [{ dayOfWeek: 2, rawTime: "10:00-10:50" }] },
    ],
    requirementSources: [
      {
        department: "Computer Engineering",
        admissionYear: 2021,
        rules: [
          {
            label: "Major",
            category: "Major",
            courseGroups: [
              { groupKey: "capstone", label: "Capstone", requiredCourseTitles: ["Capstone Design"], minCourses: 1 },
            ],
          },
        ],
      },
    ],
    graduationRequirementSources: [
      {
        department: "Common Liberal",
        admissionYear: 2020,
        rules: [
          {
            label: "Common Liberal",
            category: "Common Liberal",
            courseGroups: [
              { groupKey: "writing", label: "Writing", requiredCourseTitles: ["Writing"], minCourses: 1 },
            ],
          },
        ],
      },
    ],
  };

  const model = buildTimetablePlannerModel(rawData);
  assert.ok(model.categoryTargets.find((target) => target.label === "Capstone"));
  assert.ok(model.categoryTargets.find((target) => target.label === "Writing"));
  assert.deepEqual(model.courses.find((course) => course.title === "Capstone Design").requirementLabels, ["Capstone"]);
  assert.deepEqual(model.courses.find((course) => course.title === "Writing").requirementLabels, ["Writing"]);
});

test("timetable planner filters graduation requirement targets by inferred student-number cohort", () => {
  const rawData = {
    majorCount: 0,
    electiveCount: 0,
    query: {
      student_no: "TEST-99241234",
    },
    entries: [
      { courseTitle: "English 1", courseCode: "ENG101", category: "liberal", credit: 2, meetings: [{ dayOfWeek: 1, rawTime: "09:00-09:50" }] },
      { courseTitle: "English 3", courseCode: "ENG301", category: "liberal", credit: 2, meetings: [{ dayOfWeek: 2, rawTime: "10:00-10:50" }] },
    ],
    requirementSources: [
      {
        department: "Common liberal 2025",
        admissionYear: 2025,
        rules: [
          {
            label: "English 2025",
            category: "General Education",
            courseGroups: [
              {
                groupKey: "english-advanced",
                label: "Advanced English",
                minCourses: 1,
                requiredCourseTitles: ["English 3"],
                appliesTo: { admissionYearFrom: 2025 },
              },
            ],
          },
        ],
      },
      {
        department: "Common liberal 2024",
        admissionYear: 2024,
        rules: [
          {
            label: "English 2024",
            category: "General Education",
            courseGroups: [
              {
                groupKey: "english-basic",
                label: "Basic English",
                minCourses: 1,
                requiredCourseTitles: ["English 1"],
                appliesTo: { admissionYearFrom: 2024, admissionYearTo: 2024 },
              },
            ],
          },
        ],
      },
    ],
  };

  const model = buildTimetablePlannerModel(rawData);
  assert.equal(model.categoryTargets.some((target) => target.label === "Advanced English"), false);
  assert.ok(model.categoryTargets.find((target) => target.label === "Basic English"));
  assert.deepEqual(model.courses.find((course) => course.title === "English 1").requirementLabels, ["Basic English"]);
  assert.deepEqual(model.courses.find((course) => course.title === "English 3").requirementLabels ?? [], []);
});

test("timetable planner filters by grade and treats different sections of the same course as duplicates", () => {
  const rawData = {
    majorCount: 2,
    electiveCount: 0,
    entries: [
      { courseTitle: "Capstone", courseCode: "CSE401", section: "01", category: "major", gradeLevel: "4학년", professor: "A", meetings: [{ dayOfWeek: 1, rawTime: "09:00-09:50" }] },
      { courseTitle: "Capstone", courseCode: "CSE401", section: "02", category: "major", gradeLevel: "4학년", professor: "B", meetings: [{ dayOfWeek: 2, rawTime: "10:00-10:50" }] },
      { courseTitle: "Algorithms", courseCode: "CSE301", category: "major", gradeLevel: "3학년", meetings: [{ dayOfWeek: 3, rawTime: "11:00-11:50" }] },
      { courseTitle: "Networks", courseCode: "CSE302", category: "major", gradeLevel: "3학년", meetings: [{ dayOfWeek: 4, rawTime: "12:00-12:50" }] },
    ],
  };
  const model = buildTimetablePlannerModel(rawData);
  const capstoneA = model.courses.find((course) => course.section === "01");
  const capstoneB = model.courses.find((course) => course.section === "02");

  assert.ok(capstoneA);
  assert.ok(capstoneB);
  assert.equal(hasPlannerConflict(capstoneA, [capstoneB]), true);
  assert.equal(model.majorAvailable, 3);
  assert.equal(model.gradeFilters.find((grade) => grade.label === "4학년").available, 1);

  const withoutFourthGrade = generateTimetableSchedule(model.courses, 2, 0, 1, {
    disabledGradeKeys: ["4학년"],
  });
  assert.deepEqual(withoutFourthGrade.map((course) => course.title).sort(), ["Algorithms", "Networks"]);

  const schedule = generateTimetableSchedule(model.courses, 4, 0, 1);
  assert.deepEqual(schedule, []);
});

test("timetable planner reports distinct course availability instead of section count", () => {
  const rawData = {
    entries: [
      { courseTitle: "Capstone", courseCode: "CSE401", section: "01", category: "major", gradeLevel: "4학년", meetings: [{ dayOfWeek: 1, rawTime: "09:00-09:50" }] },
      { courseTitle: "Capstone", courseCode: "CSE401", section: "02", category: "major", gradeLevel: "4학년", meetings: [{ dayOfWeek: 2, rawTime: "10:00-10:50" }] },
    ],
  };
  const model = buildTimetablePlannerModel(rawData);
  const html = renderViewHtml(plannerEntry(rawData));

  assert.equal(model.majorAvailable, 1);
  assert.equal(model.majorCount, 1);
  assert.equal(model.categoryTargets.find((target) => target.label === "전공").available, 1);
  assert.match(html, /전공 과목[\s\S]*가능 1개/);
});

test("timetable planner supports Saturday courses with a day toggle and calendar column", () => {
  const rawData = {
    majorCount: 1,
    electiveCount: 0,
    entries: [
      { courseTitle: "Saturday Lab", category: "major", credit: 1, meetings: [{ dayOfWeek: 6, rawTime: "09:00-09:50" }] },
    ],
  };
  const model = buildTimetablePlannerModel(rawData);
  const html = renderViewHtml(plannerEntry(rawData));

  assert.equal(model.initialSchedule.length, 1);
  assert.equal(model.initialSchedule[0].meetings[0].dayIndex, 5);
  assert.match(html, /data-planner-day="5"/);
  assert.match(html, />토<\/span>/);
  assert.match(html, /--planner-days:6/);
  assert.match(html, /Saturday Lab\(1\)/);
});

test("timetable planner fails instead of dropping a locked course disabled by filters", () => {
  const rawData = {
    majorCount: 1,
    electiveCount: 0,
    entries: [
      { courseTitle: "Locked Friday", category: "major", meetings: [{ dayOfWeek: 5, rawTime: "09:00-09:50" }] },
      { courseTitle: "Monday Major", category: "major", meetings: [{ dayOfWeek: 1, rawTime: "10:00-10:50" }] },
    ],
  };
  const model = buildTimetablePlannerModel(rawData);
  const locked = model.courses.find((course) => course.title === "Locked Friday");

  const schedule = generateTimetableSchedule(model.courses, 1, 0, 1, {
    disabledDays: [4],
    lockedCourseIds: [locked.id],
  });

  assert.deepEqual(schedule, []);
});

test("timetable planner can render an unclassified actual timetable snapshot", () => {
  const rawData = {
    showAllCourses: true,
    entries: [
      {
        courseTitle: "Computer Architecture",
        category: "unknown",
        categoryLabel: "MSI timetable",
        meetings: [
          { dayOfWeek: 2, startTime: "15:00", endTime: "16:50" },
          { dayOfWeek: 4, startTime: "15:00", endTime: "15:50" },
        ],
      },
    ],
  };

  const model = buildTimetablePlannerModel(rawData);
  const html = renderViewHtml(plannerEntry(rawData));

  assert.equal(model.showAllCourses, true);
  assert.equal(model.initialSchedule.length, 1);
  assert.equal(model.noSolution, false);
  assert.match(html, /showAllCourses/);
  assert.match(html, /Computer Architecture/);
  assert.match(html, /15:00-16:50/);
  assert.match(html, /15:00-15:50/);
});

test("timetable planner requires official choice selection before generating a track schedule", () => {
  const englishChoice = {
    key: "english-track",
    label: "English track",
    required: true,
    sourceTitle: "Bangmok common liberal English requirements",
    sourceUrl: "https://www.mju.ac.kr/bangmok/1649/subview.do",
    options: [
      {
        key: "basic",
        label: "English 1/2 and Conversation 1/2",
        courseTitles: ["English 1", "English 2", "English Conversation 1", "English Conversation 2"],
      },
      {
        key: "advanced",
        label: "English 3/4 and Conversation 3/4",
        courseTitles: ["English 3", "English 4", "English Conversation 3", "English Conversation 4"],
      },
    ],
  };
  const entries = [
    { courseTitle: "English 1", category: "liberal", credit: 2, meetings: [{ dayOfWeek: 1, rawTime: "09:00-09:50" }] },
    { courseTitle: "English 2", category: "liberal", credit: 2, meetings: [{ dayOfWeek: 2, rawTime: "09:00-09:50" }] },
    { courseTitle: "English Conversation 1", category: "liberal", credit: 1, meetings: [{ dayOfWeek: 3, rawTime: "09:00-09:50" }] },
    { courseTitle: "English Conversation 2", category: "liberal", credit: 1, meetings: [{ dayOfWeek: 4, rawTime: "09:00-09:50" }] },
    { courseTitle: "English 3", category: "liberal", credit: 2, meetings: [{ dayOfWeek: 1, rawTime: "10:00-10:50" }] },
    { courseTitle: "English 4", category: "liberal", credit: 2, meetings: [{ dayOfWeek: 2, rawTime: "10:00-10:50" }] },
    { courseTitle: "English Conversation 3", category: "liberal", credit: 1, meetings: [{ dayOfWeek: 3, rawTime: "10:00-10:50" }] },
    { courseTitle: "English Conversation 4", category: "liberal", credit: 1, meetings: [{ dayOfWeek: 4, rawTime: "10:00-10:50" }] },
    { courseTitle: "Civil Law", category: "major", credit: 3, meetings: [{ dayOfWeek: 5, rawTime: "09:00-09:50" }] },
  ];
  const rawData = {
    showAllCourses: true,
    choiceGroups: [englishChoice],
    entries,
  };

  const blockedModel = buildTimetablePlannerModel(rawData);
  const blockedHtml = renderViewHtml(plannerEntry(rawData));
  assert.equal(blockedModel.choiceBlocked, true);
  assert.deepEqual(blockedModel.initialSchedule, []);
  assert.match(blockedHtml, /data-planner-choice-blocked/);
  assert.match(blockedHtml, /data-planner-choice-option="english-track"/);
  assert.match(blockedHtml, /Bangmok common liberal English requirements/);
  assert.doesNotMatch(blockedHtml, /recommended/i);

  const selectedModel = buildTimetablePlannerModel({
    ...rawData,
    timetableSelectedChoiceKeys: { "english-track": "advanced" },
  });
  assert.equal(selectedModel.choiceBlocked, false);
  assert.deepEqual(
    selectedModel.initialSchedule.map((course) => course.title).filter((title) => title.startsWith("English")).sort(),
    ["English 3", "English 4", "English Conversation 3", "English Conversation 4"],
  );
});

test("timetable planner does not invent official track choices without explicit source data", () => {
  const rawData = {
    showAllCourses: true,
    entries: [
      { courseTitle: "English 1", category: "liberal", credit: 2, meetings: [{ dayOfWeek: 1, rawTime: "09:00-09:50" }] },
      { courseTitle: "English 3", category: "liberal", credit: 2, meetings: [{ dayOfWeek: 2, rawTime: "09:00-09:50" }] },
      { courseTitle: "Civil Law", category: "major", credit: 3, meetings: [{ dayOfWeek: 3, rawTime: "09:00-09:50" }] },
    ],
  };

  const model = buildTimetablePlannerModel(rawData);
  const html = renderViewHtml(plannerEntry(rawData));

  assert.equal(model.choiceBlocked, false);
  assert.deepEqual(model.choiceGroups, []);
  assert.doesNotMatch(html, /data-planner-choice-option="official-english-track"/);
  assert.doesNotMatch(html, /https:\/\/www\.mju\.ac\.kr\/bangmok\/1649\/subview\.do/);
  assert.doesNotMatch(html, /recommended/i);
});

test("timetable planner blocks official English same-semester sequence conflicts", () => {
  const model = buildTimetablePlannerModel({
    showAllCourses: true,
    entries: [
      { courseTitle: "English 1", category: "liberal", credit: 2, meetings: [{ dayOfWeek: 1, rawTime: "09:00-09:50" }] },
      { courseTitle: "English 2", category: "liberal", credit: 2, meetings: [{ dayOfWeek: 2, rawTime: "09:00-09:50" }] },
    ],
    timetableSelectedChoiceKeys: { "official-english-track": "basic-english" },
  });

  assert.equal(hasPlannerConflict(model.courses[1], [model.courses[0]]), true);
  assert.deepEqual(generateTimetableSchedule(model.courses, 0, 2, 1), []);
});
