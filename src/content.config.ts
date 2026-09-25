import { defineCollection, z } from "astro:content";

const toneSchema = z.enum([
  "park",
  "park-dark",
  "stone",
  "pink",
  "pink-dark",
  "orange",
  "sky",
  "night",
  "grass",
  "door",
  "roof",
  "give",
]);

const linkSchema = z.object({
  label: z.string(),
  href: z.string(),
  newTab: z.boolean().default(false),
});

const optionalLinkSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return undefined;
  const link = value as { label?: unknown; href?: unknown };
  if (typeof link.label !== "string" || !link.label.trim() ||
      typeof link.href !== "string" || !link.href.trim()) return undefined;
  return value;
}, linkSchema.optional());

const optionalLinksSchema = z.preprocess(
  (value) => value ?? [],
  z.array(optionalLinkSchema).transform((links) => links.filter(
    (link): link is z.infer<typeof linkSchema> => link !== undefined,
  )),
);

const imageSchema = z.object({
  src: z.string(),
  alt: z.string().default(""),
  maskShape: z.string().optional(),
  accentShape: z.string().optional(),
  accentTone: toneSchema.optional(),
  wordArtShape: z.string().optional(),
  objectPosition: z.string().optional(),
  frameTone: toneSchema.optional(),
  gallery: z
    .array(
      z.object({
        src: z.string(),
        alt: z.string().optional(),
        objectPosition: z.string().optional(),
      }),
    )
    .optional(),
});

const optionalImageSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return undefined;

  const image = value as { src?: unknown };

  if (typeof image.src !== "string" || image.src.trim() === "") {
    return undefined;
  }

  return value;
}, imageSchema.optional());

const defaultPostFeaturedImage = {
  src: "/images/line-drawing.png",
  alt: "Line drawing of St John's Park",
  maskShape: "/images/shapes/rectangle-cut-corner.png",
  frameTone: "stone" as const,
};

const postFeaturedImageSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return defaultPostFeaturedImage;

  const image = value as { src?: unknown; alt?: unknown };

  if (typeof image.src !== "string" || image.src.trim() === "") {
    return defaultPostFeaturedImage;
  }

  return {
    ...image,
    alt: typeof image.alt === "string" ? image.alt : "",
  };
}, imageSchema);

const cardSchema = z.object({
  id: z.string().optional(),
  calendarTarget: z.string().optional(),
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
  href: z.string().optional(),
  linkLabel: z.string().optional(),
  tag: z.string().optional(),
  tone: toneSchema.optional(),
  iconShape: z.string().optional(),
  image: optionalImageSchema,
  featured: z.boolean().optional(),
});

const optionalDateSchema = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;

  return value;
}, z.coerce.date().optional());

const optionalUrlSchema = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value;
}, z.string().url().optional());

const postCategorySchema = z
  .enum(["event", "update", "blog", "news", "story"])
  .default("update")
  .transform((category) => {
    if (category === "news") return "update";
    if (category === "story") return "blog";
    return category;
  });

const heroSectionSchema = z.object({
  type: z.literal("hero"),
  id: z.string().optional(),
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string(),
  backgroundTone: toneSchema.default("park"),
  primaryCta: optionalLinkSchema,
  secondaryCta: optionalLinkSchema,
  image: optionalImageSchema,
  highlightLabel: z.string().optional(),
});

const introSectionSchema = z.object({
  calendarTarget: z.string().optional(),
  type: z.literal("intro"),
  id: z.string().optional(),
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string(),
  backgroundTone: toneSchema.default("stone"),
  ctas: optionalLinksSchema,
});

const splitSectionSchema = z.object({
  calendarTarget: z.string().optional(),
  type: z.literal("split"),
  id: z.string().optional(),
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string(),
  points: z.array(z.string()).default([]),
  backgroundTone: toneSchema.default("stone"),
  image: optionalImageSchema,
  reverse: z.boolean().default(false),
  ctas: optionalLinksSchema,
});

const cardsSectionSchema = z.object({
  type: z.literal("cards"),
  id: z.string().optional(),
  eyebrow: z.string().optional(),
  title: z.string(),
  intro: z.string().optional(),
  backgroundTone: toneSchema.default("stone"),
  columns: z.number().int().min(1).max(8).default(3),
  cards: z.array(cardSchema).min(1),
});

const ctaSectionSchema = z.object({
  type: z.literal("cta"),
  id: z.string().optional(),
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string(),
  backgroundTone: toneSchema.default("park-dark"),
  primaryCta: optionalLinkSchema,
  secondaryCta: optionalLinkSchema,
  image: optionalImageSchema,
});

