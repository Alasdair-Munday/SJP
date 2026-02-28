import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const sourcePath = path.join(repoRoot, "src", "data", "content.json");
const cmsRoot = path.join(repoRoot, "src", "content", "cms");
const pagesRoot = path.join(cmsRoot, "pages");

const readJson = async (filePath) =>
  JSON.parse(await fs.readFile(filePath, "utf8"));

const writeJson = async (filePath, value) => {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(filePath, json, "utf8");
};

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const withCmsEnhancements = (content) => {
  const next = structuredClone(content);

  next.pages.whats_on.what_we_do_link_intro =
    next.pages.whats_on.what_we_do_link_intro ?? "Looking for more information? Try";
  next.pages.whats_on.what_we_do_link_label =
    next.pages.whats_on.what_we_do_link_label ?? "What We Do";
  next.pages.whats_on.what_we_do_link_href =
    next.pages.whats_on.what_we_do_link_href ?? "/what-we-do";

  next.pages.whats_on.foodbank.image =
    next.pages.whats_on.foodbank.image ?? {
      src: "/images/foodbank.png",
      alt: "Food bank volunteers welcoming people in the church hall",
    };

  next.pages.whats_on.lunch_club.image =
    next.pages.whats_on.lunch_club.image ?? {
      src: "/images/lunch club.jpg",
      alt: "Lunch Club guests and volunteers sharing a meal together",
    };

  next.pages.the_park.subtitle =
    next.pages.the_park.subtitle ??
    "A glimpse into church life in Park: worship, friendship, family, and shared moments through the year.";

  next.pages.what_we_believe.image =
    next.pages.what_we_believe.image ?? {
      src: "/images/stained-glass-cross.jpg",
      alt: "Stained glass cross inside St John's Church",
    };

  next.pages.contact_thank_you =
    next.pages.contact_thank_you ?? {
      title: "Message Sent",
      message: "Thanks for getting in touch. We will reply as soon as we can.",
      button_label: "Return Home",
      button_href: "/",
    };

  next.pages.im_new.gallery =
    next.pages.im_new.gallery ?? [
      {
        src: "/images/congregation.jpg",
        alt: "Church family gathered together during Sunday worship",
        caption: "Sundays are friendly, relaxed, and easy to step into.",
      },
      {
        src: "/images/refreshments.jpg",
        alt: "People talking over refreshments after church",
        caption: "There is always time and space to connect with people.",
      },
    ];

  next.pages.life_events.images =
    next.pages.life_events.images ?? [
      {
        src: "/images/baptism.jpg",
        alt: "Baptism celebration at church",
      },
      {
        src: "/images/carols-doorstep.jpg",
        alt: "Community gathering together at the church entrance",
      },
    ];

  next.pages.safeguarding.policy_download =
    next.pages.safeguarding.policy_download ?? {
      label: "Download Safeguarding Policy (DOCX)",
      href: "https://www.saintjohnspark.org.uk/wp-content/uploads/2025/08/St-Johns-Safeguarding-Policy-2025-2.docx",
    };
  next.pages.safeguarding.image =
    next.pages.safeguarding.image ?? {
      src: "/images/kids-churchyard.jpg",
      alt: "Children and families enjoying activities around the church grounds",
    };

  next.pages.sermons.hero_image =
    next.pages.sermons.hero_image ?? {
      src: "/images/Sermons.jpg",
      alt: "Woman speaking from the front during a Sunday talk",
    };

  next.pages.serve.join_team =
    next.pages.serve.join_team ?? {
      title: "Join a Team",
      intro:
        "Select the teams you are interested in, then share your contact details. We will follow up with next steps.",
      hero_image: {
        src: "/images/friends.jpg",
        alt: "Church volunteers and friends smiling together outdoors",
      },
      hero_blurb:
        "Serving is one of the best ways to build friendships and help church family thrive each week.",
      steps: {
        select_heading: "1. Select Teams",
        select_intro: "Choose as many teams as you like.",
        details_heading: "2. Your Contact Details",
        preview_heading: "3. Message Preview",
        preview_intro:
          "This message is auto-filled from your selections and details.",
      },
      labels: {
        name: "Name",
        email: "Email",
        phone_optional: "Phone (optional)",
        notes_optional: "Anything else we should know? (optional)",
        submit: "Send Team Interest",
      },
      messages: {
        none_selected: "No teams selected yet.",
        selected_prefix: "Selected teams:",
        message_title: "Join a Team Enquiry",
        teams_label: "Teams interested in",
        name_label: "Name",
        email_label: "Email",
        phone_label: "Phone",
        empty_value: "[not provided]",
        none_selected_short: "None selected",
      },
    };

  next.pages.contact.find_us.map_embed_url =
    next.pages.contact.find_us.map_embed_url ??
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1932.9794407157501!2d-1.4558134244165126!3d53.38304895495231!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4879787508b14b63%3A0x3ad4b2dcc392b6b9!2sSt.%20John%E2%80%99s%20Church%2C%20Park!5e1!3m2!1sen!2suk!4v1771371845139!5m2!1sen!2suk";
  next.pages.contact.send_message =
    next.pages.contact.send_message ?? {
      heading: "Send Us a Message",
      intro_prefix: "You can email us directly at",
      direct_email: "hello@saintjohnspark.org",
      intro_suffix: "or use the form below.",
      labels: {
        name: "Name",
        email: "Email",
        subject: "Subject",
        message: "Message",
        submit: "Send Message",
      },
      subject_placeholder: "Select a topic",
      subject_options: [
        {
          value: "general",
          label: "General enquiry",
        },
        {
          value: "park-kids",
          label: "Park Kids",
        },
        {
          value: "park-youth",
          label: "Park Youth",
        },
        {
          value: "park-communities",
          label: "Park Communities",
        },
        {
          value: "sundays",
          label: "Sunday gathering",
        },
        {
          value: "safeguarding",
          label: "Safeguarding",
        },
      ],
    };

  const belongGroup = next.pages.ministries.groups.find((group) => group.id === "belong");
  if (belongGroup) {
    belongGroup.intro =
      belongGroup.intro ?? "Belong by coming on Sundays and joining a midweek group.";
    belongGroup.image =
      belongGroup.image ?? {
        src: "/images/congregation.jpg",
        alt: "Church family and neighbours gathering together in the church grounds",
      };
  }

  const serveGroup = next.pages.ministries.groups.find((group) => group.id === "serve");
  if (serveGroup) {
    serveGroup.intro =
      serveGroup.intro ??
      "Serve by joining a team or connecting with our local outreach ministries.";
    serveGroup.image =
      serveGroup.image ?? {
        src: "/images/lunch club.jpg",
        alt: "Community fun day games on the church field",
      };
  }

  next.pages.give.section_image =
    next.pages.give.section_image ?? {
      src: "/images/PXL_20250816_114550760.PORTRAIT.jpg",
      alt: "Worship team leading sung praise during a Sunday gathering",
    };

  next.components.featured_event =
    next.components.featured_event ?? {
      view_event_details_label: "View Event Details",
      image_coming_soon_label: "Event image coming soon",
    };

  next.components.news =
    next.components.news ?? {
      listing_eyebrow: "News Feed",
      listing_title: "Latest News",
      listing_description:
        "Updates, stories, notices, and opportunities from St John's Park.",
      listing_empty_message: "There are no current news articles at the moment.",
      home_section_title: "Latest News",
      view_all_label: "View all news",
      read_article_label: "Read article",
      back_to_news_label: "Back to News",
      archived_notice:
        "This article is archived and may contain out-of-date details.",
    };

  next.site.brand =
    next.site.brand ?? {
      logo_line_one: "St John's Church",
      logo_line_two: "Park",
      nav_cta_label: "I'm New",
      nav_cta_href: "/im-new",
    };

  next.footer.quick_links_heading =
    next.footer.quick_links_heading ?? "Quick Links";
  next.footer.background_image =
    next.footer.background_image ?? {
      src: "/images/line-drawing.png",
      alt: "",
    };

  return next;
};

const run = async () => {
  const source = withCmsEnhancements(await readJson(sourcePath));

  await ensureDir(cmsRoot);
  await ensureDir(pagesRoot);

  await writeJson(path.join(cmsRoot, "site.json"), source.site);
  await writeJson(path.join(cmsRoot, "navigation.json"), { items: source.navigation });
  await writeJson(path.join(cmsRoot, "utility_navigation.json"), {
    items: source.utility_navigation,
  });
  await writeJson(path.join(cmsRoot, "footer.json"), source.footer);
  await writeJson(path.join(cmsRoot, "components.json"), source.components);
  await writeJson(path.join(cmsRoot, "sermons.json"), { items: source.sermons });

  for (const [pageKey, pageData] of Object.entries(source.pages)) {
    await writeJson(path.join(pagesRoot, `${pageKey}.json`), pageData);
  }

  process.stdout.write(
    `Wrote CMS content files to ${cmsRoot} and ${pagesRoot} from ${sourcePath}.\n`,
  );
};

run().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
