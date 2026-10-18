import type { APIRoute } from 'astro';
import { getNewsletterData } from '../../../lib/newsletter';
import { parseNewsletterDate, dateKey } from '../../../lib/events';
import { renderNewsletterPdf } from '../../../lib/newsletter-pdf';

export const prerender = false;
export const GET: APIRoute = async ({ url }) => {
  let issueDate: Date;
  try { issueDate = parseNewsletterDate(url.searchParams.get('date')); }
  catch { return new Response('Please choose a valid issue date (YYYY-MM-DD).', { status: 400 }); }
  const edition = url.searchParams.get('edition') ?? 'print';
  if (edition !== 'print' && edition !== 'digital') return new Response('Choose print or digital edition.', { status: 400 });
  const bytes = await renderNewsletterPdf(await getNewsletterData(issueDate), edition);
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="sjp-newsletter-${dateKey(issueDate)}-${edition}.pdf"`,
    'Cache-Control': 'no-store',
  } });
};
