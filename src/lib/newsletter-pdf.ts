import { PDFDocument, PDFString, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import fontkit from '@pdf-lib/fontkit';
import * as fonts from '../assets/pdf-fonts/fonts';
import * as brand from '../assets/pdf-fonts/brand';
import type { NewsletterData } from './newsletter';
import { compactSchedule } from './calendar/compact.mjs';
import { pdfTimetable, isMorningPrayer } from './calendar/pdf-timetable.mjs';
import { timeLabel } from './calendar/dates.mjs';

// The PDF embeds the site's fonts and artwork. No browser or external rendering service.
export async function renderNewsletterPdf(newsletter: NewsletterData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${newsletter.shortTitle} - ${newsletter.formattedDate}`);
  pdf.setAuthor(newsletter.shortTitle);
  pdf.setSubject('Weekly news and Monday–Sunday timetable');
  pdf.registerFontkit(fontkit);
  const body = await pdf.embedFont(Buffer.from(fonts.body, 'base64'), { subset: true });
  const bold = await pdf.embedFont(Buffer.from(fonts.bold, 'base64'), { subset: true });
  const headline = await pdf.embedFont(Buffer.from(fonts.headline, 'base64'), { subset: true });
  const artwork = Object.fromEntries(await Promise.all(Object.entries(brand).map(async ([key, data]) => [key, await pdf.embedPng(Buffer.from(data, 'base64'))])));
  const color = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
  const green = color('#47a174'), ink = color('#04321b'), muted = color('#52665a');
  const stone = color('#eae1cf'), paper = color('#fffdf8'), pink = color('#e8dce8'), sky = color('#a8d7fd');
  const pale = color('#d9e4dd'), blue = color('#19508e'), yellow = color('#f9d800');
  const width = 595.28, height = 841.89, margin = 32, gap = 24;
  const fullWidth = width - margin * 2, columnWidth = (fullWidth - gap) / 2;
  const bottom = 53;
  let page!: PDFPage;
  let column = 0, y = 0, top = 0;
  const x = () => margin + column * (columnWidth + gap);
  const supported = new Map([body, bold, headline].map((font) => [font, new Set(font.getCharacterSet())]));
  const clean = (value: string, font = body) => [...value.normalize('NFC')].map((character) => /\s/.test(character) ? ' ' : supported.get(font)!.has(character.codePointAt(0)!) ? character : '').join('');
  function lines(value: string, font: PDFFont, size: number, available = columnWidth) {
    const words = clean(value, font).trim().split(/\s+/).filter(Boolean), result: string[] = [];
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
  function picture(key: string, px: number, py: number, maxWidth: number, maxHeight: number) {
    const image = artwork[key];
    const scaled = image.scaleToFit(maxWidth, maxHeight);
    page.drawImage(image, { x: px, y: py, ...scaled });
  }
  function newPage() {
    page = pdf.addPage([width, height]); column = 0;
    if (pdf.getPageCount() === 1) {
      page.drawRectangle({ x: 0, y: height - 150, width, height: 150, color: paper });
      picture('logo', margin, height - 52, 180, 49);
      page.drawText('News & life', { x: margin, y: height - 87, size: 25, font: headline, color: ink });
      page.drawText(clean(newsletter.formattedDate), { x: margin, y: height - 107, size: 10, font: body, color: muted });
      picture('eden', width - margin - 127, height - 131, 127, 118);
      const chips = [ { key: 'belong', label: 'BELONG', colour: pink }, { key: 'serve', label: 'SERVE', colour: sky }, { key: 'give', label: 'GIVE', colour: stone } ];
      chips.forEach((chip, index) => {
        const px = margin + index * 112;
        page.drawRectangle({ x: px, y: height - 141, width: 104, height: 23, color: chip.colour });
        picture(chip.key, px + 5, height - 138, 17, 17);
        page.drawText(chip.label, { x: px + 28, y: height - 133, size: 9, font: bold, color: ink });
      });
      page.drawImage(artwork.brush, { x: margin, y: height - 157, width: fullWidth, height: 4 });
      top = height - 174;
    } else {
      picture('logo', margin, height - 40, 118, 32);
      page.drawText(clean(newsletter.formattedDate), { x: width - margin - 100, y: height - 30, size: 9, font: body, color: muted });
      top = height - 62;
    }
    y = top;
  }
  function ensure(space: number) {
    if (y - space < bottom) {
      if (column === 0) { column = 1; y = top; }
      else newPage();
    }
  }
  function text(value: string, font = body, size = 10, colour = ink, leading = size * 1.35) {
    for (const line of lines(value, font, size)) {
      ensure(leading); page.drawText(line, { x: x(), y: y - size, font, size, color: colour }); y -= leading;
    }
  }
  function rule() {
    ensure(14); page.drawLine({ start: { x: x(), y }, end: { x: x() + columnWidth, y }, thickness: .6, color: pale }); y -= 12;
  }
  type Cell = { text: string; font: PDFFont; size: number; colour: ReturnType<typeof rgb>; leading: number };
  const cell = (value: string, font = body, size = 9, colour = ink): Cell => ({ text: value, font, size, colour, leading: size * 1.3 });
  // Full-width panels/table flow row by row, repeating headings on continuation pages.
  function table(headers: string[], contents: Cell[][], backgrounds: ReturnType<typeof rgb>[], headingSize = 11) {
    const cellWidth = fullWidth / headers.length, pad = 10, textWidth = cellWidth - pad * 2;
    const headings = headers.map((header) => lines(header, headline, headingSize, textWidth));
    const headingHeight = Math.max(...headings.map((rows) => rows.length)) * headingSize * 1.35 + pad * 2;
    const expanded = contents.map((items) => items.flatMap((item) => (item.text.trim() ? lines(item.text, item.font, item.size, textWidth) : ['']).map((line) => ({ ...item, text: line }))));
    const count = Math.max(...expanded.map((items) => items.length), 0);
    const drawHeading = () => {
      for (let index = 0; index < headers.length; index++) {
        const px = margin + index * cellWidth;
        page.drawRectangle({ x: px, y: y - headingHeight, width: cellWidth, height: headingHeight, color: backgrounds[index % backgrounds.length] });
        headings[index].forEach((line, row) => page.drawText(line, { x: px + pad, y: y - pad - headingSize - row * headingSize * 1.35, font: headline, size: headingSize, color: ink }));
      }
      y -= headingHeight;
    };
    const firstRowHeight = Math.max(12, ...expanded.map((items) => items[0]?.leading ?? 0));
    if (y - headingHeight - firstRowHeight - 12 < bottom) newPage();
    drawHeading();
    for (let row = 0; row < count; row++) {
      const rowHeight = Math.max(12, ...expanded.map((items) => items[row]?.leading ?? 0));
      if (y - rowHeight - 12 < bottom) { newPage(); drawHeading(); }
      for (let index = 0; index < headers.length; index++) {
        const px = margin + index * cellWidth, item = expanded[index][row];
        page.drawRectangle({ x: px, y: y - rowHeight, width: cellWidth, height: rowHeight, color: paper });
        if (item) page.drawText(item.text, { x: px + pad, y: y - item.size - 3, font: item.font, size: item.size, color: item.colour });
        if (index) page.drawLine({ start: { x: px, y }, end: { x: px, y: y - rowHeight }, color: pale, thickness: .5 });
      }
      y -= rowHeight;
    }
    y -= 15;
  }
  newPage();
  page.drawText('THIS WEEK', { x: margin, y: y - 10, font: bold, size: 10, color: ink }); y -= 17;
  page.drawText(clean(newsletter.schedule.label), { x: margin, y: y - 9, font: body, size: 9, color: muted }); y -= 23;
  if (newsletter.schedule.message) {
    for (const line of lines(newsletter.schedule.message, body, 9, fullWidth)) {
      if (y - 15 < bottom) newPage();
      page.drawText(line, { x: margin, y: y - 9, font: body, size: 9, color: muted }); y -= 13;
    }
    y -= 8;
  }
  if (newsletter.schedule.status !== 'unavailable') {
    const timetable = pdfTimetable(newsletter.schedule);
    const sundayEvents = timetable.sunday?.events.filter((event) => !isMorningPrayer(event)) ?? [];
    const sunday: Cell[] = sundayEvents.length ? [cell(timetable.sunday!.label, bold), ...sundayEvents.flatMap((event) => [cell(timeLabel(event), bold), cell(event.title.replace(/^10:45 Service · /, '')), ...(event.location ? [cell(event.location, body, 8, muted)] : []), cell(' ')])] : [cell('No Sunday events listed', body, 9, muted)];
    const prayerEntries = compactSchedule(timetable.prayers);
    const prayers: Cell[] = prayerEntries.length ? prayerEntries.flatMap((entry) => [cell(entry.dayLabel, bold), cell(entry.timeLabel), ...(entry.first.location ? [cell(entry.first.location, body, 8, muted)] : []), cell(' ')]) : [cell('No morning prayers listed', body, 9, muted)];
    table(['This Sunday', 'Morning prayers'], [sunday, prayers], [pink, sky], 12);
    if (timetable.days.length) {
      if (y - 80 < bottom) newPage();
      page.drawText('AROUND THE CHURCH THIS WEEK', { x: margin, y: y - 9, font: bold, size: 9, color: ink }); y -= 19;
      table(timetable.days.map((day) => day.label), timetable.days.map((day) => day.events.flatMap((event) => [cell(timeLabel(event), bold), cell(event.title), ...(event.location ? [cell(event.location, body, 8, muted)] : []), cell(' ')])), [stone, pink, sky], timetable.days.length > 4 ? 8 : 10);
    }
  }
  if (y - 70 < bottom) newPage();
  page.drawText('NEWS & STORIES', { x: margin, y: y - 12, font: headline, size: 12, color: ink });
  y -= 29; top = y; column = 0;
  if (!newsletter.posts.length) text('No news for this week.', body, 10, muted);
  for (const [index, post] of newsletter.posts.entries()) {
    const titleLines = lines(post.title, headline, 16), summaryLines = lines(post.summary, body, 10);
    const detailsLines = post.eventDetails ? lines(post.eventDetails, bold, 9) : [];
    const needed = 24 + titleLines.length * 21 + detailsLines.length * 12 + summaryLines.length * 13.5 + 112;
    ensure(Math.min(needed, top - bottom));
    const accentKey = ['belong', 'serve', 'give'][index % 3], accent = [color('#d38ab1'), blue, yellow][index % 3];
    picture(accentKey, x() + columnWidth - 23, y - 17, 20, 20);
    text(post.category.toUpperCase(), bold, 8, ink, 17);
    page.drawLine({ start: { x: x(), y: y + 1 }, end: { x: x() + 38, y: y + 1 }, thickness: 3, color: accent });
    y -= 5; text(post.title, headline, 16, ink, 21); y -= 7;
    if (post.eventDetails) { text(post.eventDetails, bold, 9, ink, 12); y -= 6; }
    text(post.summary, body, 10, ink, 13.5); y -= 10;
    ensure(98);
    const qr = await pdf.embedPng(await QRCode.toDataURL(post.url, { errorCorrectionLevel: 'M', margin: 4, width: 384 }));
    page.drawImage(qr, { x: x(), y: y - 90, width: 90, height: 90 });
    lines('Scan to read the full story online', body, 9, columnWidth - 104).forEach((line, row) => page.drawText(line, { x: x() + 104, y: y - 25 - row * 13, font: body, size: 9, color: muted }));
    page.drawText('Read online', { x: x() + 104, y: y - 72, font: bold, size: 9, color: ink });
    const link = pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [x(), y - 90, x() + columnWidth, y], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(post.url) } });
    page.node.addAnnot(pdf.context.register(link)); y -= 106; rule();
  }
  const pages = pdf.getPages();
  for (let index = 0; index < pages.length; index++) {
    const footer = pages[index];
    footer.drawLine({ start: { x: margin, y: 36 }, end: { x: width - margin, y: 36 }, thickness: .7, color: green });
    footer.drawText(clean(new URL(newsletter.onlineUrl).hostname), { x: margin, y: 22, size: 8, font: body, color: muted });
    footer.drawText(`${index + 1} / ${pages.length}`, { x: width - margin - 28, y: 22, size: 8, font: body, color: muted });
  }
  return pdf.save();
}
