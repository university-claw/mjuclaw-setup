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
  fs.mkdirSync(fakeBin, { recursive: true });

  const fakeNews = path.join(fakeBin, "mju-news");
  writeExecutable(
    fakeNews,
    `#!/bin/sh
cat <<'JSON'
{
  "serviceDate": "2026-05-22",
  "after": "18:00",
  "limit": 3,
  "version": {"id": 1, "sourceTitle": "셔틀 안내"},
  "total": 2,
  "items": [
    {
      "id": 10,
      "timetableVersionId": 1,
      "campus": "자연",
      "routeName": "명지대역 노선",
      "direction": "명지대역 -> 자연캠퍼스",
      "stopName": "명지대역",
      "dayType": "weekday",
      "departureTime": "18:10",
      "note": null,
      "sortOrder": 0
    },
    {
      "id": 11,
      "timetableVersionId": 1,
      "campus": "자연",
      "routeName": "명지대역 노선",
      "direction": "명지대역 -> 자연캠퍼스",
      "stopName": "명지대역",
      "dayType": "weekday",
      "departureTime": "18:40",
      "note": null,
      "sortOrder": 1
    }
  ]
}
JSON
`,
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
        MJU_NEWS_BIN: fakeNews,
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

test("Dockerfile installs mju-shuttle-alert helper", () => {
  const dockerfile = fs.readFileSync(path.join(repoRoot, "Dockerfile"), "utf8");
  assert.match(dockerfile, /COPY bin\/mju-shuttle-alert \/usr\/local\/bin\/mju-shuttle-alert/);
});
