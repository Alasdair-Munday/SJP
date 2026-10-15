import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFString } from 'pdf-lib';

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
  await test('giving invitation does not create an extra mostly-empty page', async () => {
    const populated = { ...issue, posts: Array.from({ length: 3 }, (_, i) => ({ title: `Church news ${i}`, summary: 'A community story and invitation. '.repeat(20), eventDetails: '', url: `https://stjohnspark.org/news/${i}/` })) };
    const ordinary = await PDFDocument.load(await renderNewsletterPdf(populated));
    const withGiving = await PDFDocument.load(await renderNewsletterPdf({ ...populated, givingUrl: 'https://stjohnspark.org/get-involved#giving' }));
    assert.equal(withGiving.getPageCount(), ordinary.getPageCount());
  });
} finally { await server.close(); }
