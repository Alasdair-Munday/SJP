import type { PostEntry } from "./content";
import { getNewsletterPostsForWeek, getSiteConfig } from "./content";
import { formatDate } from "./format";

type NewsletterPost = {
  category: PostEntry["data"]["category"];
  ctaHref: string;
  ctaLabel: string;
  eventDetails: string;
  imageAlt: string;
  imageSrc: string;
  summary: string;
  title: string;
  url: string;
};

export type NewsletterData = {
  date: Date;
  formattedDate: string;
  logoAlt: string;
  logoSrc: string;
  onlineUrl: string;
  posts: NewsletterPost[];
  shortTitle: string;
  sundaySummary: string;
};

const absolutize = (href: string, baseUrl: string) => new URL(href, baseUrl).toString();

const buildEventDetails = (post: PostEntry) => {
  if (post.data.category !== "event" || !post.data.eventDate) return "";

  return [
    `Event Date: ${formatDate(post.data.eventDate)}`,
    post.data.timeText,
    post.data.location,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");
};

export async function getNewsletterData(targetDate: Date = new Date()): Promise<NewsletterData> {
  const [posts, site] = await Promise.all([
    getNewsletterPostsForWeek(targetDate),
    getSiteConfig(),
  ]);

  return {
    date: targetDate,
    formattedDate: formatDate(targetDate),
    logoAlt: site.brand.lockupAlt,
    logoSrc: absolutize(site.brand.lockupSrc, site.siteUrl),
    onlineUrl: absolutize("/newsletter/", site.siteUrl),
    posts: posts.map((post) => {
      const postUrl = absolutize(`/news/${post.slug}/`, site.siteUrl);

      return {
        category: post.data.category,
        ctaHref: post.data.ctaHref ? absolutize(post.data.ctaHref, site.siteUrl) : postUrl,
        ctaLabel:
          post.data.ctaLabel ?? (post.data.category === "event" ? "View event" : "Read more"),
        eventDetails: buildEventDetails(post),
        imageAlt: post.data.featuredImage.alt,
        imageSrc: absolutize(post.data.featuredImage.src, site.siteUrl),
        summary: post.data.summary,
        title: post.data.title,
        url: postUrl,
      };
    }),
    shortTitle: site.shortTitle,
    sundaySummary: site.sundaySummary,
  };
}

const escapeHtml = (value: string | number) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderPost = (post: NewsletterPost) => `
                <tr>
                  <td style="padding: 0 0 28px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; border-bottom: 1px solid #d9e4dd;">
                      <tr>
                        <td style="padding: 0 0 20px 0;">
                          <img src="${escapeHtml(post.imageSrc)}" width="600" alt="${escapeHtml(post.imageAlt)}" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; border-radius: 8px; background: #fffaf0;" />
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 0 24px 0;">
                          <p style="margin: 0 0 6px 0; color: #47a174; font-family: Arial, sans-serif; font-size: 12px; line-height: 18px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">${escapeHtml(post.category)}</p>
                          <h2 style="margin: 0 0 10px 0; color: #222f2a; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; line-height: 30px; font-weight: 700;">${escapeHtml(post.title)}</h2>
                          ${
                            post.eventDetails
                              ? `<p style="margin: 0 0 12px 0; color: #5f6f68; font-family: Arial, sans-serif; font-size: 15px; line-height: 22px;">${escapeHtml(post.eventDetails)}</p>`
                              : ""
                          }
                          <p style="margin: 0 0 18px 0; color: #222f2a; font-family: Arial, sans-serif; font-size: 16px; line-height: 24px;">${escapeHtml(post.summary)}</p>
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                            <tr>
                              <td bgcolor="#47a174" style="border-radius: 999px;">
                                <a href="${escapeHtml(post.ctaHref)}" style="display: inline-block; padding: 12px 18px; color: #ffffff; font-family: Arial, sans-serif; font-size: 15px; line-height: 18px; font-weight: 700; text-decoration: none;">${escapeHtml(post.ctaLabel)}</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`;

export async function renderNewsletterEmailHtml(targetDate: Date = new Date()) {
  const newsletter = await getNewsletterData(targetDate);
  const preheader =
    newsletter.posts.length > 0
      ? `${newsletter.shortTitle} weekly newsletter for ${newsletter.formattedDate}: ${newsletter.posts
          .map((post) => post.title)
          .slice(0, 3)
          .join(", ")}`
      : `${newsletter.shortTitle} weekly newsletter for ${newsletter.formattedDate}`;

  const postsHtml =
    newsletter.posts.length > 0
      ? newsletter.posts.map(renderPost).join("")
      : `<tr><td style="padding: 0 0 28px 0; color: #222f2a; font-family: Arial, sans-serif; font-size: 16px; line-height: 24px;">No news for this week.</td></tr>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Weekly Newsletter - ${escapeHtml(newsletter.formattedDate)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #eef5f0;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eef5f0" style="border-collapse: collapse; background: #eef5f0;">
      <tr>
        <td align="center" style="padding: 24px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 640px; border-collapse: collapse; background: #ffffff;">
            <tr>
              <td bgcolor="#fffaf0" style="padding: 24px 28px; border-bottom: 4px solid #47a174;">
                <img src="${escapeHtml(newsletter.logoSrc)}" width="148" alt="${escapeHtml(newsletter.logoAlt)}" style="display: block; width: 148px; max-width: 100%; height: auto; margin: 0 0 18px 0; border: 0;" />
                <p style="margin: 0 0 4px 0; color: #47a174; font-family: Arial, sans-serif; font-size: 12px; line-height: 18px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Weekly newsletter</p>
                <h1 style="margin: 0 0 6px 0; color: #222f2a; font-family: Georgia, 'Times New Roman', serif; font-size: 32px; line-height: 38px; font-weight: 700;">News &amp; Updates</h1>
                <p style="margin: 0; color: #5f6f68; font-family: Arial, sans-serif; font-size: 16px; line-height: 24px;">${escapeHtml(newsletter.formattedDate)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
${postsHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="#fffaf0" align="center" style="padding: 22px 28px; border-top: 1px solid #d9e4dd;">
                <p style="margin: 0 0 10px 0; color: #5f6f68; font-family: Arial, sans-serif; font-size: 14px; line-height: 22px;">${escapeHtml(newsletter.shortTitle)} &#183; ${escapeHtml(newsletter.sundaySummary)}</p>
                <p style="margin: 0; color: #5f6f68; font-family: Arial, sans-serif; font-size: 14px; line-height: 22px;"><a href="${escapeHtml(newsletter.onlineUrl)}" style="color: #47a174; font-weight: 700; text-decoration: underline;">View this newsletter online</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
