const decode = (text) => text.replace(/&(?:amp|nbsp|quot|apos|lt|gt);|&#(?:x[\da-f]+|\d+);/gi, (entity) => {
  const names = { '&amp;': '&', '&nbsp;': ' ', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
  if (entity.toLowerCase() in names) return names[entity.toLowerCase()];
  const hex = entity.toLowerCase().startsWith('&#x');
  const code = parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
  return code <= 0x10ffff ? String.fromCodePoint(code) : '';
});

// Only an explicitly labelled Website line establishes a relationship.
// Never render calendar HTML or guess from a title or an unrelated link.
export function websiteLink(description = '') {
  const text = decode((description ?? "")
    .replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi, '$1')
    .replace(/<\/?(?:div|p|br|li|section)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ''));
  const lines = [...text.matchAll(/(?:^|\n)\s*Website\s*:\s*([^\n]*)/gi)].map((match) => match[1].trim());
  if (!lines.length) return { value: undefined, issue: 'missing website link', explicit: false };
  const unique = [...new Set(lines)];
  if (unique.length !== 1 || !/^(https:\/\/|\/)[^\s]+$/.test(unique[0])) {
    return { value: undefined, issue: 'invalid or ambiguous Website line', explicit: true };
  }
  return { value: unique[0], issue: undefined, explicit: true };
}

export function canonicalTarget(value, siteUrl = 'https://stjohnspark.org') {
  try {
    const url = new URL(value, siteUrl);
    if (url.origin !== new URL(siteUrl).origin || url.search || url.username || url.password) return undefined;
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return `${path}${url.hash}`;
  } catch { return undefined; }
}

export function resolveTarget(value, targets, siteUrl) {
  if (!value) return undefined;
  const target = canonicalTarget(value, siteUrl);
  return target && targets.has(target) ? target : undefined;
}
