import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";

type HtmlNode = ReturnType<typeof fromHtml> | ReturnType<typeof fromHtml>["children"][number];

const emailStyles: Record<string, string> = {
  p: "margin: 0 0 14px 0;",
  h3: "margin: 20px 0 8px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 20px; line-height: 26px;",
  h4: "margin: 18px 0 8px 0; font-size: 18px; line-height: 24px;",
  h5: "margin: 16px 0 6px 0; font-size: 16px; line-height: 24px;",
  h6: "margin: 16px 0 6px 0; font-size: 16px; line-height: 24px;",
  ul: "margin: 0 0 14px 0; padding-left: 24px;",
  ol: "margin: 0 0 14px 0; padding-left: 24px;",
  li: "margin: 0 0 6px 0;",
  a: "color: #1b8257; text-decoration: underline;",
  blockquote: "margin: 14px 0; padding: 0 0 0 16px; border-left: 3px solid #47a174; color: #5f6f68;",
  img: "display: block; width: 100%; max-width: 480px; height: auto; margin: 14px 0; border: 0;",
  table: "width: 100%; margin: 14px 0; border-collapse: collapse;",
  th: "padding: 6px; border: 1px solid #d9e4dd; text-align: left;",
  td: "padding: 6px; border: 1px solid #d9e4dd;",
  pre: "white-space: pre-wrap; overflow-wrap: anywhere;",
  hr: "margin: 18px 0; border: 0; border-top: 1px solid #d9e4dd;",
};

/** Reuse the article's rendered Markdown, with links that also work outside the site. */
export function prepareNewsletterBodyHtml(html: string, articleUrl: string, email = false) {
  const tree = fromHtml(html, { fragment: true });

  const visit = (node: HtmlNode) => {
    if (node.type !== "element" && node.type !== "root") return;

    if (node.type === "element") {
      for (const attribute of ["href", "src"] as const) {
        const value = node.properties[attribute];
        if (typeof value === "string" && value) {
          node.properties[attribute] = new URL(value, articleUrl).toString();
        }
      }

      // Article headings sit beneath the newsletter's article title (h2).
      if (/^h[1-5]$/.test(node.tagName)) {
        node.tagName = `h${Math.min(6, Math.max(3, Number(node.tagName[1]) + 1))}`;
      }

      delete node.properties.id;
      if (email && emailStyles[node.tagName]) {
        node.properties.style = emailStyles[node.tagName];
        if (node.tagName === "img") node.properties.width = 480;
      }
    }

    node.children.forEach(visit);
  };

  visit(tree);
  return toHtml(tree);
}
