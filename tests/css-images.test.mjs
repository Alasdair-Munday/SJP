import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimizeCssImages, netlifyCssImages } from '../scripts/optimize-css-images.mjs';

test('optimizes local CSS shape images without changing unrelated URLs', () => {
  const css = `a{mask:url("/images/shapes/circle shape.png")}b{background:url('/images/shapes/heart.png')}c{background:url('/images/other.png')}d{background:url('/images/shapes/icon.svg')}`;
  const out = optimizeCssImages(css);
  assert.match(out, /url\("\/\.netlify\/images\?url=%2Fimages%2Fshapes%2Fcircle%20shape.png&w=1024&q=80"\)/);
  assert.match(out, /url\('\/\.netlify\/images\?url=%2Fimages%2Fshapes%2Fheart.png&w=1024&q=80'\)/);
  assert.match(out, /url\('\/images\/other.png'\)/);
  assert.match(out, /url\('\/images\/shapes\/icon.svg'\)/);
  assert.match(optimizeCssImages('a{mask:url(/images/shapes/a.png)}'), /\.netlify\/images/);
});

test('plugin is build-only and rewrites CSS assets only', () => {
  const plugin = netlifyCssImages();
  assert.equal(plugin.apply, 'build');
  const css = { type: 'asset', fileName: 'site.css', source: 'a{mask:url("/images/shapes/a.png")}' };
  const js = { type: 'asset', fileName: 'script.js', source: 'url("/images/shapes/a.png")' };
  plugin.generateBundle({}, { css, js });
  assert.match(css.source, /\.netlify\/images/);
  assert.doesNotMatch(js.source, /\.netlify\/images/);
});
