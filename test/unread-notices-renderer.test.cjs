const assert = require("node:assert/strict");
const test = require("node:test");
const { renderViewHtml } = require("../dist/view-renderer.js");

function unreadNoticesEntry() {
  return {
    id: "unread-notices-test-view",
    dataType: "unread-notices",
    title: "\uC548 \uC77D\uC740 \uACF5\uC9C0",
    summary: "",
    aiResponse: "**SHOULD_NOT_RENDER_UNREAD_AI**",
    createdAt: new Date("2026-05-04T05:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-04T05:30:00.000Z").getTime(),
    rawData: {
      notices: [
        {
          title: "\uAE30\uB9D0\uACE0\uC0AC \uC2DC\uD5D8 \uBC94\uC704 \uBC0F \uAC15\uC758\uC2E4 \uC548\uB0B4",
          courseTitle: "\uBBFC\uBC95\uCD1D\uCE59",
          postedAt: "\uC624\uB298",
          previewText: "\uAE30\uB9D0\uACE0\uC0AC \uC2DC\uD5D8 \uBC94\uC704\uC640 \uB2F9\uC77C \uAC15\uC758\uC2E4 \uBC30\uC815\uC774 \uACF5\uC9C0\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
          isUnread: true,
        },
        {
          title: "\uBCF4\uAC15 \uC218\uC5C5 \uC77C\uC815 \uBCC0\uACBD \uC548\uB0B4",
          courseTitle: "\uD5CC\uBC95\uD559",
          postedAt: "\uC5B4\uC81C",
          previewText: "5\uC6D4 \uBCF4\uAC15 \uC218\uC5C5 \uC77C\uC815\uC774 \uC77C\uBD80 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
          isUnread: true,
        },
        {
          title: "\uACFC\uC81C \uC81C\uCD9C \uC591\uC2DD \uC548\uB0B4",
          courseTitle: "\uD615\uBC95\uAC01\uB860",
          postedAt: "5\uC6D4 2\uC77C",
          previewText: "\uB9AC\uD3EC\uD2B8 \uC81C\uCD9C \uC591\uC2DD\uACFC \uD30C\uC77C\uBA85 \uADDC\uCE59 \uC548\uB0B4\uC785\uB2C8\uB2E4.",
          isUnread: true,
        },
      ],
    },
  };
}

test("unread-notices renders a status line followed by recent and past notice sections", () => {
  const html = renderViewHtml(unreadNoticesEntry());
  const bodyHtml = html.slice(html.indexOf("</style>"));

  const overviewIndex = bodyHtml.indexOf("\uC548 \uC77D\uC740 \uACF5\uC9C0 <strong>3\uAC74</strong>");
  const recentIndex = bodyHtml.indexOf("\uCD5C\uADFC \uACF5\uC9C0");
  const pastIndex = bodyHtml.indexOf("\uC9C0\uB09C \uACF5\uC9C0");
  const coursePillIndex = bodyHtml.indexOf("notice-course-pill");

  assert.ok(overviewIndex >= 0, "status overview should render the unread count");
  assert.ok(recentIndex > overviewIndex, "recent section should follow the overview");
  assert.ok(pastIndex > recentIndex, "past section should follow recent notices");
  assert.ok(coursePillIndex > overviewIndex, "course names should render as pill labels");
  assert.match(bodyHtml, /\uC624\uB298 1 \u00B7 \uC774\uC804 2/);
});

test("unread-notices omits the generic AI summary even when an AI response exists", () => {
  const html = renderViewHtml(unreadNoticesEntry());

  assert.doesNotMatch(html, /class="briefing/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER_UNREAD_AI/);
});
