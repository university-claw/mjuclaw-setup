const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const bashProbe = spawnSync("bash", ["-lc", "command -v node"], {
  encoding: "utf8",
  windowsHide: true,
});
const bashNodePath = (bashProbe.stdout || "").trim();
const bashPlatformProbe = spawnSync("bash", ["-lc", "uname -s"], {
  encoding: "utf8",
  windowsHide: true,
});
const bashPlatform = (bashPlatformProbe.stdout || "").trim();
const isWindowsBash = /^(MINGW|MSYS|CYGWIN)/.test(bashPlatform);
const bashPythonProbe = spawnSync("bash", ["-lc", isWindowsBash ? "command -v python" : "command -v python3 || command -v python"], {
  encoding: "utf8",
  windowsHide: true,
});
const bashPythonPath = (bashPythonProbe.stdout || "").trim();
const bashTest = bashProbe.status === 0 && bashPythonProbe.status === 0 ? test : test.skip;

function toBashPath(filePath) {
  const normalized = path.resolve(filePath).replace(/\\/g, "/");
  const driveMatch = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (driveMatch && isWindowsBash) return `/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`;
  if (driveMatch) return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`;
  return normalized;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function run(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      ...options,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

async function createWrapperFixture(t, cliOutput, viewUrl) {
  const root = path.resolve(__dirname, "..");
  const testDir = path.join(root, ".tmp", `mju-news-wrapper-${process.pid}-${Math.random().toString(16).slice(2)}`);
  await fs.rm(testDir, { recursive: true, force: true });
  await fs.mkdir(testDir, { recursive: true });
  t.after(() => fs.rm(testDir, { recursive: true, force: true }));

  const stubBin = path.join(testDir, "bin");
  await fs.mkdir(stubBin, { recursive: true });
  const curlCapture = path.join(testDir, "curl-body.json");
  const curlModeCapture = path.join(testDir, "curl-mode.txt");
  const curlStub = path.join(stubBin, "curl");
  await fs.writeFile(curlStub, `#!/usr/bin/env bash
set -euo pipefail
body=""
mode=""
while (($#)); do
  case "$1" in
    -d|--data|--data-raw|--data-binary)
      flag="$1"
      shift
      value="\${1:-}"
      if [[ "$flag" == "-d" && \${#value} -gt 100000 ]]; then
        exit 126
      fi
      if [[ "$value" == @* ]]; then
        body="$(cat "\${value#@}")"
        mode="file"
      else
        body="$value"
        mode="inline"
      fi
      ;;
  esac
  shift || true
done
printf '%s' "$body" > "${toBashPath(curlCapture)}"
printf '%s' "$mode" > "${toBashPath(curlModeCapture)}"
printf '%s\\n' '{"url":"${viewUrl}"}'
`, "utf8");
  await fs.chmod(curlStub, 0o755);

  const realMjuNews = path.join(testDir, "main.js");
  await fs.writeFile(realMjuNews, `
console.log(${JSON.stringify(JSON.stringify(cliOutput))});
`, "utf8");

  return { root, realMjuNews, curlStub, bashNode: bashNodePath, bashPython: bashPythonPath, curlCapture, curlModeCapture };
}

function wrapperCommand(fixture, args) {
  const wrapper = toBashPath(path.join(fixture.root, "bin", "mju-news"));
  return [
    `MJU_NEWS_REAL_BIN=${shellQuote(toBashPath(fixture.realMjuNews))}`,
    `MJU_NEWS_NODE_BIN=${shellQuote(fixture.bashNode)}`,
    `MJU_NEWS_CURL_BIN=${shellQuote(toBashPath(fixture.curlStub))}`,
    `MJU_NEWS_PYTHON_BIN=${shellQuote(fixture.bashPython)}`,
    `VIEW_API_URL=${shellQuote("http://127.0.0.1:1/api/view")}`,
    shellQuote(wrapper),
    ...args.map(shellQuote),
  ].join(" ");
}

bashTest("mju-news wrapper routes course catalog reads to the timetable planner webview", async (t) => {
  const fixture = await createWrapperFixture(t, {
    total: 1,
    items: [{
      year: 2026,
      termCode: "10",
      termLabel: "1학기",
      category: "major",
      categoryLabel: "전공 · 컴퓨터공학전공",
      courseTitle: "AI프로그래밍",
      credit: 3,
      meetings: [{ dayOfWeek: 1, dayLabel: "Mon", startTime: "09:00", endTime: "10:50", location: "Y5441" }],
    }],
  }, "http://view.local/timetable-planner");

  const result = await run("bash", ["-lc", wrapperCommand(fixture, [
    "course-catalog",
    "list",
    "--year",
    "2026",
    "--term-code",
    "10",
    "--format",
    "json",
  ])], { cwd: fixture.root });

  assert.equal(result.status, 0, result.stderr);
  const requestBody = JSON.parse(await fs.readFile(fixture.curlCapture, "utf8"));
  assert.equal(requestBody.dataType, "timetable-planner");
  assert.equal(requestBody.title, "시간표 설계");
  assert.equal(requestBody.rawData.items[0].meetings[0].location, "Y5441");

  const output = JSON.parse(result.stdout);
  assert.equal(output.viewUrl, "http://view.local/timetable-planner");
  assert.equal(output.viewDataType, "timetable-planner");
});

bashTest("mju-news wrapper leaves standalone graduation requirements unviewed", async (t) => {
  const fixture = await createWrapperFixture(t, {
    total: 1,
    items: [{
      department: "컴퓨터공학전공",
      admissionYear: 2021,
      sourceKind: "department_page",
      sourceTitle: "명지대학교 컴퓨터공학전공 졸업이수가이드",
      sourceUrl: "https://cs.mju.ac.kr/cs/10763/subview.do",
      rules: [{ requirementKey: "major-credit", label: "전공", category: "전공", requiredCredits: 74, status: "confirmed" }],
    }],
  }, "http://view.local/graduation");

  const result = await run("bash", ["-lc", wrapperCommand(fixture, [
    "graduation-requirements",
    "list",
    "--department",
    "컴퓨터공학전공",
    "--admission-year",
    "2021",
    "--format",
    "json",
  ])], { cwd: fixture.root });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await fileExists(fixture.curlCapture), false);

  const output = JSON.parse(result.stdout);
  assert.equal(output.viewUrl, undefined);
  assert.equal(output.items[0].rules[0].requiredCredits, 74);
});

bashTest("mju-news wrapper routes academic-planning timetable to the timetable planner webview", async (t) => {
  const fixture = await createWrapperFixture(t, {
    total: 1,
    items: [{ courseTitle: "AI프로그래밍", credit: 3, meetings: [] }],
    choiceGroups: [],
    completedCourses: [],
    currentCourses: [],
    officialCoverage: { status: "confirmed" },
  }, "http://view.local/academic-timetable");

  const result = await run("bash", ["-lc", wrapperCommand(fixture, [
    "academic-planning",
    "timetable",
    "--year",
    "2026",
    "--term-code",
    "10",
    "--department",
    "15611",
    "--student-number",
    "TEST-99241234",
    "--format",
    "json",
  ])], { cwd: fixture.root });

  assert.equal(result.status, 0, result.stderr);
  const requestBody = JSON.parse(await fs.readFile(fixture.curlCapture, "utf8"));
  assert.equal(requestBody.dataType, "timetable-planner");
  assert.equal(requestBody.title, "시간표 설계");
  assert.equal(requestBody.rawData.items[0].courseTitle, "AI프로그래밍");

  const output = JSON.parse(result.stdout);
  assert.equal(output.viewUrl, "http://view.local/academic-timetable");
  assert.equal(output.viewDataType, "timetable-planner");
});

bashTest("mju-news wrapper posts large academic-planning payload through a body file", async (t) => {
  const fixture = await createWrapperFixture(t, {
    total: 1200,
    items: Array.from({ length: 1200 }, (_, index) => ({
      year: 2026,
      termCode: "10",
      termLabel: "1학기",
      courseTitle: `대용량테스트과목-${index}`,
      description: "x".repeat(300),
      meetings: [],
    })),
    choiceGroups: [],
    completedCourses: [],
    currentCourses: [],
    officialCoverage: { status: "confirmed" },
  }, "http://view.local/large-academic-timetable");

  const result = await run("bash", ["-lc", wrapperCommand(fixture, [
    "academic-planning",
    "timetable",
    "--year",
    "2026",
    "--term-code",
    "10",
    "--department",
    "15611",
    "--student-number",
    "TEST-99241234",
    "--format",
    "json",
  ])], { cwd: fixture.root });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await fs.readFile(fixture.curlModeCapture, "utf8"), "file");

  const requestBody = JSON.parse(await fs.readFile(fixture.curlCapture, "utf8"));
  assert.equal(requestBody.dataType, "timetable-planner");
  assert.equal(requestBody.rawData.total, 1200);

  const output = JSON.parse(result.stdout);
  assert.equal(output.viewUrl, "http://view.local/large-academic-timetable");
});

bashTest("mju-news wrapper routes academic-planning graduation-roadmap to the graduation webview", async (t) => {
  const fixture = await createWrapperFixture(t, {
    total: 1,
    items: [{ department: "컴퓨터공학전공", admissionYear: 2024, rules: [] }],
    requirementSources: [],
    completedCourses: [],
    currentCourses: [],
    officialCoverage: { status: "needs-official-check" },
  }, "http://view.local/academic-graduation");

  const result = await run("bash", ["-lc", wrapperCommand(fixture, [
    "academic-planning",
    "graduation-roadmap",
    "--department",
    "15611",
    "--student-number",
    "TEST-99241234",
    "--format",
    "json",
  ])], { cwd: fixture.root });

  assert.equal(result.status, 0, result.stderr);
  const requestBody = JSON.parse(await fs.readFile(fixture.curlCapture, "utf8"));
  assert.equal(requestBody.dataType, "graduation");
  assert.equal(requestBody.title, "졸업 로드맵");
  assert.equal(requestBody.rawData.items[0].department, "컴퓨터공학전공");

  const output = JSON.parse(result.stdout);
  assert.equal(output.viewUrl, "http://view.local/academic-graduation");
  assert.equal(output.viewDataType, "graduation");
});

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
