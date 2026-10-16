import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, server: { middlewareMode: true } });
const { parseFeed, parseAudioComProfile } = await server.ssrLoadModule('/src/lib/talks.ts');
const author = '1864352901200967';
const item = { id: '1878753755177196', user: author, listed: true,
  title: '11/10/2026 Matthew 5 - Open Doors - Lee Proudlove', slug: 'open-doors',
  created: Date.parse('2026-10-11') / 1000, play: {duration: 2352501, url: 'https://example.test/expired.mp3?signature=old'},
  description: '<p>Hope & welcome</p>', image: 'https://audio.com/cover.jpeg' };
const profile = (items, authorId = author) => {
  const json = JSON.stringify({screen: {data: {author: {id: authorId}, audio: {items}}}})
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  return `<div class="js-store" data-content="${json}"></div>`;
};
try {
  await test('empty Audio.com RSS is detected while normal RSS still parses', () => {
    assert.deepEqual(parseFeed('<rss><channel></channel></rss>'), []);
    const [talk] = parseFeed('<rss><channel><item><title>11/10/26 // Open Doors // Lee Proudlove</title><pubDate>Sun, 11 Oct 2026 10:00:00 GMT</pubDate><enclosure url="https://example.test/talk.mp3"/></item></channel></rss>');
    assert.equal(talk.title, 'Open Doors');
    assert.equal(talk.speaker, 'Lee Proudlove');
    assert.equal(talk.audioUrl, 'https://example.test/talk.mp3');
  });
  await test('public recordings get permanent embeds rather than expiring MP3s', () => {
    const [talk] = parseAudioComProfile(profile([item]));
    assert.equal(talk.date, '2026-10-11');
    assert.equal(talk.title, 'Matthew 5 - Open Doors');
    assert.equal(talk.speaker, 'Lee Proudlove');
    assert.equal(talk.duration, 2353);
    assert.equal(talk.description, 'Hope & welcome');
    assert.equal(talk.embedUrl, 'https://audio.com/embed/audio/1878753755177196');
    assert.equal(talk.audioUrl, '');
    assert.ok(!JSON.stringify(talk).includes('signature=old'));
  });
  await test('unlisted recordings, other authors and invalid IDs are excluded', () => {
    assert.deepEqual(parseAudioComProfile(profile([
      {...item, listed:false}, {...item,user:'someone-else'}, {...item,id:'invalid"'},
    ])), []);
    assert.throws(() => parseAudioComProfile(profile([item], 'someone-else')));
    assert.throws(() => parseAudioComProfile('<html>Temporarily unavailable</html>'));
  });
  await test('future year typo does not place an older recording first', () => {
    const talks = parseAudioComProfile(profile([item, {...item,id:'123',title:'06-09-2029 Creation - Tim Cooper',created:Date.parse('2026-09-06')/1000}]));
    assert.equal(talks[0].title, 'Matthew 5 - Open Doors');
    assert.equal(talks[1].date, '2026-09-06');
  });
} finally { await server.close(); }
