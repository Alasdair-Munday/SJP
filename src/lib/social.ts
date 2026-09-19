import { getAllPosts, getSiteConfig } from "./content";
import { getSchedule, dateKey, formatDay, parseIssueDate, timeLabel } from "./events";
import { socialPublicationDates, shortDesignTitle, isSocialPostEligible, captions } from "./social-core.mjs";

export type SocialDraft = {
  slot: "Tuesday" | "Thursday" | "Saturday";
  theme: string;
  publicationDate: string;
  status: "ready" | "needs-content";
  designTitle: string;
  facebookCaption: string;
  instagramCaption: string;
  imageSrc: string;
  imageAlt: string;
  link: string;
  templateUrl: string;
  source: string;
  note?: string;
};

const faithPrompts = [
  { title: "A place for honest questions", body: "Faith can begin with curiosity. You are welcome to bring your questions, take things at your own pace and explore the Christian faith with us.", link: "/visit" },
  { title: "Prayer in everyday life", body: "Prayer does not need special words. It can begin with a quiet moment, an honest sentence and a willingness to listen.", link: "/get-involved" },
  { title: "You are welcome here", body: "Church can feel unfamiliar. At St John’s Park you can arrive as you are, join in as much as you want and meet people from across our community.", link: "/visit" },
  { title: "Hope for the week ahead", body: "Christians trust that God meets us in ordinary life: in joy, uncertainty, work, rest and relationships. We would love to explore that hope with you.", link: "/talks" },
];

const absolute = (href: string, siteUrl: string) => new URL(href, siteUrl).toString();

export async function getSocialDrafts(targetDate = new Date()) {
  const site = await getSiteConfig();
  const dates = socialPublicationDates(dateKey(targetDate));
  const [posts, schedule] = await Promise.all([
    getAllPosts(),
    getSchedule(parseIssueDate(dates.tuesday), parseIssueDate(dates.nextMonday)),
  ]);

  const eligible = posts
    .filter((post) => isSocialPostEligible(post.data, dates.tuesday))
    .sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime())[0];

  const peopleUrl = eligible ? absolute(`/news/${eligible.slug}/`, site.siteUrl) : absolute("/news", site.siteUrl);
  const peopleBody = eligible?.data.socialCaption ?? eligible?.data.summary ?? "Choose one approved photo from church or community life and add a short, specific story about the people, moment or impact shown.";
  const peopleCopy = captions({ intro: eligible?.data.title ?? "A moment from life at St John’s Park", body: peopleBody, url: peopleUrl });
  const people: SocialDraft = {
    slot: "Tuesday",
    theme: "People and story",
    publicationDate: dates.tuesday,
    status: eligible ? "ready" : "needs-content",
    designTitle: shortDesignTitle(eligible?.data.title ?? "A moment from life at St John’s Park"),
    facebookCaption: peopleCopy.facebook,
    instagramCaption: peopleCopy.instagram,
    imageSrc: eligible?.data.socialImage?.src ?? eligible?.data.featuredImage.src ?? "/images/line-drawing.png",
    imageAlt: eligible?.data.socialImage?.alt ?? eligible?.data.featuredImage.alt ?? "",
    link: peopleUrl,
    templateUrl: site.social.canvaTemplates.people,
    source: eligible ? `Website post: ${eligible.data.title}` : "Administrator input required",
    note: eligible ? undefined : "No consent-approved social post is available. Select a suitable website post in the CMS, confirm consent and turn on “Available for Social Media”.",
  };

  const weekNumber = Math.floor(parseIssueDate(dates.tuesday).getTime() / (7 * 86_400_000));
  const faith = faithPrompts[Math.abs(weekNumber) % faithPrompts.length];
  const faithUrl = absolute(faith.link, site.siteUrl);
  const faithCopy = captions({ intro: faith.title, body: faith.body, url: faithUrl });
  const explore: SocialDraft = {
    slot: "Thursday",
    theme: "Explore faith",
    publicationDate: dates.thursday,
    status: "ready",
    designTitle: faith.title,
    facebookCaption: faithCopy.facebook,
    instagramCaption: faithCopy.instagram,
    imageSrc: "/images/line-drawing.png",
    imageAlt: "Line drawing of St John’s Park",
    link: faithUrl,
    templateUrl: site.social.canvaTemplates.people,
    source: "Rotating evergreen website prompt",
  };

  const sunday = schedule.events.find((event) => event.href === "/visit#sundays");
  const sundayUrl = absolute("/visit#sundays", site.siteUrl);
  const sundayTitle = sunday?.title ?? "Sunday at St John’s Park";
  const sundayDetails = sunday
    ? `${formatDay(sunday.start)} at ${timeLabel(sunday)}${sunday.location ? `, ${sunday.location}` : ""}. Come as you are — we would love to welcome you.`
    : `${site.sundaySummary}. Come as you are — we would love to welcome you.`;
  const sundayCopy = captions({ intro: sundayTitle, body: sundayDetails, url: sundayUrl, hashtags: "#StJohnsPark #SheffieldChurch #SundayChurch" });
  const invite: SocialDraft = {
    slot: "Saturday",
    theme: "Sunday invitation",
    publicationDate: dates.saturday,
    status: sunday ? "ready" : "needs-content",
    designTitle: shortDesignTitle(sundayTitle),
    facebookCaption: sundayCopy.facebook,
    instagramCaption: sundayCopy.instagram,
    imageSrc: "/images/line-drawing.png",
    imageAlt: "Line drawing of St John’s Park",
    link: sundayUrl,
    templateUrl: site.social.canvaTemplates.event,
    source: sunday ? "Public Google Calendar" : "Website Sunday summary",
    note: sunday ? undefined : "No linked Sunday calendar entry was found for this week. Check the public calendar before publishing.",
  };

  return { site, dates, schedule, drafts: [people, explore, invite] };
}
