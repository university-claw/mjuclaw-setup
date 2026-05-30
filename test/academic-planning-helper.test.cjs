const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

const bashProbe = spawnSync("bash", ["-lc", "command -v bash"], {
  encoding: "utf8",
  windowsHide: true,
});
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

test("dedicated academic planning commands delegate to the shared helper modes", async () => {
  const timetablePlanner = await fs.readFile(path.join(root, "bin", "mju-timetable-planner"), "utf8");
  const graduationRoadmap = await fs.readFile(path.join(root, "bin", "mju-graduation-roadmap"), "utf8");

  assert.match(timetablePlanner, /exec mju-academic-planning timetable "\$@"/);
  assert.match(graduationRoadmap, /exec mju-academic-planning graduation-roadmap "\$@"/);
});

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

async function createFixture(t, options = {}) {
  const testDir = path.join(root, ".tmp", `academic-planning-helper-${process.pid}-${Math.random().toString(16).slice(2)}`);
  await fs.rm(testDir, { recursive: true, force: true });
  await fs.mkdir(testDir, { recursive: true });
  t.after(() => fs.rm(testDir, { recursive: true, force: true }));

  const stubBin = path.join(testDir, "bin");
  await fs.mkdir(stubBin, { recursive: true });
  const mjuCalls = path.join(testDir, "mju-calls.txt");
  const mjuNewsArgs = path.join(testDir, "mju-news-args.txt");
  const gradeHistoryFails = Boolean(options.gradeHistoryFails);
  const mjuNewsViewDataType = options.mjuNewsViewDataType ?? "";

  const python3Stub = path.join(stubBin, "python3");
  await fs.writeFile(python3Stub, `#!/usr/bin/env bash
set -euo pipefail
exec ${shellQuote(bashPythonPath)} "$@"
`, "utf8");
  await fs.chmod(python3Stub, 0o755);

  const mjuStub = path.join(stubBin, "mju");
  await fs.writeFile(mjuStub, `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${MJU_SKIP_VIEW:-}" != "1" ]]; then
  echo "MJU_SKIP_VIEW=1 is required for helper context reads" >&2
  exit 3
fi
printf '%s\\n' "$*" >> "${toBashPath(mjuCalls)}"
joined=" $* "
case "$joined" in
  *" profile get"*)
    cat <<'JSON'
{"storedUserId":"202112345"}
JSON
    ;;
  *" msi grade-history"*)
    if [[ "${gradeHistoryFails ? "1" : "0"}" == "1" ]]; then
      echo "grade history boom for 123456789012345678" >&2
      exit 42
    fi
    cat <<'JSON'
{"studentInfo":{"학과":"컴퓨터공학과","학번":"202112345"},"termRecords":[{"year":2021,"termLabel":"1학기","courses":[{"courseTitle":"미적분학1","courseCode":"KME02101","credit":3,"categoryLabel":"학문기초교양"}]}]}
JSON
    ;;
  *" msi timetable"*)
    cat <<'JSON'
{"entries":[{"courseTitle":"캡스톤디자인","curiNum":"CSE400","credit":3}]}
JSON
    ;;
  *" msi department-timetable"*)
    cat <<'JSON'
{"departmentCode":"15611","departmentLabel":"컴퓨터정보통신공학부 컴퓨터공학전공"}
JSON
    ;;
  *)
    echo "unexpected mju call: $*" >&2
    exit 2
    ;;
esac
`, "utf8");
  await fs.chmod(mjuStub, 0o755);

  const mjuNewsStub = path.join(stubBin, "mju-news");
  await fs.writeFile(mjuNewsStub, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" > "${toBashPath(mjuNewsArgs)}"
mode="\${2:-unknown}"
case "$mode" in
  timetable) dtype="timetable-planner" ;;
  graduation-roadmap) dtype="graduation" ;;
  *) dtype="unknown" ;;
esac
if [[ -n "${mjuNewsViewDataType}" ]]; then
  dtype="${mjuNewsViewDataType}"
