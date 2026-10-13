import type { APIRoute } from "astro";
import { renderNewsletterEmailHtml } from "../../../../lib/newsletter";
import { parseIssueDate } from "../../../../lib/events";

export const prerender = false;
export const GET: APIRoute = async ({ url }) => {
  let issueDate: Date;
  try { issueDate = parseIssueDate(url.searchParams.get('date')); }
  catch { return new Response('Please choose a valid issue date (YYYY-MM-DD).', { status: 400 }); }
  return new Response(await renderNewsletterEmailHtml(issueDate), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
};
