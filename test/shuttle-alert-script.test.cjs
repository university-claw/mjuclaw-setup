const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const shuttleAlert = path.join(repoRoot, "bin", "mju-shuttle-alert");

function writeExecutable(filePath, content) {
  fs.writeFileSync(filePath, content, { encoding: "utf8", mode: 0o755 });
}

test("mju-shuttle-alert check sends class-end candidates through router payload", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mju-shuttle-alert-"));
  const fakeBin = path.join(tempDir, "bin");
  const dataRoot = path.join(tempDir, "users");
  const curlLog = path.join(tempDir, "curl-payloads.jsonl");
  const timetableFile = path.join(tempDir, "shuttle-current.json");
  fs.mkdirSync(fakeBin, { recursive: true });

  fs.writeFileSync(
    timetableFile,
    JSON.stringify(
      {
        termCode: "2026-1",
        termLabel: "2026학년도 1학기",
        campus: "natural",
        validFrom: "2026-01-01",
        validTo: "2099-12-31",
        source: {
          noticeId: "229581",
          noticeTitle: "셔틀 안내",
          noticeUrl: "https://www.mju.ac.kr/bbs/mjukr/141/229581/artclView.do",
          attachmentUrl: "https://www.mju.ac.kr/bbs/mjukr/141/175540/download.do",
          reviewedAt: "2026-05-24",
        },
        departures: [
          {
            campus: "자연",
            routeName: "명지대역 노선",
            direction: "명지대역 -> 자연캠퍼스",
            stopName: "명지대역",
            dayTypes: ["daily"],
            time: "18:10",
          },
          {
            campus: "자연",
            routeName: "명지대역 노선",
            direction: "명지대역 -> 자연캠퍼스",
            stopName: "명지대역",
            dayTypes: ["daily"],
            time: "18:40",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  const fakeCurl = path.join(fakeBin, "curl");
  writeExecutable(
    fakeCurl,
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
let out = "";
let body = "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-o") out = args[++i];
  if (args[i] === "--data-raw") body = args[++i];
}
if (out) fs.writeFileSync(out, "{\\"ok\\":true}", "utf8");
fs.appendFileSync(${JSON.stringify(curlLog)}, body + "\\n");
process.stdout.write("200");
`,
  );

  const result = spawnSync(
    shuttleAlert,
    [
      "check",
      "123456789",
      "--mode",
      "class-end",
      "--end-time",
      "18:00",
      "--course-title",
      "시스템보안",
      "--time-range",
      "16:00~18:00",
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        MJU_SHUTTLE_TIMETABLE_FILE: timetableFile,
        CURL_BIN: fakeCurl,
        MJU_ALERT_DATA_ROOT: dataRoot,
        MJUCLAW_ROUTER_TOKEN: "test-token",
        MJUCLAW_ROUTER_URL: "http://router.test",
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /시스템보안/);
  assert.match(result.stdout, /18:10/);

  const payload = JSON.parse(fs.readFileSync(curlLog, "utf8").trim());
  assert.equal(payload.discordUserId, "123456789");
  assert.match(payload.content, /가까운 셔틀 후보/);
  assert.match(payload.content, /18:40/);
});

test("mju-shuttle-alert subscribe registers crons from static timetable", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mju-shuttle-alert-subscribe-"));
  const fakeBin = path.join(tempDir, "bin");
  const dataRoot = path.join(tempDir, "users");
  const timetableFile = path.join(tempDir, "shuttle-current.json");
  const cronLog = path.join(tempDir, "cron-adds.jsonl");
  fs.mkdirSync(fakeBin, { recursive: true });

  fs.writeFileSync(
    timetableFile,
    JSON.stringify(
      {
        termCode: "2026-1",
        termLabel: "2026학년도 1학기",
        campus: "natural",
        validFrom: "2026-01-01",
        validTo: "2099-12-31",
        source: {
          noticeId: "229581",
          noticeTitle: "셔틀 안내",
          noticeUrl: "https://www.mju.ac.kr/bbs/mjukr/141/229581/artclView.do",
          attachmentUrl: "https://www.mju.ac.kr/bbs/mjukr/141/175540/download.do",
          reviewedAt: "2026-05-24",
        },
        routes: [
          {
            campus: "자연",
            routeName: "명지대역 셔틀",
            direction: "명지대역 -> 자연캠퍼스",
            stopName: "명지대역",
            dayTypes: ["daily"],
            times: ["18:10", "18:40"],
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  const fakeMju = path.join(fakeBin, "mju");
  writeExecutable(
    fakeMju,
    `#!/bin/sh
cat <<'JSON'
{
  "year": 2026,
  "termCode": "10",
  "termLabel": "1학기",
  "days": [
    {
      "dayOfWeek": 1,
      "dayLabel": "월",
      "courseTitle": "시스템보안",
      "location": "Y1234",
      "endTime": "17:50",
      "timeRange": "16:00~17:50"
    }
  ]
}
JSON
`,
  );

  const fakeOpenclaw = path.join(fakeBin, "openclaw");
  writeExecutable(
    fakeOpenclaw,
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "cron" && args[1] === "list") {
  process.stdout.write("{\\"jobs\\":[]}");
  process.exit(0);
}
if (args[0] === "cron" && args[1] === "add") {
  const name = args[args.indexOf("--name") + 1];
  const cron = args[args.indexOf("--cron") + 1];
  fs.appendFileSync(${JSON.stringify(cronLog)}, JSON.stringify({name, cron}) + "\\n");
  process.exit(0);
}
if (args[0] === "cron" && args[1] === "rm") {
  process.exit(0);
}
process.exit(1);
`,
  );

  writeExecutable(path.join(fakeBin, "flock"), "#!/bin/sh\nexit 0\n");

  const result = spawnSync(shuttleAlert, ["subscribe", "123456789", "10"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
      MJU_BIN: fakeMju,
      OPENCLAW_BIN: fakeOpenclaw,
      MJU_SHUTTLE_TIMETABLE_FILE: timetableFile,
      MJU_ALERT_DATA_ROOT: dataRoot,
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /1개 요일 셔틀 알림 등록됨/);

  const added = fs.readFileSync(cronLog, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(added.length, 2);
  assert.ok(added.some((job) => job.name.endsWith("-class-end")));
  assert.ok(added.some((job) => job.name.endsWith("-departure")));

  const config = JSON.parse(fs.readFileSync(path.join(dataRoot, "123456789", "shuttle-alert.json"), "utf8"));
  assert.equal(config.shuttleTimetable.termCode, "2026-1");
  assert.equal(config.days[0].firstDepartureTime, "18:10");
});

test("Dockerfile installs mju-shuttle-alert helper", () => {
  const dockerfile = fs.readFileSync(path.join(repoRoot, "Dockerfile"), "utf8");
  assert.match(dockerfile, /COPY bin\/mju-shuttle-alert \/usr\/local\/bin\/mju-shuttle-alert/);
});
