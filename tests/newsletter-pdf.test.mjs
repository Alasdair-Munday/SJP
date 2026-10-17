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
  await test('empty issue produces a printable A4 PDF', async () => {
    const doc = await PDFDocument.load(await renderNewsletterPdf(issue));
    assert.equal(doc.getPageCount(), 1);
    assert.equal(Math.round(doc.getPage(0).getWidth()), 595);
    assert.equal(Math.round(doc.getPage(0).getHeight()), 842);
  });
  await test('long summaries flow across pages and preserve every full-story link', async () => {
    const posts = Array.from({ length: 8 }, (_, i) => ({
      title: `Community story ${i + 1}`, category: 'update', summary: 'Our community gathers to share food, friendship and faith. '.repeat(i === 0 ? 120 : 8),
      eventDetails: '', url: `https://stjohnspark.org/news/story-${i + 1}/`,
    }));
    const doc = await PDFDocument.load(await renderNewsletterPdf({ ...issue, posts }));
    assert.ok(doc.getPageCount() > 1);
    const links = [];
    for (const page of doc.getPages()) {
      const annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
      for (const ref of annotations?.asArray() ?? []) {
        const annotation = doc.context.lookup(ref, PDFDict);
        links.push(annotation.lookup(PDFName.of('A'), PDFDict).lookup(PDFName.of('URI'), PDFString).decodeText());
      }
    }
    assert.deepEqual(links, posts.map((post) => post.url));
  });
  await test('article text wraps beside a bottom-right QR with its caption below in both editions', async () => {
    const originalText = PDFPage.prototype.drawText, originalImage = PDFPage.prototype.drawImage;
    let textItems = [], images = [];
    PDFPage.prototype.drawText = function (value, options) {
      textItems.push({ page: this, value, ...options });
      return originalText.call(this, value, options);
    };
    PDFPage.prototype.drawImage = function (image, options) {
      images.push({ page: this, ...options });
      return originalImage.call(this, image, options);
    };
    try {
      for (const edition of ['print', 'digital']) {
        for (const repetitions of [1, 12, 120]) {
          textItems = []; images = [];
          const summary = `${'Our community gathers to share food, friendship and faith. '.repeat(repetitions)}\n\nEveryone is welcome to join us and find out more.`;
          const url = 'https://stjohnspark.org/news/community/';
          const doc = await PDFDocument.load(await renderNewsletterPdf({ ...issue, posts: [{ title: 'Community life', summary, url }], givingUrl: repetitions === 120 ? 'https://stjohnspark.org/get-involved#giving' : undefined }, edition));
          const givingIndex = textItems.findIndex((item) => item.value === 'Will You Partner With Us?');
          const summaryText = (givingIndex === -1 ? textItems : textItems.slice(0, givingIndex)).filter((item) => item.size === 10);
          assert.equal(summaryText.map((item) => item.value).join(' '), summary.replace(/\s+/g, ' ').trim(), 'Every summary word must survive wrapping and page breaks');
          if (givingIndex !== -1) {
            const givingTitle = textItems[givingIndex];
            for (const item of summaryText.filter((item) => item.page === givingTitle.page)) assert.ok(item.y >= givingTitle.y + 32, 'Giving invitation must stay below both article columns');
          }
          const qr = images.find((item) => item.width === 64 && item.height === 64);
          assert.ok(qr, 'Article QR must retain its scannable size');
          const captions = textItems.filter((item) => item.page === qr.page && item.size === 8 && item.y >= 51 && item.y < qr.y && item.x >= qr.x && item.x < qr.x + qr.width);
          assert.equal(captions.map((item) => item.value).join(' '), edition === 'digital' ? 'Tap or scan for the full story' : 'Scan for the full story');
          assert.ok(Math.abs(qr.y - (captions[0].y + captions[0].size) - 4) < .01, 'Caption must sit directly below QR');
          const beside = summaryText.filter((item) => item.page === qr.page && item.y < qr.y + qr.height && item.y + item.size > captions.at(-1).y);
          assert.ok(beside.length > 0, 'Summary text must occupy the space beside QR');
          for (const item of beside) assert.ok(item.x + item.font.widthOfTextAtSize(item.value, item.size) <= qr.x - 10 + .01, 'Text must not overlap QR or its caption');
          assert.ok(qr.x > beside[0].x, 'QR belongs at the right of the article');
          for (const page of doc.getPages()) {
            const annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
            for (const ref of annotations?.asArray() ?? []) {
              const rect = doc.context.lookup(ref, PDFDict).lookup(PDFName.of('Rect'), PDFArray).asArray().map((value) => value.asNumber());
              assert.ok(rect[1] >= 51, 'QR and caption must stay above the footer');
              const target = doc.context.lookup(ref, PDFDict).lookup(PDFName.of('A'), PDFDict).lookup(PDFName.of('URI'), PDFString).decodeText();
              if (target === url) assert.ok(Math.abs(rect[2] - rect[0] - 64) < .01, 'Clickable area must cover QR and caption');
            }
          }
        }
      }
    } finally { PDFPage.prototype.drawText = originalText; PDFPage.prototype.drawImage = originalImage; }
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
      }));
      assert.deepEqual(requests, ['https://stjohnspark.org/photo.jpg']);
      const images = doc.getPage(0).node.Resources().lookup(PDFName.of('XObject'), PDFDict);
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
      const annotations = doc.getPages().at(-1).node.lookup(PDFName.of('Annots'), PDFArray);
      assert.ok(annotations.asArray().some((ref) => doc.context.lookup(ref, PDFDict).lookup(PDFName.of('A'), PDFDict).lookup(PDFName.of('URI'), PDFString).decodeText().endsWith('#giving')));
    }
  });
} finally { await server.close(); }
