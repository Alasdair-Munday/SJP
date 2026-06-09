import { getCollection, getEntry, type CollectionEntry } from "astro:content";

export type PageEntry = CollectionEntry<"pages">;
export type PostEntry = CollectionEntry<"posts">;
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

export function isRelevantForWeek(post: PostEntry, weekStartDate: Date) {
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7);

  // 1. Published this week
  if (post.data.publishDate >= weekStartDate && post.data.publishDate < weekEndDate) {
    return true;
  }

  // 2. Explicitly relevant until
  if (post.data.relevantUntil && post.data.relevantUntil >= weekStartDate) {
    return true;
  }

  // 3. Upcoming/ongoing event this week
  if (post.data.category === "event") {
    const eventDate = post.data.eventDate;
    const eventEndDate = post.data.eventEndDate;

    if (eventDate) {
      // Event happens this week or later
      if (eventDate >= weekStartDate) return true;
      // Event started before this week but ends this week or later
      if (eventEndDate && eventEndDate >= weekStartDate) return true;
    }
  }

  return false;
}

export async function getNewsletterPostsForWeek(targetDate: Date = new Date()) {
  const posts = await getAllPosts();

  // Create a new date to avoid mutating the original targetDate
  const dateObj = new Date(targetDate);
  const day = dateObj.getDay();
  const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const weekStartDate = new Date(dateObj.setDate(diff));
  weekStartDate.setHours(0, 0, 0, 0);

  return posts.filter((post) => isRelevantForWeek(post, weekStartDate));
}
