import { defineCollection, z } from "astro:content";

const toneSchema = z.enum([
  "park",
  "park-dark",
  "stone",
  "pink",
  "sky",
  "night",
  "grass",
  "door",
  "roof",
]);

const linkSchema = z.object({
  label: z.string(),
  href: z.string(),
  newTab: z.boolean().default(false),
});

const imageSchema = z.object({
  src: z.string(),
  alt: z.string(),
  maskShape: z.string().optional(),
  accentShape: z.string().optional(),
  wordArtShape: z.string().optional(),
  objectPosition: z.string().optional(),
  frameTone: toneSchema.optional(),
});

const cardSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string(),
  href: z.string().optional(),
  linkLabel: z.string().optional(),
  tag: z.string().optional(),
  tone: toneSchema.optional(),
  image: imageSchema.optional(),
  featured: z.boolean().optional(),
});

const heroSectionSchema = z.object({
  type: z.literal("hero"),
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string(),
  backgroundTone: toneSchema.default("park"),
  primaryCta: linkSchema.optional(),
  secondaryCta: linkSchema.optional(),
  image: imageSchema.optional(),
  highlightLabel: z.string().optional(),
});

const introSectionSchema = z.object({
  type: z.literal("intro"),
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string(),
  backgroundTone: toneSchema.default("stone"),
  ctas: z.array(linkSchema).default([]),
});

const splitSectionSchema = z.object({
  type: z.literal("split"),
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string(),
  points: z.array(z.string()).default([]),
  backgroundTone: toneSchema.default("stone"),
  image: imageSchema,
  reverse: z.boolean().default(false),
  ctas: z.array(linkSchema).default([]),
});

const cardsSectionSchema = z.object({
  type: z.literal("cards"),
  eyebrow: z.string().optional(),
  title: z.string(),
  intro: z.string().optional(),
  backgroundTone: toneSchema.default("stone"),
  columns: z.number().int().min(1).max(4).default(3),
  cards: z.array(cardSchema).min(1),
});

const ctaSectionSchema = z.object({
  type: z.literal("cta"),
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string(),
  backgroundTone: toneSchema.default("park-dark"),
  primaryCta: linkSchema,
  secondaryCta: linkSchema.optional(),
  image: imageSchema.optional(),
});

const latestSectionSchema = z.object({
  type: z.literal("latest"),
  eyebrow: z.string().optional(),
  title: z.string(),
  intro: z.string().optional(),
  backgroundTone: toneSchema.default("pink"),
  source: z.enum(["posts", "talks"]),
  limit: z.number().int().min(1).max(6).default(3),
  cta: linkSchema,
});

const richTextSectionSchema = z.object({
  type: z.literal("richText"),
  eyebrow: z.string().optional(),
  title: z.string().optional(),
  contentHtml: z.string(),
  backgroundTone: toneSchema.default("stone"),
});

const sectionSchema = z.discriminatedUnion("type", [
  heroSectionSchema,
  introSectionSchema,
  splitSectionSchema,
  cardsSectionSchema,
  ctaSectionSchema,
  latestSectionSchema,
  richTextSectionSchema,
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
    ]),
    sections: z.array(sectionSchema).default([]),
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
      rssLabel: z.string(),
      rssHref: z.string(),
    }),
  }),
});

const posts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    publishDate: z.coerce.date(),
    category: z.enum(["event", "update", "blog"]),
    featuredImage: imageSchema,
    featuredShape: z.string().optional(),
    eventDate: z.coerce.date().optional(),
    eventEndDate: z.coerce.date().optional(),
    timeText: z.string().optional(),
    location: z.string().optional(),
    ctaLabel: z.string().optional(),
    ctaHref: z.string().optional(),
    featured: z.boolean().default(false),
    relevantUntil: z.coerce.date().optional(),
  }),
});

export const collections = {
  pages,
  posts,
  site,
};
