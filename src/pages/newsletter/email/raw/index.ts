import type { APIRoute } from "astro";
import { renderNewsletterEmailHtml } from "../../../../lib/newsletter";
import { parseNewsletterDate } from "../../../../lib/events";

import { newsletterOptions } from '../../../../lib/newsletter-options';

export const prerender = false;
export const GET: APIRoute = async ({ url }) => {
  let issueDate: Date;
  try { issueDate = parseNewsletterDate(url.searchParams.get('date')); }
  catch { return new Response('Please choose a valid issue date (YYYY-MM-DD).', { status: 400 }); }
  return new Response(await renderNewsletterEmailHtml(issueDate, newsletterOptions(url.searchParams)), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
};
