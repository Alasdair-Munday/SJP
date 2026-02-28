import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const cmsRoot = path.join(repoRoot, "src", "content", "cms");
const pagesRoot = path.join(cmsRoot, "pages");
const outputPath = path.join(repoRoot, "public", "admin", "config.yml");

const friendlyLabels = {
  site: "Site Identity",
  navigation: "Main Navigation",
  utility_navigation: "Utility Navigation",
  footer: "Footer",
  components: "Shared Components",
  sermons: "Sermon Library",
  home: "Home Page",
  sundays: "Sundays Page",
  im_new: "I'm New Page",
  ministries: "What We Do Page",
  park_kids: "Park Kids Page",
  park_youth: "Park Youth Page",
  park_communities: "Park Communities Page",
  life_events: "Life Events Page",
  safeguarding: "Safeguarding Page",
  team: "Team Page",
  contact: "Contact Page",
  contact_thank_you: "Contact Thank You Page",
  sermons_page: "Sermons Page",
  sermons_content: "Sermon Library",
  events: "Events Page",
  serve: "Join a Team Page",
  give: "Give Page",
  belong: "Belong Page",
  whats_on: "What's On Page",
  the_park: "The Park Page",
  what_we_believe: "What We Believe Page",
};

const pageGroups = [
  {
    name: "pages_welcome",
    label: "Welcome Pages",
    pageNames: ["home", "im_new", "sundays", "what_we_believe", "the_park"],
  },
  {
    name: "pages_church_life",
    label: "Church Life Pages",
    pageNames: [
      "ministries",
      "belong",
      "serve",
      "give",
      "park_kids",
      "park_youth",
      "park_communities",
      "life_events",
      "team",
      "safeguarding",
    ],
  },
  {
    name: "pages_updates_events",
    label: "Updates and Events Pages",
    pageNames: ["whats_on", "events", "sermons"],
  },
  {
    name: "pages_contact",
    label: "Contact Pages",
    pageNames: ["contact", "contact_thank_you"],
  },
];

const toLabel = (key) =>
  (friendlyLabels[key] ||
    key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()));

const readJson = async (filePath) =>
  JSON.parse(await fs.readFile(filePath, "utf8"));

const looksLikeImagePath = (value) =>
  typeof value === "string" &&
  (value.includes("/images/") ||
    /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|webp)$/i.test(value));

const inferScalarWidget = (name, value) => {
  if (name === "src" && looksLikeImagePath(value)) {
    return { widget: "image" };
  }

  if (
    typeof value === "string" &&
    /date$/i.test(name) &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return {
      widget: "datetime",
      format: "YYYY-MM-DD",
      date_format: "YYYY-MM-DD",
      time_format: false,
    };
  }

  if (typeof value === "number") {
    return {
      widget: "number",
      value_type: Number.isInteger(value) ? "int" : "float",
    };
  }

  if (typeof value === "boolean") {
    return { widget: "boolean" };
  }

  if (typeof value === "string") {
    if (name.toLowerCase().endsWith("_html")) {
      return { widget: "text" };
    }
    if (value.includes("\n") || value.length > 140 || /<[^>]+>/.test(value)) {
      return { widget: "text" };
    }
    return { widget: "string" };
  }

  return { widget: "string" };
};

const fieldHint = (name, value) => {
  const normalized = name.toLowerCase();
  if (normalized === "src" && looksLikeImagePath(value)) {
    return "Choose/upload an image from the media library.";
  }
  if (normalized === "src" && typeof value === "string") {
    return "Use a file URL/path.";
  }
  if (normalized === "alt") {
    return "Short accessibility description for this image.";
  }
  if (normalized.includes("href") || normalized.includes("url") || normalized.includes("link")) {
    return "Use a full URL (https://...) or site path (/page).";
  }
  if (normalized.endsWith("_html")) {
    return "HTML is allowed in this field.";
  }
  return undefined;
};

const findSummaryKey = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const keys = Object.keys(value);
  const preferred = ["title", "name", "label", "heading", "time"];
  return preferred.find((candidate) => keys.includes(candidate));
};

