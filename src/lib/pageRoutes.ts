export type PageTemplateKey = "standard" | "utility";

export interface MappedPageRoute {
  slug: string;
  pageId: string;
  template: PageTemplateKey;
}

export const mappedPageRoutes = [
  { slug: "community", pageId: "community", template: "standard" },
  { slug: "get-involved", pageId: "get-involved", template: "standard" },
  { slug: "visit", pageId: "visit", template: "standard" },
  { slug: "who-we-are", pageId: "who-we-are", template: "standard" },
  { slug: "privacy", pageId: "privacy", template: "utility" },
  { slug: "safeguarding", pageId: "safeguarding", template: "utility" },
  { slug: "cookies", pageId: "cookies", template: "utility" },
] as const satisfies readonly MappedPageRoute[];

export const getMappedPageRoute = (slug: string) =>
  mappedPageRoutes.find((route) => route.slug === slug);
