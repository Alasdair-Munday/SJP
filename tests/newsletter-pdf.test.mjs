import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { PDFDocument, PDFPage, PDFName, PDFDict, PDFArray, PDFString } from 'pdf-lib';

// Load the same TypeScript renderer used by the server route.
const server = await createServer({ configFile: false, server: { middlewareMode: true } });
const { renderNewsletterPdf } = await server.ssrLoadModule('/src/lib/newsletter-pdf.ts');
const issue = {
  date: new Date('2026-10-15'), issueDate: '2026-10-15', formattedDate: '15 October 2026',
  shortTitle: "St John's Park", onlineUrl: 'https://stjohnspark.org/newsletter/',
  schedule: { start: new Date('2026-10-11T23:00:00Z'), end: new Date('2026-10-18T23:00:00Z'),
    label: 'Monday 12 October – Sunday 18 October', status: 'fresh', message: '', events: [] },
  posts: [],
};
try {
  await test('front page puts the timetable beneath a full-width thought', async () => {
    const original = PDFPage.prototype.drawText, items = [];
    PDFPage.prototype.drawText = function (value, options) { items.push({ page: this, value, ...options }); return original.call(this, value, options); };
    try {
      await renderNewsletterPdf({ ...issue, thought: { title: 'Weekly thought', body: 'A reflection for our church that should use the full width of the page. '.repeat(3) }, posts: [{ title: 'An event', category: 'event', eventDetails: '1 December', summary: 'Come along.', url: 'https://stjohnspark.org/event' }] }, 'digital');
      const thought = items.find(item => item.value === 'WEEKLY THOUGHT');
      const sunday = items.find(item => item.value === 'THIS SUNDAY');
      assert.equal(thought.page, sunday.page);
      assert.ok(sunday.y < thought.y);
      assert.ok(!items.some(item => item.value === 'UPCOMING EVENTS'));
      assert.ok(items.some(item => item.page === thought.page && item.value.includes('full width of the page')));
    } finally { PDFPage.prototype.drawText = original; }
  });
  await test('thought photo retains aspect ratio, wraps text, and timetable stays within two columns', async () => {
    const sharp = (await import('sharp')).default;
    const image = await sharp({ create: { width: 320, height: 160, channels: 3, background: '#cd1234' } }).png().toBuffer();
    const originalFetch = globalThis.fetch, originalText = PDFPage.prototype.drawText, originalImage = PDFPage.prototype.drawImage;
    const items = [], images = [], requests = [];
    globalThis.fetch = async url => { requests.push(String(url)); return new Response(image); };
    PDFPage.prototype.drawText = function (value, options) { items.push({ page: this, value, ...options }); return originalText.call(this, value, options); };
    PDFPage.prototype.drawImage = function (image, options) { images.push({ page: this, ...options }); return originalImage.call(this, image, options); };
    try {
      const events = Array.from({ length: 60 }, (_, i) => ({ title: `Weekday event ${i}`, start: new Date('2026-10-12T12:00:00Z'), end: new Date('2026-10-12T13:00:00Z') }));
      await renderNewsletterPdf({ ...issue, coverImageSrc: 'https://stjohnspark.org/.netlify/images?url=%2Fphoto.png&w=900&h=550&fit=cover', thought: { title: 'A reflection', body: 'The community gathers for food and friendship. '.repeat(180) }, schedule: { ...issue.schedule, events } }, 'digital');
      const front = items.find(item => item.value === 'A REFLECTION').page;
      const photo = images.find(item => item.page === front && Math.abs(item.width / item.height - 2) < .001);
      assert.ok(photo, 'Thought image must keep its original proportions');
      assert.ok(photo.x > 200, 'Thought image sits on the right');
      const beside = items.filter(item => item.page === front && item.value.includes('community gathers') && item.y < photo.y + photo.height && item.y + item.size > photo.y);
      assert.ok(beside.length);
      for (const item of beside) assert.ok(item.x + item.font.widthOfTextAtSize(item.value, item.size) <= photo.x - 10);
      const sunday = items.find(item => item.value === 'THIS SUNDAY');
      const week = items.find(item => item.value === 'THIS WEEK');
      assert.ok(sunday && week && sunday.page === week.page && sunday.page !== front && week.x > sunday.x + 150);
      assert.equal(sunday.y, week.y);
      assert.ok(items.some(item => item.value === 'Weekday event 0' || item.value.includes('Weekday event 0')));
      for (const item of items.filter(item => item.page === front && item.size > 7)) assert.ok(item.y >= 46, `Front-page text crossed the footer: ${item.value}`);
      assert.ok(items.filter(item => item.value.startsWith('THIS WEEK')).length > 1);
      assert.ok(items.some(item => item.value === 'A reflection (continued)'));
      const request = new URL(requests[0]);
      assert.equal(request.searchParams.has('h'), false);
      assert.equal(request.searchParams.has('fit'), false);
    } finally { globalThis.fetch = originalFetch; PDFPage.prototype.drawText = originalText; PDFPage.prototype.drawImage = originalImage; }
  });
  await test('moves the entire timetable when it cannot fit below the thought', async () => {
    const original = PDFPage.prototype.drawText, items = [];
    PDFPage.prototype.drawText = function (value, options) { items.push({ page: this, value, ...options }); return original.call(this, value, options); };
    try {
      const events = Array.from({ length: 9 }, (_, i) => ({ title: `Gathering ${i}`, start: new Date('2026-10-12T12:00:00Z'), end: new Date('2026-10-12T13:00:00Z') }));
      await renderNewsletterPdf({ ...issue, thought: { title: 'Reflection', body: 'A sentence about our community. '.repeat(65) }, schedule: { ...issue.schedule, events } }, 'digital');
      const front = items.find(item => item.value === 'REFLECTION').page;
      const sunday = items.find(item => item.value === 'THIS SUNDAY');
      const week = items.find(item => item.value === 'THIS WEEK');
      assert.notEqual(sunday.page, front);
      assert.equal(sunday.page, week.page);
      assert.equal(sunday.y, week.y);
      assert.ok(!items.some(item => item.value === 'THIS WEEK (CONTINUED)'));
      for (let i = 0; i < events.length; i++) assert.ok(items.some(item => item.page === week.page && item.value.includes(`Gathering ${i}`)));
    } finally { PDFPage.prototype.drawText = original; }
  });
  await test('digital uses A5 reading pages and print uses imposed A4 landscape sheets', async () => {
    const digital = await PDFDocument.load(await renderNewsletterPdf(issue, 'digital'));
    assert.equal(digital.getPageCount(), 2, 'Front and back covers remain in reading order');
    assert.equal(Math.round(digital.getPage(0).getWidth()), 421);
    assert.equal(Math.round(digital.getPage(0).getHeight()), 595);

    const print = await PDFDocument.load(await renderNewsletterPdf(issue, 'print'));
    assert.equal(print.getPageCount(), 2, 'Four logical pages make one double-sided sheet');
    assert.equal(Math.round(print.getPage(0).getWidth()), 842);
    assert.equal(Math.round(print.getPage(0).getHeight()), 595);
  });
  await test('long summaries preserve every full-story link', async () => {
    const posts = Array.from({ length: 8 }, (_, i) => ({
      title: `Community story ${i + 1}`, category: 'update', summary: 'Our community gathers to share food, friendship and faith. '.repeat(i === 0 ? 120 : 8),
      eventDetails: '', url: `https://stjohnspark.org/news/story-${i + 1}/`,
    }));
    const doc = await PDFDocument.load(await renderNewsletterPdf({ ...issue, posts }, 'digital'));
    assert.ok(doc.getPageCount() > 1);
    const links = [];
    for (const page of doc.getPages()) {
      const annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
      for (const ref of annotations?.asArray() ?? []) {
        const annotation = doc.context.lookup(ref, PDFDict);
        links.push(annotation.lookup(PDFName.of('A'), PDFDict).lookup(PDFName.of('URI'), PDFString).decodeText());
      }
    }
    assert.deepEqual(links.filter((href) => href.includes('/news/story-')), posts.map((post) => post.url));
  });
  await test('fixed rows truncate long posts, preserve links, and leave room for giving', async () => {
    const original = PDFPage.prototype.drawText, items = [];
    PDFPage.prototype.drawText = function (value, options) { items.push({ page: this, value, ...options }); return original.call(this, value, options); };
    try {
      for (const edition of ['digital', 'print']) {
        items.length = 0;
        const posts = Array.from({ length: 5 }, (_, i) => ({ title: `Story ${i + 1}`, summary: 'Long story content '.repeat(300), url: `https://stjohnspark.org/news/story-${i}/` }));
        const doc = await PDFDocument.load(await renderNewsletterPdf({ ...issue, posts, givingUrl: 'https://stjohnspark.org/give' }, edition));
        const titles = items.filter(item => /^STORY [1-5]$/.test(item.value));
        assert.equal(titles.length, 5);
        assert.equal(titles[0].page, titles[2].page);
        assert.equal(titles[3].page, titles[4].page);
        const giving = items.find(item => item.value === 'Will You Partner With Us?');
        assert.equal(giving.page, titles[4].page);
        assert.ok(giving.y < titles[4].y - 140);
        assert.ok(items.filter(item => item.value.includes('Long story content')).length < 100);
        const links = doc.getPages().flatMap(page => (page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)?.asArray() ?? []).map(ref => doc.context.lookup(ref, PDFDict).lookup(PDFName.of('A'), PDFDict).lookup(PDFName.of('URI'), PDFString).decodeText()));
        for (const post of posts) assert.ok(links.includes(post.url));
        assert.ok(links.includes('https://stjohnspark.org/give'));
      }
    } finally { PDFPage.prototype.drawText = original; }
  });
  await test('seven stories use a single full-width column with one post per row', async () => {
    const originalText = PDFPage.prototype.drawText;
    const items = [];
    PDFPage.prototype.drawText = function (value, options) {
      items.push({ page: this, value, ...options });
      return originalText.call(this, value, options);
    };
    try {
      const posts = Array.from({ length: 7 }, (_, index) => ({
        title: `News ${index + 1}`,
        summary: 'A community story with enough detail to exercise the normal newsletter row layout. '.repeat(3),
        url: `https://stjohnspark.org/news/story-${index + 1}/`,
      }));
      await renderNewsletterPdf({ ...issue, posts }, 'digital');
      const titles = items.filter((item) => /^NEWS [1-7]$/.test(item.value));
      assert.equal(titles.length, 7);
      assert.ok(titles.every((item) => Math.abs(item.x - titles[0].x) < .01), 'Every post must use the same single-column left edge');

      const byPage = new Map();
      for (const title of titles) {
        const pageItems = byPage.get(title.page) ?? [];
        pageItems.push(title);
        byPage.set(title.page, pageItems);
      }
      assert.ok([...byPage.values()].some((pageItems) => pageItems.length > 1), 'Rows should stack vertically where space allows');
      for (const pageItems of byPage.values()) {
        pageItems.sort((a, b) => b.y - a.y);
        for (let index = 1; index < pageItems.length; index++) {
          assert.ok(pageItems[index - 1].y - pageItems[index].y > 50, 'Successive post rows must not overlap');
        }
      }
    } finally { PDFPage.prototype.drawText = originalText; }
  });

  await test('back cover includes giving without prayer or newsletter-feedback links', async () => {
    const doc = await PDFDocument.load(await renderNewsletterPdf({ ...issue, givingUrl: 'https://stjohnspark.org/get-involved#giving' }, 'digital'));
    const links = doc.getPages().flatMap((page) => {
      const annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
      return (annotations?.asArray() ?? []).map((ref) => doc.context.lookup(ref, PDFDict).lookup(PDFName.of('A'), PDFDict).lookup(PDFName.of('URI'), PDFString).decodeText());
    });
    assert.ok(links.includes('https://stjohnspark.org/get-involved#giving'));
    assert.ok(!links.some((href) => href.startsWith('mailto:prayer@stjohnspark.org')));
    assert.ok(!links.some((href) => href.startsWith('mailto:feedback@stjohnspark.org')));
  });

  await test('photos use only the site origin and render without an external image service', async () => {
    const { logo } = await server.ssrLoadModule('/src/assets/pdf-fonts/brand.ts');
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url) => {
      requests.push(String(url));
      return new Response(Buffer.from(logo, 'base64'), { headers: { 'Content-Type': 'image/png' } });
    };
    try {
      const doc = await PDFDocument.load(await renderNewsletterPdf({ ...issue,
        coverImageSrc: 'https://unrelated.invalid/photo.jpg',
        posts: [{ title: 'A church story', summary: 'A short summary.', imageSrc: 'https://stjohnspark.org/photo.jpg', eventDetails: '', url: 'https://stjohnspark.org/news/story/' }],
      }, 'digital'));
      assert.deepEqual(requests, ['https://stjohnspark.org/photo.jpg']);
      const images = doc.getPage(1).node.Resources().lookup(PDFName.of('XObject'), PDFDict);
      assert.ok(images.keys().length >= 4, 'Logo, Eden art, article photograph and QR must be embedded');
    } finally { globalThis.fetch = originalFetch; }
  });
  await test('both editions preserve the full giving invitation and clickable giving link', async () => {
    const populated = { ...issue, posts: Array.from({ length: 3 }, (_, i) => ({ title: `Church news ${i}`, summary: 'A community story and invitation. '.repeat(20), eventDetails: '', url: `https://stjohnspark.org/news/${i}/` })) };
    const ordinary = await PDFDocument.load(await renderNewsletterPdf(populated));
    const withGiving = await PDFDocument.load(await renderNewsletterPdf({ ...populated, givingUrl: 'https://stjohnspark.org/get-involved#giving' }));
    assert.ok(withGiving.getPageCount() <= ordinary.getPageCount() + 1);
    for (const edition of ['print', 'digital']) {
      const bytes = await renderNewsletterPdf({ ...populated, givingUrl: 'https://stjohnspark.org/get-involved#giving' }, edition);
      const doc = await PDFDocument.load(bytes);
      const links = doc.getPages().flatMap((page) => {
        const annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
        return (annotations?.asArray() ?? []).map((ref) => doc.context.lookup(ref, PDFDict).lookup(PDFName.of('A'), PDFDict).lookup(PDFName.of('URI'), PDFString).decodeText());
      });
      assert.ok(links.some((href) => href.endsWith('#giving')));
    }
  });
} finally { await server.close(); }
