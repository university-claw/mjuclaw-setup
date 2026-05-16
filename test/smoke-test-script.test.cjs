const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const smokeScript = path.join(repoRoot, "smoke-test.ps1");

function createFakeDocker(tempDir) {
  const fakeBin = path.join(tempDir, "bin");
  fs.mkdirSync(fakeBin, { recursive: true });

  const dockerJs = path.join(fakeBin, "docker.js");
  const logPath = path.join(tempDir, "docker-calls.jsonl");
  fs.writeFileSync(
    dockerJs,
    `
const fs = require("node:fs");
const logPath = ${JSON.stringify(logPath)};
const args = process.argv.slice(2);
fs.appendFileSync(logPath, JSON.stringify(args) + "\\n");

function hasAll(values) {
  return values.every((value) => args.includes(value));
}

if (args[0] === "version") {
  console.log("25.0.0");
  process.exit(0);
}

if (args[0] === "inspect" && args[1] === "-f") {
  const name = args[args.length - 1];
  const running = new Set([
    "mjuclaw-agent",
    "mjuclaw-router",
    "mjuclaw-classifier",
    "mjuclaw-public-data-worker",
  ]);
  if (running.has(name)) {
    console.log("true");
    process.exit(0);
  }
  process.exit(1);
}

if (args[0] === "inspect" && args[1] === "mjuclaw-worker") {
  process.exit(1);
}

if (args[0] === "exec" && hasAll(["curl"])) {
  console.log("{\\"ok\\":true}");
  process.exit(0);
}

if (args[0] === "exec" && args[1] === "mjuclaw-public-data-worker" && hasAll(["doctor"])) {
  console.log("doctor ok");
  process.exit(0);
}

if (args[0] === "exec" && args[1] === "mjuclaw-public-data-worker" && hasAll(["schedule", "tick", "--dry-run"])) {
  console.log("schedule dry-run ok");
  process.exit(0);
}

console.error("unexpected docker args: " + JSON.stringify(args));
process.exit(1);
`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(fakeBin, "docker.cmd"),
    `@echo off\r\nnode "%~dp0\\docker.js" %*\r\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(fakeBin, "docker"),
    `#!/bin/sh\nnode "$(dirname "$0")/docker.js" "$@"\n`,
    { encoding: "utf8", mode: 0o755 }
  );

  return { fakeBin, logPath };
}

function runSmoke(args, tempDir) {
  const { fakeBin, logPath } = createFakeDocker(tempDir);
  const env = {
    ...process.env,
    PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
  };

  const candidates =
    process.platform === "win32"
      ? ["pwsh", "powershell"]
      : ["pwsh"];

  let result;
  for (const command of candidates) {
    result = spawnSync(
      command,
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", smokeScript, ...args],
      { cwd: repoRoot, env, encoding: "utf8" }
    );
    if (result.error?.code !== "ENOENT") {
      break;
    }
  }

  return { result, logPath };
}

function readDockerCalls(logPath) {
  if (!fs.existsSync(logPath)) {
    return [];
  }

  return fs
    .readFileSync(logPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("smoke-test check-only prints the plan without creating artifacts or calling docker", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mjuclaw-smoke-check-"));
  const outputRoot = path.join(tempDir, "smoke-tests");

  const { result, logPath } = runSmoke(["-CheckOnly", "-OutputRoot", outputRoot], tempDir);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Check-only completed/);
  assert.equal(fs.existsSync(outputRoot), false);
  assert.deepEqual(readDockerCalls(logPath), []);
});

test("smoke-test records service health and public data worker checks", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mjuclaw-smoke-run-"));
  const outputRoot = path.join(tempDir, "smoke-tests");

  const { result, logPath } = runSmoke(["-OutputRoot", outputRoot], tempDir);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Smoke test record:/);

  const runs = fs.readdirSync(outputRoot);
  assert.equal(runs.length, 1);

  const recordPath = path.join(outputRoot, runs[0], "smoke-test.json");
  const record = JSON.parse(fs.readFileSync(recordPath, "utf8").replace(/^\uFEFF/, ""));

  assert.equal(record.status, "succeeded");
  assert.deepEqual(
    record.checks.map((check) => check.name),
    [
      "agent-health",
      "router-health",
      "classifier-health",
      "legacy-worker-absent",
      "public-data-worker-running",
      "public-data-worker-doctor",
      "public-data-worker-schedule-dry-run",
    ]
  );
  assert.equal(record.checks.every((check) => check.status === "succeeded"), true);

  const calls = readDockerCalls(logPath);
  assert.equal(calls.some((args) => args.includes("mjuclaw-agent") && args.includes("curl")), true);
  assert.equal(calls.some((args) => args.includes("mjuclaw-public-data-worker") && args.includes("doctor")), true);
  assert.equal(calls.some((args) => args.includes("mjuclaw-public-data-worker") && args.includes("--dry-run")), true);
});
