import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey } from '../../src/lib/calendar/dates.mjs';
const base = process.env.CALENDAR_TEST_BASE_URL;
const options = { skip: !base };
const ids = (html) => [...html.matchAll(/data-calendar-id="([^"]+)"/g)].map((match) => match[1]);

test('live server: homepage, print and email contain identical current-week occurrences', options, async () => {
  const key = dateKey();
  const paths = ['/', `/newsletter/?date=${key}`, `/newsletter/email/raw/?date=${key}`];
  const results = await Promise.all(paths.map(async (path) => {
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return response.text();
  }));
  assert.ok(ids(results[0]).length > 0, 'Live feed should supply this week’s events');
  assert.deepEqual(ids(results[0]), ids(results[1]));
  assert.deepEqual(ids(results[1]), ids(results[2]));
  assert.ok(results[1].indexOf('id="this-week-title"') < results[1].indexOf('class="newsletter-post"'));
  assert.match(results[2], /https:\/\/stjohnspark.org\/events\/foodbank/);
});
test('live server: bad issue dates and missing news routes return meaningful errors', options, async () => {
  for (const path of ['/newsletter/?date=2026-02-30', '/newsletter/email/?date=invalid', '/newsletter/email/raw/?date=2026-13-01']) {
    assert.equal((await fetch(new URL(path, base))).status, 400);
  }
  assert.equal((await fetch(new URL('/news/not-an-actual-post', base))).status, 404);
});
test('live server: connected activities show the next two upcoming sessions at the correct anchors', options, async () => {
  for (const [path, anchor] of [['/community', 'foodbank'], ['/park-youth', 'cornerstone'], ['/visit', 'sundays']]) {
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(`id="${anchor}"`));
    const dateBlocks = (html.match(/class="upcoming-dates"/g) ?? []).length;
    assert.equal((html.match(/<time datetime=/g) ?? []).length, dateBlocks * 2);
  }
});
test('live server: weekly social review has three slots and calendar-backed Sunday copy', options, async () => {
  const response = await fetch(new URL('/newsletter/social/', base));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const html = await response.text();
  assert.equal((html.match(/class="social-card"/g) ?? []).length, 3);
  assert.match(html, /Tuesday · Tuesday/);
  assert.match(html, /Thursday · Thursday/);
  assert.match(html, /Saturday · Saturday/);
  assert.match(html, /Public Google Calendar/);
  assert.match(html, /https:\/\/stjohnspark\.org\/events\/sunday-service/);
});
