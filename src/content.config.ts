import { defineCollection, z } from "astro:content";

const news = defineCollection({
	type: "content",
	schema: z.object({
		title: z.string(),
		summary: z.string(),
		publishDate: z.coerce.date(),
		staleAfterDays: z.number().int().positive().default(90),
		ctaLabel: z.string().default("Learn more"),
		ctaHref: z.string().default("/contact"),
		secondaryCtaLabel: z.string().optional(),
		secondaryCtaHref: z.string().optional(),
	}),
});

const cms = defineCollection({
	type: "data",
	schema: z.any(),
});

export const collections = {
	news,
	cms,
};