const inferField = (name, value, depth = 0) => {
  const label = toLabel(name);
  const hint = fieldHint(name, value);
  const required = !(typeof value === "string" && value.trim() === "");

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return {
        label,
        name,
        widget: "list",
        collapsed: true,
        field: {
          label: "Item",
          name: "item",
          widget: "string",
        },
        ...(hint ? { hint } : {}),
      };
    }

    const first = value[0];

    if (first && typeof first === "object" && !Array.isArray(first)) {
      const summaryKey = findSummaryKey(first);
      return {
        label,
        name,
        widget: "list",
        collapsed: true,
        ...(summaryKey ? { summary: `{{fields.${summaryKey}}}` } : {}),
        fields: Object.entries(first).map(([childName, childValue]) =>
          inferField(childName, childValue, depth + 1),
        ),
        ...(hint ? { hint } : {}),
      };
    }

    const itemField = inferField("item", first);
    return {
      label,
      name,
      widget: "list",
      collapsed: true,
      field: {
        label: "Item",
        name: "item",
        ...("fields" in itemField ? { widget: "string" } : itemField),
      },
      ...(hint ? { hint } : {}),
    };
  }

  if (value && typeof value === "object") {
    const summaryKey = findSummaryKey(value);
    return {
      label,
      name,
      widget: "object",
      collapsed: depth >= 1,
      ...(summaryKey ? { summary: `{{${summaryKey}}}` } : {}),
      fields: Object.entries(value).map(([childName, childValue]) =>
        inferField(childName, childValue, depth + 1),
      ),
      ...(hint ? { hint } : {}),
    };
  }

  return {
    label,
    name,
    ...inferScalarWidget(name, value),
    required,
    ...(hint ? { hint } : {}),
  };
};

const inferFields = (record) =>
  Object.entries(record).map(([name, value]) => inferField(name, value));

const run = async () => {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const globals = [
    "site",
    "navigation",
    "utility_navigation",
    "footer",
    "components",
    "sermons",
  ];

  const globalFiles = await Promise.all(
    globals.map(async (name) => {
      const filePath = path.join(cmsRoot, `${name}.json`);
      const content = await readJson(filePath);
      return {
        label: toLabel(name),
        name,
        file: `src/content/cms/${name}.json`,
        format: "json",
        editor: { preview: false },
        fields: inferFields(content),
      };
    }),
  );

  const pageFileNames = (await fs.readdir(pagesRoot))
    .filter((file) => file.endsWith(".json"))
    .sort();

  const pageFiles = await Promise.all(
    pageFileNames.map(async (fileName) => {
      const pageName = path.basename(fileName, ".json");
      const filePath = path.join(pagesRoot, fileName);
      const content = await readJson(filePath);
      return {
        label: toLabel(pageName),
        name: pageName,
        file: `src/content/cms/pages/${fileName}`,
        format: "json",
        editor: { preview: false },
        fields: inferFields(content),
      };
    }),
  );

  const pageFilesByName = Object.fromEntries(
    pageFiles.map((pageFile) => [pageFile.name, pageFile]),
  );

  const pageCollections = pageGroups.map((group) => ({
    name: group.name,
    label: group.label,
    delete: false,
    files: group.pageNames
      .map((pageName) => pageFilesByName[pageName])
      .filter(Boolean),
  }));

  const config = {
    backend: {
      name: "github",
      repo: "Alasdair-Munday/SJP",
      branch: "main",
      base_url: "https://stjohnspark.church",
      auth_endpoint: "/.netlify/functions/auth",
    },
    local_backend: {
      url: "http://localhost:8081/api/v1",
      allowed_hosts: ["localhost", "127.0.0.1"],
    },
    site_url: "https://stjohnspark.church",
    display_url: "https://stjohnspark.church",
    publish_mode: "simple",
    media_folder: "public/images/uploads",
    public_folder: "/images/uploads",
    collections: [
      {
        name: "site_globals",
        label: "Site Settings",
        delete: false,
        files: globalFiles,
      },
      ...pageCollections,
      {
        name: "news",
        label: "News",
        folder: "src/content/news",
        create: true,
        delete: true,
        extension: "md",
        format: "frontmatter",
        slug: "{{slug}}",
        summary: "{{title}} - {{publishDate}}",
        editor: { preview: false },
        media_folder: "public/images/uploads",
        public_folder: "/images/uploads",
        fields: [
          { label: "Title", name: "title", widget: "string" },
          { label: "Summary", name: "summary", widget: "text" },
          {
            label: "Publish Date",
            name: "publishDate",
            widget: "datetime",
            format: "YYYY-MM-DD",
            date_format: "YYYY-MM-DD",
            time_format: false,
          },
          {
            label: "Stale After Days",
            name: "staleAfterDays",
            widget: "number",
            value_type: "int",
            min: 1,
            default: 90,
          },
          {
            label: "Primary CTA Label",
            name: "ctaLabel",
            widget: "string",
            default: "Learn more",
          },
          {
            label: "Primary CTA Href",
            name: "ctaHref",
            widget: "string",
            default: "/contact",
          },
          {
            label: "Secondary CTA Label",
            name: "secondaryCtaLabel",
            widget: "string",
            required: false,
          },
          {
            label: "Secondary CTA Href",
            name: "secondaryCtaHref",
            widget: "string",
            required: false,
          },
          { label: "Body", name: "body", widget: "markdown" },
        ],
      },
    ],
  };

  const yaml = YAML.stringify(config, { indent: 2, lineWidth: 0 });
  await fs.writeFile(outputPath, yaml, "utf8");
  process.stdout.write(`Wrote ${outputPath}\n`);
};

run().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
