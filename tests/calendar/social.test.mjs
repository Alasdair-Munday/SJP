import test from 'node:test';
import assert from 'node:assert/strict';
import { socialPublicationDates, shortDesignTitle, isSocialPostEligible, captions } from '../../src/lib/social-core.mjs';

test('social dates always use the Tuesday, Thursday and Saturday of the selected week', () => {
  assert.deepEqual(socialPublicationDates('2026-09-19'), {
    tuesday: '2026-09-15', thursday: '2026-09-17', saturday: '2026-09-19', nextMonday: '2026-09-21',
  });
  assert.equal(socialPublicationDates('2026-09-20').tuesday, '2026-09-15');
  assert.equal(socialPublicationDates('2026-09-21').tuesday, '2026-09-22');
});

test('people stories require both editorial approval and valid consent', () => {
  const post = { socialEnabled: true, socialConsentConfirmed: true, publishDate: new Date('2026-09-01'), socialDoNotUseAfter: new Date('2026-09-30') };
  assert.equal(isSocialPostEligible(post, '2026-09-15'), true);
  assert.equal(isSocialPostEligible({ ...post, socialConsentConfirmed: false }, '2026-09-15'), false);
  assert.equal(isSocialPostEligible({ ...post, socialDoNotUseAfter: new Date('2026-09-14') }, '2026-09-15'), false);
});

test('generated copy preserves the website link and keeps design text short', () => {
  assert.equal(shortDesignTitle('one two three four', 3), 'one two three…');
  const copy = captions({ intro: 'Welcome', body: 'Join us.', url: 'https://stjohnspark.org/visit' });
  assert.match(copy.facebook, /https:\/\/stjohnspark\.org\/visit/);
  assert.match(copy.instagram, /#StJohnsPark/);
});
