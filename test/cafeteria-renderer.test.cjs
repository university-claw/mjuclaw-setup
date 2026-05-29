const assert = require("node:assert/strict");
const test = require("node:test");
const { renderViewHtml } = require("../dist/view-renderer.js");

const BANGMOK = "\uBC29\uBAA9\uAE30\uB150\uAD00";
const FACULTY = "\uAD50\uC9C1\uC6D0";
const FACULTY_CAFETERIA = "\uAD50\uC9C1\uC6D0\uC2DD\uB2F9";

function cafeteriaEntry(sourceName) {
  return {
    id: "cafeteria-test-view",
    dataType: "cafeteria",
    title: "\uD559\uC2DD",
    createdAt: new Date("2026-05-15T11:00:00.000Z").getTime(),
    expiresAt: new Date("2026-05-15T11:30:00.000Z").getTime(),
    rawData: {
      items: [
        {
          sourceId: "bangmok",
          sourceName,
          serviceDate: "2026-05-15",
          mealType: "lunch",
          isClosed: false,
          menuText: "\uD1A0\uB9C8\uD1A0\uC2A4\uD30C\uAC8C\uD2F0",
          menuItems: ["\uD1A0\uB9C8\uD1A0\uC2A4\uD30C\uAC8C\uD2F0"],
        },
      ],
    },
  };
}

test("cafeteria renders bangmok without a separate faculty row", () => {
  const html = renderViewHtml(cafeteriaEntry(BANGMOK));

  assert.match(html, new RegExp(`<div class="cafeteria-place">${BANGMOK}</div>`));
  assert.doesNotMatch(html, new RegExp(`<div class="cafeteria-place">${FACULTY}</div>`));
});

test("cafeteria maps faculty cafeteria aliases to bangmok", () => {
  const html = renderViewHtml(cafeteriaEntry(FACULTY_CAFETERIA));

  assert.match(html, new RegExp(`<div class="cafeteria-place">${BANGMOK}</div>`));
  assert.doesNotMatch(html, new RegExp(`<div class="cafeteria-place">${FACULTY}</div>`));
});
