const assert = require("node:assert/strict");
const { once } = require("node:events");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");
const { spawn } = require("node:child_process");

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}

async function waitForHealth(port) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return;
    } catch {
      // Server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`view server did not start on port ${port}`);
}

test("view API rejects the removed due-assignments data type", async (t) => {
  const port = await freePort();
  const root = path.resolve(__dirname, "..");
  const child = spawn(process.execPath, [path.join(root, "dist", "view-server.js")], {
    cwd: root,
    env: {
      ...process.env,
      VIEW_PORT: String(port),
      VIEW_BASE_URL: `http://127.0.0.1:${port}`,
      VIEW_STORE_DIR: path.join(root, ".tmp", `view-server-test-${port}`),
    },
    stdio: "ignore",
    windowsHide: true,
  });
  t.after(() => child.kill());

  await waitForHealth(port);

  const res = await fetch(`http://127.0.0.1:${port}/api/view`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      dataType: "due-assignments",
      title: "Due Assignments",
      rawData: { assignments: [] },
    }),
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.error, "invalid dataType");
});
