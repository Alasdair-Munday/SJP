import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getUpcomingCalendarEvents } from "./event-overrides-support.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const cmsRoot = path.join(repoRoot, "src", "content", "cms");
const auditRoots = [
  path.join(repoRoot, "src", "pages"),
  path.join(repoRoot, "src", "components"),
  path.join(repoRoot, "src", "layouts"),
];

const excludedFiles = new Set([
  path.join(repoRoot, "src", "pages", "style-guide.astro"),
  path.join(repoRoot, "src", "pages", "rss.xml.ts"),
  path.join(repoRoot, "src", "components", "Logo.astro"),
]);

const readJson = async (filePath) =>
  JSON.parse(await fs.readFile(filePath, "utf8"));

const walkFiles = async (root, predicate) => {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath, predicate)));
      continue;
    }

    if (entry.isFile() && predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
};

const cmsJsonFiles = await walkFiles(cmsRoot, (filePath) => filePath.endsWith(".json"));
const sourceFiles = (
  await Promise.all(
    auditRoots.map((root) =>
      walkFiles(
        root,
        (filePath) =>
          (filePath.endsWith(".astro") || filePath.endsWith(".ts")) &&
          !excludedFiles.has(filePath),
      ),
    ),
  )
).flat();

const errors = [];

const visitJson = async (value, visitor, currentPath = []) => {
  if (Array.isArray(value)) {
    for (const [index, child] of value.entries()) {
      await visitJson(child, visitor, [...currentPath, String(index)]);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...currentPath, key];
    await visitor(key, child, nextPath);
    await visitJson(child, visitor, nextPath);
  }
};

for (const filePath of cmsJsonFiles) {
  const data = await readJson(filePath);
  await visitJson(data, async (key, value, valuePath) => {
    if (
      key === "src" &&
      typeof value === "string" &&
      value.startsWith("/images/") &&
      !value.startsWith("/images/uploads/")
    ) {
      errors.push(
        `${path.relative(repoRoot, filePath)}: ${valuePath.join(".")} must point to /images/uploads/, found ${value}`,
      );
    }
  });
}

const fallbackAllowlist = [
  'import.meta.env.PUBLIC_SITE_THEME ?? "current"',
  'themeAliases[rawTheme] ?? "current"',
  'card.getAttribute("data-team-name") || ""',
];

for (const filePath of sourceFiles) {
  const text = await fs.readFile(filePath, "utf8");
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (/(\?\?|\|\|)\s*(\{|"|')/.test(line)) {
      const allowed = fallbackAllowlist.some((snippet) => line.includes(snippet));
      if (!allowed) {
        errors.push(
          `${path.relative(repoRoot, filePath)}:${index + 1} contains a fallback literal: ${trimmed}`,
        );
      }
    }

    const imageMatches = [...line.matchAll(/["'`](\/images\/[^"'`]+)["'`]/g)];
    for (const match of imageMatches) {
      const value = match[1];
      if (value === "/favicon.svg" || value === "/favicon.ico") continue;
      if (value.startsWith("/images/uploads/")) continue;
      errors.push(
        `${path.relative(repoRoot, filePath)}:${index + 1} contains a direct image reference outside /images/uploads/: ${value}`,
      );
    }
  });

  if (!filePath.endsWith(".astro")) continue;

  const withoutFrontmatter = text.replace(/^---[\s\S]*?---/, "");
  const withoutComments = withoutFrontmatter
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  const textNodeMatches = withoutComments.matchAll(/>\s*([A-Za-z0-9][^<{]*)\s*</g);
  for (const match of textNodeMatches) {
    const literal = match[1].trim();
    if (
      !literal ||
      literal.includes("{") ||
      literal.includes("}") ||
      !/[A-Za-z]{2,}/.test(literal)
    ) {
      continue;
    }
    errors.push(
      `${path.relative(repoRoot, filePath)} contains hardcoded text node: "${literal}"`,
    );
  }

  const attributeMatches = withoutComments.matchAll(
    /\b(?:aria-label|title|placeholder|alt)\s*=\s*["']([^"']*[A-Za-z][^"']*)["']/g,
  );
  for (const match of attributeMatches) {
    const literal = match[1].trim();
    if (!literal) continue;
    errors.push(
      `${path.relative(repoRoot, filePath)} contains hardcoded attribute copy: "${literal}"`,
    );
  }
}

const overrides = await readJson(path.join(cmsRoot, "event_overrides.json"));
const seriesByUid = new Map(overrides.series.map((entry) => [entry.uid, entry]));
const uniqueUpcomingEvents = [];
const seenUids = new Set();

for (const event of await getUpcomingCalendarEvents(180)) {
  if (seenUids.has(event.uid)) continue;
  seenUids.add(event.uid);
  uniqueUpcomingEvents.push(event);
}

for (const event of uniqueUpcomingEvents) {
  const override = seriesByUid.get(event.uid);
  if (!override) {
    errors.push(`event_overrides.json is missing a series override for uid ${event.uid}`);
    continue;
  }

  if (!override.title?.trim()) {
    errors.push(`event_overrides.json has an empty title for uid ${event.uid}`);
  }

  if (!override.summary?.trim()) {
    errors.push(`event_overrides.json has an empty summary for uid ${event.uid}`);
  }

  if (!override.description_html?.trim()) {
    errors.push(`event_overrides.json has an empty description_html for uid ${event.uid}`);
  }

  if (event.imageAttachments.length > 0 && (!Array.isArray(override.images) || override.images.length === 0)) {
    errors.push(
      `event_overrides.json must provide CMS images for uid ${event.uid} because the source feed contains images`,
    );
  }
}

if (errors.length > 0) {
  console.error("CMS ownership audit failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `CMS ownership audit passed for ${sourceFiles.length} source files and ${uniqueUpcomingEvents.length} event series.`,
);
