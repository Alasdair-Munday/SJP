import { relevantToIssue } from "./calendar/newsletter-selection.mjs";
import { getCollection, getEntry, type CollectionEntry } from "astro:content";

export type PageEntry = CollectionEntry<"pages">;
export type PostEntry = CollectionEntry<"posts">;
export type EventEntry = CollectionEntry<"events">;
export type SiteEntry = CollectionEntry<"site">;

export async function getSiteConfig() {
  const siteEntry = await getEntry("site", "global");

  if (!siteEntry) {
    throw new Error("Missing site configuration entry: site/global.");
  }

  return siteEntry.data;
}

export async function getPageContent(id: string) {
  const pageEntry = await getEntry("pages", id);

  if (!pageEntry) {
    throw new Error(`Missing page content entry: pages/${id}.`);
  }

  return pageEntry.data;
}

export const isEventPost = (post: PostEntry) => post.data.category === "event";

export const withoutImageMask = <Image extends { maskShape?: string }>(image: Image) => ({
  ...image,
  maskShape: undefined,
});

export const isUpcomingEventPost = (post: PostEntry) => {
  if (!isEventPost(post) || !post.data.eventDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const comparisonDate = post.data.eventEndDate ?? post.data.eventDate;

  return comparisonDate >= today;
};

const byPublishDateDesc = (left: PostEntry, right: PostEntry) =>
  right.data.publishDate.getTime() - left.data.publishDate.getTime();

export const sortPosts = (posts: PostEntry[]) =>
  [...posts].sort((left, right) => {
    const leftUpcoming = isUpcomingEventPost(left);
    const rightUpcoming = isUpcomingEventPost(right);

    if (leftUpcoming && rightUpcoming) {
      const leftEventTime = left.data.eventDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightEventTime = right.data.eventDate?.getTime() ?? Number.MAX_SAFE_INTEGER;

      if (leftEventTime !== rightEventTime) {
        return leftEventTime - rightEventTime;
      }

      return byPublishDateDesc(left, right);
    }

    if (leftUpcoming) return -1;
    if (rightUpcoming) return 1;

    return byPublishDateDesc(left, right);
  });

export async function getAllPosts() {
  return sortPosts(await getCollection("posts"));
}

export async function getAllEvents() {
  return [...await getCollection("events")].sort((left, right) =>
    left.data.title.localeCompare(right.data.title),
  );
}

export async function getLatestPosts(limit = 3) {
  return (await getAllPosts()).slice(0, limit);
}

export async function getPostsByCategory(category?: PostEntry["data"]["category"]) {
  const posts = await getAllPosts();
  return category ? posts.filter((post) => post.data.category === category) : posts;
}

export async function getFeaturedPosts(limit = 2) {
  return sortPosts((await getCollection("posts")).filter((post) => post.data.featured)).slice(
    0,
    limit,
  );
}

export async function getPostCategories() {
  return Array.from(
    new Set((await getCollection("posts")).map((post) => post.data.category)),
  );
}

export function isRelevantForWeek(post: PostEntry, issueDate: Date) {
  return relevantToIssue(post.data, issueDate);
}

export async function getNewsletterPostsForWeek(targetDate: Date = new Date()) {
  return (await getAllPosts()).filter((post) => isRelevantForWeek(post, targetDate));
}
