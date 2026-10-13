import assert from "node:assert/strict";
import test from "node:test";
import { prepareNewsletterBodyHtml } from "./newsletter-html.ts";

const articleUrl = "https://stjohnspark.org/news/example/";
const body = `<h2 id="details">Details</h2><p>Full article text with <strong>emphasis</strong> and a <a href="/visit?from=news&amp;when=sunday">visit link</a>.</p><ul><li>First point</li><li>Second point</li></ul><blockquote><p>A quotation.</p></blockquote><p><img src="/images/uploads/story.jpg" alt="Church life"></p><p><a href="#details">Back to details</a></p><p>The final paragraph.</p>`;

test("preserves complete article content and makes article links and images absolute", () => {
  const html = prepareNewsletterBodyHtml(body, articleUrl);
  assert.match(html, /<h3>Details<\/h3>/);
  assert.match(html, /<strong>emphasis<\/strong>/);
  assert.match(html, /<ul><li>First point<\/li><li>Second point<\/li><\/ul>/);
  assert.match(html, /<blockquote><p>A quotation\.<\/p><\/blockquote>/);
  assert.match(html, /href="https:\/\/stjohnspark.org\/visit\?from=news&#x26;when=sunday"/);
  assert.match(html, /src="https:\/\/stjohnspark.org\/images\/uploads\/story.jpg"/);
  assert.match(html, /href="https:\/\/stjohnspark.org\/news\/example\/#details"/);
  assert.match(html, /The final paragraph\./);
});

test("email body keeps all content with inline formatting and bounded article images", () => {
  const html = prepareNewsletterBodyHtml(body, articleUrl, true);
  assert.match(html, /<h3 style="[^"]*font-size: 20px/);
  assert.match(html, /<ul style="[^"]*padding-left: 24px/);
  assert.match(html, /<blockquote style="[^"]*border-left: 3px/);
  assert.match(html, /<img [^>]*max-width: 480px/);
  assert.match(html, /width="480"/);
  assert.match(html, /The final paragraph\./);
});
