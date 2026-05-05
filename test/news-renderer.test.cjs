const assert = require("node:assert/strict");
const test = require("node:test");
const { renderViewHtml } = require("../dist/view-renderer.js");

function newsEntry() {
  return {
    id: "news-test-view",
    dataType: "news",
    title: "\uD559\uAD50 \uACF5\uC9C0",
    summary: "",
    aiResponse: "**SHOULD_NOT_RENDER_NEWS_AI**",
    createdAt: new Date("2026-05-03T11:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-03T11:30:00.000Z").getTime(),
    rawData: {
      items: [
        {
          title: "\uC7A5\uD559\uC0DD \uC120\uBC1C \uC548\uB0B4",
          url: "https://www.mju.ac.kr/notice/1",
          source: "scholarship",
          sourceName: "\uC7A5\uD559/\uD559\uC790\uAE08\uACF5\uC9C0",
          author: "\uD559\uC0DD\uBCF5\uC9C0\uBD09\uC0AC\uD300",
          publishedAt: "2026-04-21T09:00:00+09:00",
        },
        {
          title: "\uC7AC\uB2A5\uD0A4\uC6C0 \uC7A5\uD559\uC0AC\uC5C5 \uBAA8\uC9D1 \uC548\uB0B4",
          url: "https://www.mju.ac.kr/notice/2",
          source: "scholarship",
          sourceName: "\uC7A5\uD559/\uD559\uC790\uAE08\uACF5\uC9C0",
          author: "\uD559\uC0DD\uBCF5\uC9C0\uBD09\uC0AC\uD300",
          publishedAt: "2026-04-20T09:00:00+09:00",
        },
      ],
    },
  };
}

test("news renders the notice list directly without a found-count briefing", () => {
  const html = renderViewHtml(newsEntry());
  const bodyHtml = html.slice(html.indexOf("</style>"));

  const listIndex = bodyHtml.indexOf("<h2>\uACF5\uC9C0<span");
  const firstNoticeIndex = bodyHtml.indexOf("\uC7A5\uD559\uC0DD \uC120\uBC1C \uC548\uB0B4");

  assert.ok(listIndex >= 0, "notice list title should render");
  assert.ok(firstNoticeIndex > listIndex, "notice rows should follow the list title");
  assert.doesNotMatch(bodyHtml, /class="news-result-briefing"/);
  assert.doesNotMatch(bodyHtml, /\uACF5\uC9C0 2\uAC74\uC744 \uCC3E\uC558\uC5B4\uC694/);
  assert.doesNotMatch(bodyHtml, /\uC0C8 \uD559\uAD50 \uACF5\uC9C0/);
  assert.doesNotMatch(bodyHtml, /\uC7A5\uD559\uAE08 \uAD00\uB828/);
  assert.doesNotMatch(bodyHtml, /\uAE30\uC900\uC73C\uB85C \uCC3E/);
});

test("news omits the generic AI summary even when an AI response exists", () => {
  const html = renderViewHtml(newsEntry());

  assert.doesNotMatch(html, /class="briefing/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER_NEWS_AI/);
});
