const assert = require("node:assert/strict");
const test = require("node:test");
const { renderViewHtml } = require("../dist/view-renderer.js");

function newsDetailEntry() {
  return {
    id: "news-detail-test-view",
    dataType: "news-detail",
    title: "\uACF5\uC9C0 \uC0C1\uC138",
    summary: "",
    aiResponse: "**SHOULD_NOT_RENDER_NEWS_DETAIL_AI**",
    createdAt: new Date("2026-05-03T12:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-03T12:30:00.000Z").getTime(),
    rawData: {
      title: "\uC778\uC7AC\uB9BC \uC81C6\uAE30 \uC7A5\uD559\uC0DD \uC120\uBC1C \uC548\uB0B4",
      source: "scholarship",
      sourceName: "\uC7A5\uD559/\uD559\uC790\uAE08\uACF5\uC9C0",
      categoryLabel: "\uC7A5\uD559",
      author: "\uAE40*\uB9B0",
      url: "https://www.mju.ac.kr/notice/detail",
      publishedAt: "2026-04-21T09:00:00+09:00",
      bodyText:
        "\uC9C0\uC6D0 \uB300\uC0C1\uC740 \uAD6D\uB0B4 \uB300\uD559 \uC7AC\uD559\uC0DD\uC785\uB2C8\uB2E4.\n\uC81C\uCD9C \uC11C\uB958\uB294 \uCCA8\uBD80\uD30C\uC77C\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
      attachments: [
        {
          fileName: "\uC778\uC7AC\uB9BC \uC81C6\uAE30 \uC7A5\uD559\uC0DD \uC120\uBC1C \uACF5\uACE0.pdf",
          downloadUrl: "https://www.mju.ac.kr/download/sample.pdf",
          contentType: "application/pdf",
          sizeBytes: 284672,
          extraction: {
            status: "succeeded",
            text: "\uBAA8\uC9D1 \uB300\uC0C1, \uC9C0\uC6D0 \uC790\uACA9, \uC81C\uCD9C \uC11C\uB958\uAC00 \uD3EC\uD568\uB41C \uACF5\uACE0\uBB38\uC785\uB2C8\uB2E4.",
          },
        },
        {
          fileName: "\uC9C0\uC6D0\uC11C \uC591\uC2DD.hwp",
          downloadUrl: "https://www.mju.ac.kr/download/sample.hwp",
          contentType: "application/x-hwp",
          sizeBytes: 53248,
          extraction: { status: "unsupported" },
        },
      ],
      images: [
        {
          ocr: {
            status: "succeeded",
            text: "\uC774\uBBF8\uC9C0\uC5D0\uC11C \uCD94\uCD9C\uD55C \uC7A5\uD559\uC0DD \uC120\uBC1C \uC548\uB0B4\uC785\uB2C8\uB2E4.",
          },
        },
      ],
    },
  };
}

test("news-detail uses the notice title and omits generic AI summary", () => {
  const html = renderViewHtml(newsDetailEntry());

  assert.match(html, /<h1 class="hero-title">\uC778\uC7AC\uB9BC \uC81C6\uAE30 \uC7A5\uD559\uC0DD \uC120\uBC1C \uC548\uB0B4<\/h1>/);
  assert.doesNotMatch(html, /class="briefing/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER_NEWS_DETAIL_AI/);
});

test("news-detail reads as a document with metadata absorbed and supporting sections renamed", () => {
  const html = renderViewHtml(newsDetailEntry());
  const bodyHtml = html.slice(html.indexOf("</style>"));

  const titleIndex = bodyHtml.indexOf("\uC778\uC7AC\uB9BC \uC81C6\uAE30 \uC7A5\uD559\uC0DD \uC120\uBC1C \uC548\uB0B4");
  const metaIndex = bodyHtml.indexOf("\uC7A5\uD559/\uD559\uC790\uAE08\uACF5\uC9C0");
  const bodyIndex = bodyHtml.indexOf("<h2>\uBCF8\uBB38</h2>");
  const attachmentIndex = bodyHtml.indexOf("\uCCA8\uBD80\uD30C\uC77C");
  const ocrIndex = bodyHtml.indexOf("\uC774\uBBF8\uC9C0\uC5D0\uC11C \uCD94\uCD9C\uD55C \uD14D\uC2A4\uD2B8");

  assert.ok(titleIndex >= 0, "notice title should render");
  assert.ok(metaIndex > titleIndex, "metadata should sit with the title before document content");
  assert.ok(bodyIndex > metaIndex, "body should follow the title metadata");
  assert.ok(attachmentIndex > bodyIndex, "attachments should follow the body");
  assert.equal(ocrIndex, -1, "OCR text extracted from notice images should not render");
  assert.doesNotMatch(bodyHtml, /<h2>\uACF5\uC9C0 \uC815\uBCF4<\/h2>/);
  assert.doesNotMatch(bodyHtml, /\uBCF8\uBB38 \uC774\uBBF8\uC9C0 \uD14D\uC2A4\uD2B8/);
  assert.doesNotMatch(bodyHtml, /\uC774\uBBF8\uC9C0\uC5D0\uC11C \uCD94\uCD9C\uD55C \uC7A5\uD559\uC0DD \uC120\uBC1C \uC548\uB0B4/);
});
