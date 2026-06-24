import { renderNewsletterEmailHtml } from "../../../../lib/newsletter";

export const prerender = true;

export async function GET() {
  return new Response(await renderNewsletterEmailHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
