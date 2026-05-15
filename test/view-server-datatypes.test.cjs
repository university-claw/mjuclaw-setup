const assert = require("node:assert/strict");
const { once } = require("node:events");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");
const { spawn } = require("node:child_process");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const { port } = address;
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  return port;
}

function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(2_000),
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(port, child, childOutput) {
  for (let i = 0; i < 40; i++) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `view server exited before health check passed (exit=${child.exitCode}, signal=${child.signalCode})\n${childOutput()}`,
      );
    }
    try {
      const res = await fetchWithTimeout(`http://127.0.0.1:${port}/health`);
      if (res.ok) return;
    } catch {
      // Server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`view server did not start on port ${port}\n${childOutput()}`);
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  const closed = once(child, "close");
  child.kill("SIGTERM");

  const closedAfterSigterm = await Promise.race([
    closed.then(() => true),
    delay(1_000).then(() => false),
  ]);
  if (closedAfterSigterm) return;

  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
  await closed;
}

async function withViewServer(t, fn) {
  const port = await freePort();
  const root = path.resolve(__dirname, "..");
  let childOutput = "";
  const child = spawn(process.execPath, [path.join(root, "dist", "view-server.js")], {
    cwd: root,
    env: {
      ...process.env,
      VIEW_PORT: String(port),
      VIEW_BASE_URL: `http://127.0.0.1:${port}`,
      VIEW_STORE_DIR: path.join(root, ".tmp", `view-server-test-${port}`),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => {
    childOutput += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    childOutput += chunk.toString();
  });
  t.after(() => stopChild(child));

  await waitForHealth(port, child, () => childOutput.slice(-4000));
  await fn(port);
}

test("view API rejects removed webview data types", async (t) => {
  await withViewServer(t, async (port) => {
    for (const dataType of ["courses", "due-assignments"]) {
      const res = await fetchWithTimeout(`http://127.0.0.1:${port}/api/view`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dataType,
          title: dataType,
          rawData: {},
        }),
      });
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.equal(body.error, "invalid dataType");
    }
  });
});

test("view API accepts the grade-history data type", async (t) => {
  await withViewServer(t, async (port) => {
    const res = await fetchWithTimeout(`http://127.0.0.1:${port}/api/view`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dataType: "grade-history",
        title: "학기별 성적",
        rawData: {
          overview: { 전체평점: "4.08", 전체취득학점: "96" },
          termRecords: [],
        },
      }),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.match(body.url, new RegExp(`^http://127\\.0\\.0\\.1:${port}/view/`));
  });
});

test("view API accepts and renders the course-scores data type", async (t) => {
  await withViewServer(t, async (port) => {
    const res = await fetchWithTimeout(`http://127.0.0.1:${port}/api/view`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dataType: "course-scores",
        title: "수강점수",
        rawData: {
          year: 2026,
          termLabel: "1학기",
          courses: [
            {
              title: "0752 - 시스템클라우드보안",
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
      }),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.match(body.url, new RegExp(`^http://127\\.0\\.0\\.1:${port}/view/`));

    const viewRes = await fetchWithTimeout(body.url);
    const html = await viewRes.text();

    assert.equal(viewRes.status, 200);
    assert.match(html, /COURSE SCORES/);
    assert.match(html, /0752 - 시스템클라우드보안/);
    assert.match(html, /중간시험/);
    assert.doesNotMatch(html, /AI 요약/);
  });
});
