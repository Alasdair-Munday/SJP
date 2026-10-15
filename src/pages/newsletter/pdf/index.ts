import type { APIRoute } from 'astro';
import { getNewsletterData } from '../../../lib/newsletter';
import { parseIssueDate, dateKey } from '../../../lib/events';
import { renderNewsletterPdf } from '../../../lib/newsletter-pdf';

export const prerender = false;
export const GET: APIRoute = async ({ url }) => {
  let issueDate: Date;
  try { issueDate = parseIssueDate(url.searchParams.get('date')); }
  catch { return new Response('Please choose a valid issue date (YYYY-MM-DD).', { status: 400 }); }
  const bytes = await renderNewsletterPdf(await getNewsletterData(issueDate));
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="sjp-newsletter-${dateKey(issueDate)}.pdf"`,
    'Cache-Control': 'no-store',
  } });
};
