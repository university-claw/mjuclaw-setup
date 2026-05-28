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

async function createWrapperFixture(t, cliOutput) {
  const root = path.resolve(__dirname, "..");
  const testDir = path.join(root, ".tmp", `mju-wrapper-${process.pid}-${Math.random().toString(16).slice(2)}`);
  await fs.rm(testDir, { recursive: true, force: true });
  await fs.mkdir(testDir, { recursive: true });
  t.after(() => fs.rm(testDir, { recursive: true, force: true }));

  const stubBin = path.join(testDir, "bin");
  await fs.mkdir(stubBin, { recursive: true });
  const curlCapture = path.join(testDir, "curl-body.json");
  const curlStub = path.join(stubBin, "curl");
  const curlCaptureForBash = toBashPath(curlCapture);
  await fs.writeFile(curlStub, `#!/usr/bin/env bash
set -euo pipefail
body=""
while (($#)); do
  case "$1" in
    -d)
      shift
      body="\${1:-}"
      ;;
  esac
  shift || true
done
printf '%s' "$body" > "${curlCaptureForBash}"
printf '%s\\n' '{"url":"http://view.local/course-scores-test"}'
`, "utf8");
  await fs.chmod(curlStub, 0o755);

  const realMju = path.join(testDir, "main.js");
  await fs.writeFile(realMju, `
console.log(${JSON.stringify(JSON.stringify(cliOutput))});
`, "utf8");

  return { root, realMju, curlStub, bashNode: bashNodePath, bashPython: bashPythonPath, testDir, curlCapture };
}

function wrapperCommand(fixture, args) {
  const wrapper = toBashPath(path.join(fixture.root, "bin", "mju"));
  return [
    `MJU_REAL_BIN=${shellQuote(toBashPath(fixture.realMju))}`,
    `MJU_NODE_BIN=${shellQuote(fixture.bashNode)}`,
    `MJU_CURL_BIN=${shellQuote(toBashPath(fixture.curlStub))}`,
    `MJU_PYTHON_BIN=${shellQuote(fixture.bashPython)}`,
    `VIEW_API_URL=${shellQuote("http://127.0.0.1:1/api/view")}`,
    shellQuote(wrapper),
    ...args.map(shellQuote),
  ].join(" ");
}

bashTest("mju wrapper routes course-scores to the view API and injects viewUrl", async (t) => {
  const fixture = await createWrapperFixture(t, {
    year: 2026,
    termLabel: "1학기",
    courses: [{
      title: "0752 - 시스템클라우드보안",
      items: [{
        assessmentCategory: "수시시험(중간시험, QUIZ포함)",
        itemName: "중간시험",
        ratio: { rawValue: "40 / 40 %" },
        rawScore: { rawValue: "0 / 100 점" },
        averageScore: { rawValue: "0 점" },
        note: "미입력",
      }],
    }],
  });

  const result = await run("bash", ["-lc", wrapperCommand(fixture, [
    "msi",
    "course-scores",
    "--app-dir",
    toBashPath(path.join(fixture.testDir, "app")),
    "--format",
    "json",
  ])], { cwd: fixture.root });

  assert.equal(result.status, 0, result.stderr);

  const requestBody = JSON.parse(await fs.readFile(fixture.curlCapture, "utf8"));
  assert.equal(requestBody.dataType, "course-scores");
  assert.equal(requestBody.title, "수강점수");
  assert.equal(requestBody.rawData.courses[0].items[0].itemName, "중간시험");

  const output = JSON.parse(result.stdout);
  assert.equal(output.viewUrl, "http://view.local/course-scores-test");
  assert.equal(output.courses[0].title, "0752 - 시스템클라우드보안");
});

for (const legacyCommand of ["current-grades", "grades"]) {
  bashTest(`mju wrapper leaves msi ${legacyCommand} output unviewed`, async (t) => {
    const fixture = await createWrapperFixture(t, {
      items: [{ courseTitle: "시스템클라우드보안", grade: "A+" }],
    });

    const result = await run("bash", ["-lc", wrapperCommand(fixture, [
      "msi",
      legacyCommand,
      "--app-dir",
      toBashPath(path.join(fixture.testDir, "app")),
      "--format",
      "json",
    ])], { cwd: fixture.root });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(await fileExists(fixture.curlCapture), false);

    const output = JSON.parse(result.stdout);
    assert.equal(output.viewUrl, undefined);
    assert.equal(output.items[0].courseTitle, "시스템클라우드보안");
  });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
