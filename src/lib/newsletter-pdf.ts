import { PDFDocument, PDFString, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import fontkit from '@pdf-lib/fontkit';
import * as fonts from '../assets/pdf-fonts/fonts';
import type { NewsletterData } from './newsletter';
import { addDays, dateKey, formatDay, parseIssueDate, timeLabel } from './calendar/dates.mjs';

// A standalone renderer: no browser binary, external PDF service or build-time dates.
export async function renderNewsletterPdf(newsletter: NewsletterData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${newsletter.shortTitle} - ${newsletter.formattedDate}`);
  pdf.setAuthor(newsletter.shortTitle);
  pdf.setSubject('Weekly news and Monday–Sunday timetable');
  pdf.registerFontkit(fontkit);
  const body = await pdf.embedFont(Buffer.from(fonts.body, 'base64'), { subset: true });
  const bold = await pdf.embedFont(Buffer.from(fonts.bold, 'base64'), { subset: true });
  const headline = await pdf.embedFont(Buffer.from(fonts.headline, 'base64'), { subset: true });
  const italic = await pdf.embedFont(Buffer.from(fonts.italic, 'base64'), { subset: true });
  const green = rgb(.12, .28, .22), ink = rgb(.12, .16, .14), muted = rgb(.35, .40, .37);
  const pale = rgb(.86, .90, .86);
  const width = 595.28, height = 841.89, margin = 38, gap = 28;
  const columnWidth = (width - margin * 2 - gap) / 2;
  const bottom = 55;
  let page!: PDFPage;
  let column = 0, y = 0, top = 0;
  const x = () => margin + column * (columnWidth + gap);
  const clean = (value: string, font = body) => [...value.normalize('NFC')].map((character) => {
    if (/\s/.test(character)) return ' ';
    return font.getCharacterSet().includes(character.codePointAt(0)!) ? character : '';
  }).join('');
  function lines(value: string, font: PDFFont, size: number, available = columnWidth) {
    const words = clean(value, font).trim().split(/\s+/).filter(Boolean);
    const result: string[] = [];
    let line = '';
    for (let word of words) {
      if (line && font.widthOfTextAtSize(`${line} ${word}`, size) > available) { result.push(line); line = ''; }
      while (font.widthOfTextAtSize(word, size) > available) {
        let cut = 1;
        while (cut < word.length && font.widthOfTextAtSize(word.slice(0, cut + 1), size) <= available) cut++;
        result.push(word.slice(0, cut)); word = word.slice(cut);
      }
      line = line ? `${line} ${word}` : word;
    }
    if (line) result.push(line);
    return result;
  }
  function newPage() {
    page = pdf.addPage([width, height]); column = 0;
    if (pdf.getPageCount() === 1) {
      page.drawRectangle({ x: 0, y: height - 163, width, height: 163, color: rgb(.97, .96, .92) });
      page.drawText(clean(newsletter.shortTitle.toUpperCase(), bold), { x: margin, y: height - 39, size: 10, font: bold, color: green });
      page.drawText('News & life', { x: margin, y: height - 85, size: 40, font: headline, color: green });
      page.drawText(clean(newsletter.formattedDate), { x: margin, y: height - 112, size: 11, font: body, color: muted });
      page.drawText('BELONG. SERVE. GIVE.', { x: margin, y: height - 140, size: 9, font: bold, color: green });
      top = height - 189;
    } else {
      page.drawText(clean(newsletter.shortTitle.toUpperCase(), bold), { x: margin, y: height - 32, size: 9, font: bold, color: green });
      page.drawText(clean(newsletter.formattedDate), { x: width - margin - 110, y: height - 32, size: 9, font: body, color: muted });
      top = height - 63;
    }
    page.drawLine({ start: { x: width / 2, y: top + 8 }, end: { x: width / 2, y: bottom }, thickness: .5, color: pale });
    y = top;
  }
  function ensure(space: number) {
    if (y - space < bottom) {
      if (column === 0) { column = 1; y = top; }
      else newPage();
    }
  }
  function text(value: string, font = body, size = 10, color = ink, leading = size * 1.4) {
    for (const line of lines(value, font, size)) {
      ensure(leading);
      page.drawText(line, { x: x(), y: y - size, font, size, color });
      y -= leading;
    }
  }
  function rule() {
    ensure(16);
    page.drawLine({ start: { x: x(), y }, end: { x: x() + columnWidth, y }, thickness: .7, color: pale });
    y -= 13;
  }
  newPage();
  text('THIS WEEK', bold, 9, green);
  text(newsletter.schedule.label, italic, 12, muted);
  y -= 10;
  if (newsletter.schedule.message) { text(newsletter.schedule.message, body, 9, muted); y -= 8; }
  if (newsletter.schedule.status !== 'unavailable') {
    for (let day = 0; day < 7; day++) {
      const key = addDays(dateKey(newsletter.schedule.start), day);
      // Include each day of overlapping multi-day events, matching the print view.
      const events = newsletter.schedule.events.filter((event) => dateKey(new Date(event.start)) <= key && dateKey(new Date(Math.max(+new Date(event.start), +new Date(event.end) - 1))) >= key);
      const firstHeight = events.length ? lines(`${timeLabel(events[0])}  ${events[0].title}`, body, 9).length * 12 : 12;
      ensure(30 + firstHeight);
      text(formatDay(parseIssueDate(key)), bold, 10, green);
      if (!events.length) text('No events listed', italic, 9, muted, 12);
      for (const event of events) {
        const label = `${timeLabel(event)}  ${event.title}`;
        const needed = lines(label, body, 9).length * 12 + (event.location ? lines(event.location, body, 8).length * 11 : 0) + 6;
        ensure(Math.min(needed, top - bottom));
        text(label, body, 9, ink, 12);
        if (event.location) text(event.location, body, 8, muted, 11);
        y -= 6;
      }
      y -= 9;
    }
  }
  y -= 8; rule();
  if (!newsletter.posts.length) text('No news for this week.', italic, 11, muted);
  for (const post of newsletter.posts) {
    const titleLines = lines(post.title, headline, 22);
    const summaryLines = lines(post.summary, body, 10);
    const detailsLines = post.eventDetails ? lines(post.eventDetails, bold, 9) : [];
    const needed = 25 + titleLines.length * 25 + detailsLines.length * 13 + summaryLines.length * 14 + 110;
    // Keep ordinary stories together; exceptionally long summaries flow to the next column.
    ensure(Math.min(needed, top - bottom));
    text(post.category.toUpperCase(), bold, 8, green, 15);
    text(post.title, headline, 22, ink, 25); y -= 8;
    if (post.eventDetails) { text(post.eventDetails, bold, 9, green, 13); y -= 7; }
    text(post.summary, body, 10, ink, 14); y -= 12;
    ensure(98);
    const qr = await pdf.embedPng(await QRCode.toDataURL(post.url, { errorCorrectionLevel: 'M', margin: 4, width: 384 }));
    page.drawImage(qr, { x: x(), y: y - 90, width: 90, height: 90 });
    const label = lines('Scan to read the full story online', italic, 10, columnWidth - 104);
    label.forEach((line, index) => page.drawText(line, { x: x() + 104, y: y - 25 - index * 14, font: italic, size: 10, color: muted }));
    page.drawText('Read online', { x: x() + 104, y: y - 72, font: bold, size: 9, color: green });
    // The QR and its label are also clickable in the digital PDF.
    const link = pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [x(), y - 90, x() + columnWidth, y], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(post.url) } });
    page.node.addAnnot(pdf.context.register(link));
    y -= 106; rule();
  }
  const pages = pdf.getPages();
  for (let index = 0; index < pages.length; index++) {
    const footer = pages[index];
    footer.drawLine({ start: { x: margin, y: 39 }, end: { x: width - margin, y: 39 }, thickness: .6, color: pale });
    footer.drawText(clean(new URL(newsletter.onlineUrl).hostname), { x: margin, y: 24, size: 8, font: body, color: muted });
    footer.drawText(`${index + 1} / ${pages.length}`, { x: width - margin - 28, y: 24, size: 8, font: body, color: muted });
  }
  return pdf.save();
}
