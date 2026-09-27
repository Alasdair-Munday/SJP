import { readFile, readdir } from 'node:fs/promises';
import { expandCalendar } from '../src/lib/calendar/core.mjs';
import { refreshSnapshot } from '../src/lib/calendar/store.mjs';
import { parseIssueDate, sixMonthsFrom } from '../src/lib/calendar/dates.mjs';
import { resolveTarget } from '../src/lib/calendar/links.mjs';

const args = process.argv.slice(2);
const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
try {
  const now = parseIssueDate(option('--date'));
  const file = option('--file');
  // Diagnostic is read-only: no writes to CMS files or the production snapshot.
  const snapshot = file ? { text: await readFile(file, 'utf8'), verifiedAt: undefined, error: undefined } : await refreshSnapshot(undefined);
  if (snapshot.error) throw new Error(snapshot.error);
  const targets = new Set();
  const configured = [];
  for (const file of await readdir('src/content/pages')) {
    if (!file.endsWith('.json')) continue;
    const page = JSON.parse(await readFile(`src/content/pages/${file}`, 'utf8'));
    const path = file === 'home.json' ? '/' : `/${file.replace('.json', '')}`;
    targets.add(path);
    for (const section of page.sections) {
      if (section.id) targets.add(`${path}#${section.id}`);
      if (section.calendarTarget) configured.push(section.calendarTarget);
      for (const card of section.cards ?? []) {
        if (card.id) targets.add(`${path}#${card.id}`);
        if (card.calendarTarget) configured.push(card.calendarTarget);
      }
    }
  }
  for (const file of await readdir('src/content/posts')) {
    if (!file.endsWith('.md')) continue;
    const text = await readFile(`src/content/posts/${file}`, 'utf8');
    const slug = text.match(/^slug:\s*["']?([^\n"']+)/m)?.[1] ?? file.replace(/\.md$/, '');
    targets.add(`/news/${slug}`);
  }
  const events = expandCalendar(snapshot.text, now, sixMonthsFrom(now));
  for (const file of await readdir('src/content/events')) {
    if (file.endsWith('.md')) targets.add(`/events/${file.replace(/\.md$/, '')}`);
  }
  const series = new Map();
  for (const event of events) {
    const href = resolveTarget(event.website, targets);
    const issue = href ? undefined : event.linkIssue || 'Website link does not match a published page or section';
    series.set(`${event.uid}:${event.website ?? issue}`, { title: event.title, uid: event.uid, href, issue });
  }
  const linked = new Set(events.map((event) => resolveTarget(event.website, targets)).filter(Boolean));
  const unmatchedBlocks = configured.filter((target) => !linked.has(target));
  console.log(JSON.stringify({ checkedAt: snapshot.verifiedAt ?? 'local fixture (not a live check)', rangeStart: now.toISOString(), occurrences: events.length, series: [...series.values()], unmatchedBlocks }, null, 2));
  if (unmatchedBlocks.length || [...series.values()].some((item) => item.issue)) process.exitCode = 2;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
