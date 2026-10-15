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
} finally { await server.close(); }