const latestSectionSchema = z.object({
  type: z.literal("latest"),
  id: z.string().optional(),
  eyebrow: z.string().optional(),
  title: z.string(),
  intro: z.string().optional(),
  backgroundTone: toneSchema.default("pink"),
  source: z.enum(["posts", "talks"]),
  limit: z.number().int().min(1).max(6).default(3),
  cta: optionalLinkSchema,
});

const richTextSectionSchema = z.object({
  type: z.literal("richText"),
  id: z.string().optional(),
  eyebrow: z.string().optional(),
  title: z.string().optional(),
  contentHtml: z.string(),
  backgroundTone: toneSchema.default("stone"),
});

const whatsOnSectionSchema = z.object({
  type: z.literal("whatsOn"),
  id: z.string().optional(),
  title: z.string().default("This week"),
  backgroundTone: toneSchema.default("sky"),
});

const sectionSchema = z.discriminatedUnion("type", [
  heroSectionSchema,
  introSectionSchema,
  splitSectionSchema,
  cardsSectionSchema,
  ctaSectionSchema,
  latestSectionSchema,
  richTextSectionSchema,
  whatsOnSectionSchema,
]);

const pages = defineCollection({
  type: "data",
  schema: z.object({
    title: z.string(),
    metaTitle: z.string().optional(),
    metaDescription: z.string(),
    template: z.enum([
      "home",
      "standard",
      "publishing",
      "news",
      "talks",
      "utility",
      "events",
    ]),
    sections: z.array(sectionSchema).default([]),
    eyebrow: z.string().optional(),
    intro: z.string().optional(),
    featuredEvents: z.array(z.object({ event: z.string() })).default([]),
  }),
});

const site = defineCollection({
  type: "data",
  schema: z.object({
    title: z.string(),
    shortTitle: z.string(),
    siteUrl: z.string().url(),
    metaDescription: z.string(),
    sundaySummary: z.string(),
    brand: z.object({
      lockupSrc: z.string(),
      lockupAlt: z.string(),
      iconLabel: z.string(),
      iconColor: z.string(),
    }),
    navigation: z.array(linkSchema),
    navCta: linkSchema.optional(),
    footer: z.object({
      blurb: z.string(),
      quickLinks: z.array(linkSchema),
      policyLinks: z.array(linkSchema),
      serviceLabel: z.string(),
      contactLabel: z.string(),
    }),
    contact: z.object({
      email: z.string().email(),
      phone: z.string().optional(),
      addressLines: z.array(z.string()),
      mapUrl: z.string().url(),
      mapEmbedUrl: z.string().url(),
      lifeEventsIntro: z.string(),
      lifeEventLinks: z.array(linkSchema),
      formSubjects: z.array(
        z.object({
          value: z.string(),
          label: z.string(),
        }),
      ),
      safeguardingEmail: z.string().email(),
    }),
    policyDownload: z.object({
      label: z.string(),
      href: z.string(),
    }),
    talks: z.object({
      spotifyLabel: z.string(),
      spotifyHref: z.string().url(),
      rssLabel: z.string(),
      rssHref: z.string(),
    }),
    social: z.object({
      facebookUrl: optionalUrlSchema,
      instagramUrl: optionalUrlSchema,
      socialMediaEmail: z.string().email(),
      consentGuidance: z.string(),
      canvaFolderUrl: z.string().url(),
      canvaTemplates: z.object({
        people: z.string().url(),
        event: z.string().url(),
        story: z.string().url(),
      }),
    }),
  }),
});

const posts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    publishDate: z.coerce.date(),
    category: postCategorySchema,
    featuredImage: postFeaturedImageSchema.default(defaultPostFeaturedImage),
    featuredShape: z.string().optional(),
    eventDate: optionalDateSchema,
    eventEndDate: optionalDateSchema,
    timeText: z.string().optional(),
    location: z.string().optional(),
    ctaLabel: z.string().optional(),
    ctaHref: z.string().optional(),
    featured: z.boolean().default(false),
    displayOnNewsletter: z.boolean().default(true),
    newsletterDisplayUntil: optionalDateSchema,
    relevantUntil: optionalDateSchema,
    socialEnabled: z.boolean().default(false),
    socialCaption: z.string().optional(),
    socialImage: optionalImageSchema,
    socialConsentConfirmed: z.boolean().default(false),
    socialDoNotUseAfter: optionalDateSchema,
  }),
});

const events = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    location: z.string().optional(),
    timeText: z.string().optional(),
    image: optionalImageSchema,
  }),
});

export const collections = {
  pages,
  posts,
  events,
  site,
};
