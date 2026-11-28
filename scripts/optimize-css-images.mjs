// Keep source URLs intact in development and ask Netlify to transform the
// deployed stylesheets' local artwork at a sensible maximum size.
export function optimizeCssImages(css) {
  return css.replace(/url\((["']?)(\/images\/shapes\/[^"')]+\.(?:png|jpe?g|webp))\1\)/gi,
    (_match, quote, src) => `url(${quote}/.netlify/images?url=${encodeURIComponent(src)}&w=1024&q=80${quote})`);
}

export function netlifyCssImages() {
  return {
    name: 'netlify-css-images',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type !== 'asset' || !asset.fileName.endsWith('.css') || typeof asset.source !== 'string') continue;
        asset.source = optimizeCssImages(asset.source);
      }
    },
  };
}