fi
printf '{"viewUrl":"http://view.local/%s","viewDataType":"%s","ok":true}\\n' "$mode" "$dtype"
`, "utf8");
  await fs.chmod(mjuNewsStub, 0o755);

  return { stubBin, mjuCalls, mjuNewsArgs };
}

async function runHelper(fixture, args, env = {}) {
  const helper = toBashPath(path.join(root, "bin", "mju-academic-planning"));
  const envAssignments = Object.entries(env).map(([key, value]) => `${key}=${shellQuote(value)}`);
  const command = [
    `PATH=${shellQuote(toBashPath(fixture.stubBin))}:$PATH`,
    "MJU_ACADEMIC_PLANNING_KEEP_TMP=1",
    ...envAssignments,
    shellQuote(helper),
    ...args.map(shellQuote),
  ].join(" ");
  return run("bash", ["-lc", command]);
}

async function readArgs(filePath) {
  return (await fs.readFile(filePath, "utf8")).trim().split(/\r?\n/).filter(Boolean);
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  assert.notEqual(index, -1, `${flag} should exist`);
  return args[index + 1];
}

function diagnosticEvents(stderr) {
  const prefix = "MJU_ACADEMIC_PLANNING_DIAG ";
  return stderr
    .split(/\r?\n/)
    .filter((line) => line.startsWith(prefix))
    .map((line) => JSON.parse(line.slice(prefix.length)));
}

bashTest("academic planning helper enriches graduation roadmap calls with MSI context", async (t) => {
  const fixture = await createFixture(t);
  const result = await runHelper(fixture, [
    "graduation-roadmap",
    "123456789012345678",
    "--format",
    "json",
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"viewUrl":"http:\/\/view\.local\/graduation-roadmap"/);
  assert.match(result.stdout, /"viewDataType":"graduation"/);

  const args = await readArgs(fixture.mjuNewsArgs);
  assert.deepEqual(args.slice(0, 2), ["academic-planning", "graduation-roadmap"]);
  assert.match(valueAfter(args, "--department"), /^15611\s+/);
  assert.equal(valueAfter(args, "--student-number"), "202112345");
  assert.equal(valueAfter(args, "--format"), "json");
  assert.ok(args.includes("--personal-msi-json"));
  assert.ok(args.includes("--completed-courses-json"));

  const mjuCalls = await fs.readFile(fixture.mjuCalls, "utf8");
  assert.match(mjuCalls, /profile get/);
  assert.match(mjuCalls, /msi grade-history/);
  assert.match(mjuCalls, /msi timetable/);
  assert.match(mjuCalls, /msi department-timetable/);
  assert.doesNotMatch(mjuCalls, /ucheck/);
});

bashTest("academic planning helper routes timetable generation without UCheck", async (t) => {
  const fixture = await createFixture(t);
  const result = await runHelper(fixture, [
    "timetable",
    "123456789012345678",
    "--year",
    "2026",
    "--term-code",
    "20",
    "--format",
    "json",
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"viewUrl":"http:\/\/view\.local\/timetable"/);
  assert.match(result.stdout, /"viewDataType":"timetable-planner"/);

  const args = await readArgs(fixture.mjuNewsArgs);
  assert.deepEqual(args.slice(0, 2), ["academic-planning", "timetable"]);
  assert.match(valueAfter(args, "--department"), /^15611\s+/);
  assert.equal(valueAfter(args, "--student-number"), "202112345");
  assert.equal(valueAfter(args, "--year"), "2026");
  assert.equal(valueAfter(args, "--term-code"), "20");
  assert.ok(args.includes("--personal-msi-json"));
  assert.ok(args.includes("--completed-courses-json"));

  const mjuCalls = await fs.readFile(fixture.mjuCalls, "utf8");
  assert.match(mjuCalls, /msi grade-history/);
  assert.match(mjuCalls, /msi department-timetable/);
  assert.doesNotMatch(mjuCalls, /ucheck/);
});

bashTest("academic planning helper defaults timetable planning to the published first semester in May", async (t) => {
  const fixture = await createFixture(t);
  const result = await runHelper(fixture, [
    "timetable",
    "123456789012345678",
    "--format",
    "json",
  ], { MJU_ACADEMIC_PLANNING_NOW: "2026-05-30T12:00:00" });

  assert.equal(result.status, 0, result.stderr);

  const args = await readArgs(fixture.mjuNewsArgs);
  assert.deepEqual(args.slice(0, 2), ["academic-planning", "timetable"]);
  assert.equal(valueAfter(args, "--year"), "2026");
  assert.equal(valueAfter(args, "--term-code"), "10");
});

bashTest("academic planning helper emits structured diagnostics when required MSI context fails", async (t) => {
  const fixture = await createFixture(t, { gradeHistoryFails: true });
  const result = await runHelper(fixture, [
    "graduation-roadmap",
    "123456789012345678",
    "--format",
    "json",
  ]);

  assert.equal(result.status, 42);
  assert.doesNotMatch(result.stderr, /123456789012345678/);
  const events = diagnosticEvents(result.stderr);
  const failure = events.find((event) => event.stage === "msi.grade-history");
  assert.ok(failure, result.stderr);
  assert.equal(failure.feature, "academic-planning");
  assert.equal(failure.mode, "graduation-roadmap");
  assert.equal(failure.status, "failed");
  assert.equal(failure.exitCode, 42);
  assert.match(failure.stderrTail, /grade history boom/);
});

bashTest("academic planning helper rejects mismatched webview data types", async (t) => {
  const fixture = await createFixture(t, { mjuNewsViewDataType: "attendance" });
  const result = await runHelper(fixture, [
    "timetable",
    "123456789012345678",
    "--year",
    "2026",
    "--term-code",
    "20",
    "--format",
    "json",
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /"viewDataType":"attendance"/);
  const events = diagnosticEvents(result.stderr);
  const failure = events.find((event) => event.stage === "view.validate");
  assert.ok(failure, result.stderr);
  assert.equal(failure.status, "failed");
  assert.match(failure.stderrTail, /expected=timetable-planner/);
});
