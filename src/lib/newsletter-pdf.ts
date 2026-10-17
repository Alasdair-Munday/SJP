import { PDFDocument, PDFString, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib';
import QRCode from 'qrcode';
import fontkit from '@pdf-lib/fontkit';
import * as fonts from '../assets/pdf-fonts/fonts';
import * as brand from '../assets/pdf-fonts/brand';
import type { NewsletterData } from './newsletter';
import { compactSchedule } from './calendar/compact.mjs';
import { pdfTimetable, isMorningPrayer } from './calendar/pdf-timetable.mjs';
import { timeLabel } from './calendar/dates.mjs';

export type NewsletterPdfEdition = 'print' | 'digital';
export const givingCopy = 'We have a vision to see Eden life spring up in our community through the love of Jesus.\n\nThis requires financial resources. Your regular gift will make a huge difference to us in seeing our kingdom dreams come to life. A regular gift through the Parish Giving Scheme is the best way to give.\n\nScan the QR code to sign up.';

export async function renderNewsletterPdf(newsletter: NewsletterData, edition: NewsletterPdfEdition = 'print'): Promise<Uint8Array> {
  const digital = edition === 'digital';
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${newsletter.shortTitle} - ${newsletter.formattedDate}`);
  pdf.setAuthor(newsletter.shortTitle);
  pdf.setSubject('Weekly news and Monday–Sunday timetable');
  pdf.registerFontkit(fontkit);
  const body = await pdf.embedFont(Buffer.from(fonts.body, 'base64'), { subset: true });
  const bold = await pdf.embedFont(Buffer.from(fonts.bold, 'base64'), { subset: true });
  const headline = await pdf.embedFont(Buffer.from(fonts.headline, 'base64'), { subset: true });
  const art = Object.fromEntries(await Promise.all(Object.entries(brand).map(async ([key, data]) => [key, await pdf.embedPng(Buffer.from(data, 'base64'))])));
  const hex = (value: string) => rgb(parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255);
  const green = hex('#1b8257'), ink = hex('#04321b'), muted = hex('#52665a'), lineColor = hex('#d9e4dd');
  const paper = digital ? hex('#eae1cf') : rgb(1, 1, 1);
  const panelText = digital ? rgb(1, 1, 1) : ink;
  const panelHeading = digital ? rgb(1, 1, 1) : green;
  const width = 595.28, height = 841.89, margin = 30, gap = 24, bottom = 51;
  const fullWidth = width - margin * 2, columnWidth = (fullWidth - gap) / 2;
  const leadWidth = fullWidth * .56, sideX = margin + leadWidth + 18, sideWidth = fullWidth - leadWidth - 18;
  let page!: PDFPage, column = 0, y = 0, top = 0, activeCard = false;
  const pageBottoms = new Map<PDFPage, number>();
  const px = () => margin + column * (columnWidth + gap);
  const sets = new Map([body, bold, headline].map((font) => [font, new Set(font.getCharacterSet())]));
  const clean = (value: string, font = body) => [...value.normalize('NFC')].map((char) => /\s/.test(char) ? ' ' : sets.get(font)!.has(char.codePointAt(0)!) ? char : '').join('');
  function lines(value: string, font = body, size = 10, available: number | ((row: number) => number) = columnWidth) {
    const words = clean(value, font).trim().split(/\s+/).filter(Boolean), result: string[] = [];
    const rowWidth = () => typeof available === 'number' ? available : available(result.length);
    let current = '';
    for (let word of words) {
      if (current && font.widthOfTextAtSize(`${current} ${word}`, size) > rowWidth()) { result.push(current); current = ''; }
      while (font.widthOfTextAtSize(word, size) > rowWidth()) {
        let cut = 1;
        while (cut < word.length && font.widthOfTextAtSize(word.slice(0, cut + 1), size) <= rowWidth()) cut++;
        result.push(word.slice(0, cut)); word = word.slice(cut);
      }
      current = current ? `${current} ${word}` : word;
    }
    if (current) result.push(current);
    return result;
  }
  type Row = { value: string; font: PDFFont; size: number; leading: number; color: ReturnType<typeof rgb> };
  function rows(value: string, available: number | ((offset: number) => number), font = body, size = 10, leading = size * 1.35, color = ink): Row[] {
    const result: Row[] = [];
    let offset = 0;
    for (const [index, paragraph] of value.split(/\n\s*\n/).entries()) {
      if (index) { result.push({ value: '', font, size, leading: 6, color }); offset += 6; }
      const paragraphOffset = offset;
      const paragraphRows = lines(paragraph, font, size, typeof available === 'number' ? available : (row) => available(paragraphOffset + row * leading));
      result.push(...paragraphRows.map((value) => ({ value, font, size, leading, color })));
      offset += paragraphRows.length * leading;
    }
    return result;
  }
  function drawRows(items: Row[], x: number, from: number, floor: number) {
    let position = from, consumed = 0;
    for (const item of items) {
      if (position - item.leading < floor) break;
      if (item.value) page.drawText(item.value, { x, y: position - item.size, font: item.font, size: item.size, color: item.color });
      position -= item.leading; consumed++;
    }
    return { position, remaining: items.slice(consumed) };
  }
  function picture(image: PDFImage, x: number, y: number, maxWidth: number, maxHeight: number) {
    page.drawImage(image, { x, y, ...image.scaleToFit(maxWidth, maxHeight) });
  }
  function cropped(image: PDFImage, x: number, y: number, w: number, h: number) {
    const scale = Math.max(w / image.width, h / image.height);
    page.pushOperators(pushGraphicsState(), rectangle(x, y, w, h), clip(), endPath());
    page.drawImage(image, { x: x + (w - image.width * scale) / 2, y: y + (h - image.height * scale) / 2, width: image.width * scale, height: image.height * scale });
    page.pushOperators(popGraphicsState());
  }
  // Only request the site's own image URLs; cap reads and timeouts. Missing photos are optional.
  async function photo(source?: string) {
    if (!source) return undefined;
    try {
      const url = new URL(source, newsletter.onlineUrl);
      if (url.origin !== new URL(newsletter.onlineUrl).origin) return undefined;
      if (url.pathname === '/.netlify/images') { url.searchParams.set('w', '720'); url.searchParams.set('h', '440'); }
      const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!response.ok || !response.body) return undefined;
      const reader = response.body.getReader(), chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          length += value.length;
          if (length > 3_000_000) { await reader.cancel(); return undefined; }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = Buffer.concat(chunks);
      return bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    } catch { return undefined; }
  }
  const photos = await Promise.all([photo(newsletter.coverImageSrc), ...newsletter.posts.map((post) => photo(post.imageSrc))]);
  function newPage() {
    page = pdf.addPage([width, height]); column = 0;
    page.drawRectangle({ x: 0, y: 0, width, height, color: paper });
    const first = pdf.getPageCount() === 1;
    page.drawLine({ start: { x: margin, y: height - 11 }, end: { x: width - margin, y: height - 11 }, thickness: digital ? 9 : 2, color: green });
    picture(art.logo, margin, height - 63, 128, 38);
    const title = 'Weekly News', titleSize = 23;
    const titleX = (width - headline.widthOfTextAtSize(title, titleSize)) / 2 + 14;
    page.drawText(title, { x: titleX, y: height - 43, font: headline, size: titleSize, color: green });
    const date = clean(newsletter.formattedDate);
    page.drawText(date, { x: (width - body.widthOfTextAtSize(date, 11)) / 2 + 14, y: height - 62, font: body, size: 11, color: ink });
    picture(art.eden, width - margin - 62, height - 78, 62, 61);
    top = height - (first ? 98 : 96); y = top;
  }
  function cardPanel(cardHeight: number) {
    if (digital) page.drawRectangle({ x: px(), y: Math.max(bottom, y - cardHeight), width: columnWidth, height: Math.min(cardHeight, y - bottom), color: green });
  }
  function ensure(space: number) {
    const required = Math.min(space, height - 96 - bottom);
    while (y - required < bottom) {
      pageBottoms.set(page, Math.min(pageBottoms.get(page) ?? height, y));
      if (column === 0) { column = 1; y = top; } else newPage();
      if (activeCard) cardPanel(y - bottom);
    }
  }
  function text(value: string, font = body, size = 10, color = ink, leading = size * 1.35) {
    for (const item of rows(value, columnWidth - 16, font, size, leading, color)) {
      ensure(item.leading);
      if (item.value) page.drawText(item.value, { x: px() + 8, y: y - size, font, size, color });
      y -= item.leading;
    }
  }
  newPage();
  const frontTop = y, frontFloor = Math.max(bottom + 230, frontTop - 420);
  let leadY = frontTop;
  if (photos[0]) { cropped(photos[0], margin, leadY - 138, leadWidth, 138); leadY -= 151; }
  const leadTitle = newsletter.thought?.title ?? (newsletter.introduction ? 'Life at St John’s Park' : '');
  const leadText = newsletter.thought?.body ?? newsletter.introduction ?? '';
  const leadItems = [...rows(leadTitle.toUpperCase(), leadWidth, headline, 13, 18, green), ...rows(' ', leadWidth), ...rows(leadText, leadWidth, body, 10, 13.5)];
  if (newsletter.thought?.author) leadItems.push(...rows(`— ${newsletter.thought.author}`, leadWidth, bold, 9, 13));
  const leadResult = drawRows(leadItems, margin, leadY, frontFloor);

  const sidebar: Row[] = [];
  const section = (title: string) => { if (sidebar.length) sidebar.push({ value: '', font: body, size: 9, leading: 12, color: ink }); sidebar.push(...rows(title, sideWidth - 22, headline, 12, 18, panelHeading)); };
  const small = (value: string, strong = false) => sidebar.push(...rows(value, sideWidth - 22, strong ? bold : body, 9, 12, panelText));
  if (newsletter.schedule.message) small(newsletter.schedule.message);
  if (newsletter.schedule.status !== 'unavailable') {
    const timetable = pdfTimetable(newsletter.schedule);
    section('THIS SUNDAY');
    const sundayEvents = timetable.sunday?.events.filter((event) => !isMorningPrayer(event)) ?? [];
    if (sundayEvents.length) {
      small(timetable.sunday!.label);
      for (const event of sundayEvents) { small(timeLabel(event), true); small(event.title.replace(/^10:45 Service · /, '')); }
    } else small('No Sunday events listed.');
    section('THIS WEEK');
    if (timetable.prayers.length) {
      small('Morning prayer', true);
      for (const entry of compactSchedule(timetable.prayers)) { small(`${entry.dayLabel} · ${entry.timeLabel}`); if (entry.first.location) small(entry.first.location); }
    }
    for (const day of timetable.days) {
      sidebar.push({ value: '', font: body, size: 9, leading: 8, color: ink });
      small(day.label, true);
      for (const event of day.events) { small(`${timeLabel(event)} · ${event.title}`); }
    }
    if (!timetable.prayers.length && !timetable.days.length) small('No weekday events listed.');
  }
  const sidebarFloor = Math.max(frontFloor + 12, frontTop - 12 - sidebar.reduce((sum, row) => sum + row.leading, 0)) - 12;
  if (digital) page.drawRectangle({ x: sideX, y: Math.min(leadResult.position, sidebarFloor), width: sideWidth, height: frontTop - Math.min(leadResult.position, sidebarFloor), color: green });
  const sideResult = drawRows(sidebar, sideX + 11, frontTop - 12, frontFloor + 12);
  const frontEnd = Math.min(leadResult.position, sideResult.position - 12);
  page.drawRectangle({ x: sideX, y: frontEnd, width: sideWidth, height: frontTop - frontEnd, borderColor: green, borderWidth: .7 });
  top = frontEnd - 20; y = top; column = 0;
  pageBottoms.set(page, y);
  // Very long editorials or busy schedules continue without dropping any text.
  if (leadResult.remaining.length || sideResult.remaining.length) {
    newPage();
    if (leadResult.remaining.length) {
      text(`${leadTitle} (continued)`, headline, 13, green, 19);
      for (const item of leadResult.remaining) text(item.value || ' ', item.font, item.size, item.color, item.leading);
      y -= 14;
    }
    if (sideResult.remaining.length) {
      text('THIS WEEK (CONTINUED)', headline, 12, green, 18);
      for (const item of sideResult.remaining) text(item.value || ' ', item.font, item.size, item.font === headline ? green : ink, item.leading);
      y -= 14;
    }
  }
  for (const [index, post] of newsletter.posts.entries()) {
    const qrSize = 64, qrGap = 10, labelGap = 4, summaryLeading = 13.5;
    const captionRows = rows(digital ? 'Tap or scan for the full story' : 'Scan for the full story', qrSize, body, 8, 10, digital ? panelText : muted);
    const captionHeight = captionRows.reduce((sum, row) => sum + row.leading, 0);
    const qrHeight = qrSize + labelGap + captionHeight;
    const summaryWidth = columnWidth - 16;
    let summaryRows = rows(post.summary, summaryWidth, body, 10, summaryLeading, panelText);
    let summaryHeight = Math.max(qrHeight, summaryRows.reduce((sum, row) => sum + row.leading, 0));
    // Measure the exclusion at the bottom right before drawing. Only the final
    // lines narrow beside the QR and its caption; earlier lines use the column.
    while (true) {
      summaryRows = rows(post.summary, (offset) => offset + summaryLeading > summaryHeight - qrHeight ? summaryWidth - qrSize - qrGap : summaryWidth, body, 10, summaryLeading, panelText);
      if (summaryRows.reduce((sum, row) => sum + row.leading, 0) <= summaryHeight) break;
      summaryHeight += summaryLeading;
    }
    const photoHeight = photos[index + 1] ? 80 : 0;
    const titleHeight = lines(post.title.toUpperCase(), headline, 12, columnWidth - 16).length * 16;
    const detailsHeight = post.eventDetails ? lines(post.eventDetails, bold, 9, columnWidth - 16).length * 12 + 6 : 0;
    activeCard = false;
    const cardHeight = 10 + photoHeight + (photoHeight ? 9 : 0) + titleHeight + 7 + detailsHeight + summaryHeight + 12;
    ensure(cardHeight);
    activeCard = true;
    cardPanel(cardHeight);
    page.drawLine({ start: { x: px(), y }, end: { x: px() + columnWidth, y }, thickness: 1.5, color: green }); y -= 10;
    if (photos[index + 1]) { cropped(photos[index + 1]!, px() + 8, y - photoHeight, columnWidth - 16, photoHeight); y -= photoHeight + 9; }
    text(post.title.toUpperCase(), headline, 12, panelHeading, 16); y -= 7;
    if (post.eventDetails) { text(post.eventDetails, bold, 9, panelText, 12); y -= 6; }
    let prefixHeight = 0, prefixRows = 0;
    for (const item of summaryRows) {
      if (prefixHeight + item.leading > summaryHeight - qrHeight) break;
      ensure(item.leading);
      if (item.value) page.drawText(item.value, { x: px() + 8, y: y - item.size, font: item.font, size: item.size, color: item.color });
      y -= item.leading; prefixHeight += item.leading; prefixRows++;
    }
    // Keep the wrapped final lines, QR and instruction on the same column/page.
    const tailHeight = summaryHeight - prefixHeight;
    ensure(tailHeight + 12);
    drawRows(summaryRows.slice(prefixRows), px() + 8, y, y - tailHeight);
    const summaryBottom = y - tailHeight, qrX = px() + columnWidth - 8 - qrSize;
    const qr = await pdf.embedPng(await QRCode.toDataURL(post.url, { errorCorrectionLevel: 'M', margin: 4, width: 384, color: { dark: digital ? '#1b8257' : '#000000', light: '#ffffff' } }));
    page.drawImage(qr, { x: qrX, y: summaryBottom + captionHeight + labelGap, width: qrSize, height: qrSize });
    let captionY = summaryBottom + captionHeight;
    for (const item of captionRows) {
      page.drawText(item.value, { x: qrX + (qrSize - body.widthOfTextAtSize(item.value, item.size)) / 2, y: captionY - item.size, font: body, size: item.size, color: item.color });
      captionY -= item.leading;
    }
    const link = pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [qrX, summaryBottom, qrX + qrSize, summaryBottom + qrHeight], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(post.url) } });
    page.node.addAnnot(pdf.context.register(link)); y = summaryBottom - 12;
    // A continued card starts with a full-column panel. Trim its unused tail.
    if (digital && y > bottom) page.drawRectangle({ x: px(), y: bottom, width: columnWidth, height: y - bottom, color: paper });
    page.drawLine({ start: { x: px(), y }, end: { x: px() + columnWidth, y }, thickness: .5, color: lineColor }); y -= 16;
    activeCard = false;
    pageBottoms.set(page, Math.min(pageBottoms.get(page) ?? height, y));
  }
  if (!newsletter.posts.length) text('No news for this week.', body, 10, muted);
  activeCard = false;
  if (newsletter.givingUrl) {
    const heading = 'Will You Partner With Us?';
    const givingRows = rows(givingCopy, fullWidth - 95, body, 10, 13);
    const panelHeight = 48 + Math.max(64, givingRows.reduce((sum, row) => sum + row.leading, 0));
    y = Math.min(y, pageBottoms.get(page) ?? y) - 8;
    if (y - panelHeight < bottom) newPage();
    column = 0;
    page.drawRectangle({ x: margin - 2, y: y - panelHeight, width: fullWidth + 4, height: panelHeight + 4, color: paper });
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: green }); y -= 12;
    page.drawText(heading, { x: margin, y: y - 17, font: headline, size: 17, color: green }); y -= 31;
    drawRows(givingRows, margin, y, bottom);
    const qr = await pdf.embedPng(await QRCode.toDataURL(newsletter.givingUrl, { margin: 4, width: 320, color: { dark: digital ? '#1b8257' : '#000000', light: '#ffffff' } }));
    page.drawImage(qr, { x: width - margin - 70, y: y - 64, width: 64, height: 64 });
    const action = pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [margin, y - panelHeight + 43, width - margin, y + 31], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(newsletter.givingUrl) } });
    page.node.addAnnot(pdf.context.register(action));
  }
  const pages = pdf.getPages();
  pages.forEach((footer, index) => {
    footer.drawLine({ start: { x: margin, y: 36 }, end: { x: width - margin, y: 36 }, thickness: .6, color: green });
    const contact = [newsletter.contactEmail, new URL(newsletter.onlineUrl).hostname].filter(Boolean).join('   ·   ');
    footer.drawText(clean(contact), { x: margin, y: 22, size: 8, font: body, color: muted });
    footer.drawText(`${index + 1} / ${pages.length}`, { x: width - margin - 28, y: 22, size: 8, font: body, color: muted });
  });
  return pdf.save();
}
