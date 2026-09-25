import test from 'node:test';
import assert from 'node:assert/strict';
import { sundayServiceTitle, normalizeTarget } from '../../src/lib/calendar/presentation.mjs';

test('Sunday labels use London time in summer and winter, independent of server TZ', () => {
  assert.equal(sundayServiceTitle({ title: 'Sunday Service', start: '2026-09-06T09:45:00Z' }), '10:45 Service · All In Communion');
  assert.equal(sundayServiceTitle({ title: 'Sunday Service', start: '2026-09-20T09:45:00Z' }), '10:45 Service · Holy Communion');
  assert.equal(sundayServiceTitle({ title: 'Sunday Service', start: '2026-11-08T10:45:00Z' }), '10:45 Service · Service of the Word');
  assert.equal(sundayServiceTitle({ title: 'Special service', start: '2026-09-06T09:45:00Z' }), 'Special service');
});

test('legacy section targets resolve to the new event pages without changing custom links', () => {
  assert.equal(normalizeTarget('/visit#sundays'), '/events/sunday-service');
  assert.equal(normalizeTarget('/community#foodbank'), '/events/foodbank');
  assert.equal(normalizeTarget('/news/special-service'), '/news/special-service');
});
