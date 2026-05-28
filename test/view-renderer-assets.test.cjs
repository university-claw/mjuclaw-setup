const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { renderExpiredHtml, renderViewHtml } = require("../dist/view-renderer.js");

const repoRoot = path.join(__dirname, "..");
const previewDir = path.join(repoRoot, ".tmp", "webview-preview");

function entry(dataType) {
  return {
    id: "asset-test-view",
    dataType,
    title: "Asset Test",
    summary: "",
    aiResponse: "",
    createdAt: new Date("2026-05-03T06:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-03T06:30:00.000Z").getTime(),
    rawData: null,
  };
}

function darkmodeImageAttrs(html) {
  return Array.from(
    html.matchAll(
      /<img[^>]+src="(\/static\/darkmode\/myongmyong-darkmode-emote-\d+\.png)"[^>]+data-local-src="([^"]+)"[^>]+onerror="this\.onerror=null;this\.src=this\.dataset\.localSrc"[^>]*>/g,
    ),
    (match) => ({ serverSrc: match[1], localSrc: match[2] }),
  );
}

test("view mascot images keep server src and include local preview fallback", () => {
  const html = renderViewHtml(entry("graduation"));
  const attrs = darkmodeImageAttrs(html);

  assert.deepEqual(
    attrs.map((attr) => attr.serverSrc),
    [
      "/static/darkmode/myongmyong-darkmode-emote-00.png",
      "/static/darkmode/myongmyong-darkmode-emote-14.png",
    ],
  );

  for (const attr of attrs) {
    const resolved = path.resolve(previewDir, attr.localSrc);
    assert.ok(resolved.startsWith(path.join(repoRoot, "public", "darkmode")), attr.localSrc);
    assert.ok(fs.existsSync(resolved), attr.localSrc);
  }
});

test("expired mascot image includes the same local preview fallback", () => {
  const attrs = darkmodeImageAttrs(renderExpiredHtml());

  assert.deepEqual(attrs, [
    {
      serverSrc: "/static/darkmode/myongmyong-darkmode-emote-09.png",
      localSrc: "../../public/darkmode/myongmyong-darkmode-emote-09.png",
    },
  ]);
});
