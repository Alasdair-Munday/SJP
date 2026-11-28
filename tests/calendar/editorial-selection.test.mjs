import test from "node:test";
import assert from "node:assert/strict";
import { filterNewsletterItems, newsletterSelectionQuery } from "../../src/lib/calendar/newsletter-selection.mjs";
const posts = [{id:"news"}, {id:"event"}];
test("an uncustomised newsletter retains all eligible items", () => {
  assert.deepEqual(filterNewsletterItems(posts, new URLSearchParams(), "post"), posts);
});
test("custom selections only include selected IDs, including none", () => {
  assert.deepEqual(filterNewsletterItems(posts, new URLSearchParams("selection=custom&post=event&post=unknown"), "post"), [posts[1]]);
  assert.deepEqual(filterNewsletterItems(posts, new URLSearchParams("selection=custom"), "post"), []);
});
test("timetable and article selections are independent and survive export links", () => {
  const params = new URLSearchParams("date=2026-11-30&selection=custom&post=event&event=calendar-1&edition=print");
  const query = newsletterSelectionQuery(params);
  assert.equal(query.get("date"), "2026-11-30");
  assert.equal(query.has("edition"), false);
  assert.deepEqual(filterNewsletterItems([{id:"calendar-1"},{id:"calendar-2"}], query, "event"), [{id:"calendar-1"}]);
  assert.deepEqual(filterNewsletterItems(posts, query, "post"), [posts[1]]);
});
