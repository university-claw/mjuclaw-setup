const assert = require("node:assert/strict");
const test = require("node:test");
const { renderViewHtml } = require("../dist/view-renderer.js");

function graduationEntry() {
  return {
    id: "graduation-test-view",
    dataType: "graduation",
    title: "Graduation Requirements",
    summary: "",
    aiResponse: "**SHOULD_NOT_RENDER_GRADUATION_AI**",
    createdAt: new Date("2026-05-03T08:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-03T08:30:00.000Z").getTime(),
    rawData: {
      overall: { earned: 116, required: 130, pct: 89 },
      creditGaps: [
        { label: "Total Credits", earned: 116, required: 130, gap: 14 },
        { label: "Major Core", earned: 33, required: 33, gap: 0 },
        { label: "Major Elective", earned: 45, required: 54, gap: 9 },
        { label: "General Education", earned: 18, required: 18, gap: 0 },
        { label: "Free Elective", earned: 8, required: 13, gap: 5 },
      ],
    },
  };
}

test("graduation keeps the original ring layout and inserts shortages below the total ring", () => {
  const html = renderViewHtml(graduationEntry());
  const bodyHtml = html.slice(html.indexOf("</style>"));

  const heroIndex = bodyHtml.indexOf('class="grad-hero"');
  const shortagesIndex = bodyHtml.indexOf('class="grad-shortage-list"');
  const gridIndex = bodyHtml.indexOf('class="ring-grid"');

  assert.ok(heroIndex >= 0, "original total credit ring should render");
  assert.ok(shortagesIndex > heroIndex, "shortage list should sit below the total credit ring");
  assert.ok(gridIndex > shortagesIndex, "original detail ring grid should follow the shortage list");
  assert.doesNotMatch(bodyHtml, /grad-briefing/);
  assert.doesNotMatch(bodyHtml, /grad-requirement-list/);
  assert.match(bodyHtml, /class="grad-shortage-row/);
  assert.doesNotMatch(bodyHtml, /grad-shortage-item/);
  assert.doesNotMatch(bodyHtml, /grad-shortage-bar/);
  assert.match(bodyHtml, /class="ring-card/);
  assert.match(bodyHtml, /Major Elective/);
  assert.match(bodyHtml, /Free Elective/);
});

test("graduation omits the generic AI summary even when an AI response exists", () => {
  const html = renderViewHtml(graduationEntry());

  assert.doesNotMatch(html, /class="briefing/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER_GRADUATION_AI/);
});
