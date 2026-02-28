import site from "../content/cms/site.json";
import navigation from "../content/cms/navigation.json";
import utilityNavigation from "../content/cms/utility_navigation.json";
import footer from "../content/cms/footer.json";
import components from "../content/cms/components.json";
import sermons from "../content/cms/sermons.json";
import pageBelong from "../content/cms/pages/belong.json";
import pageContact from "../content/cms/pages/contact.json";
import pageContactThankYou from "../content/cms/pages/contact_thank_you.json";
import pageEvents from "../content/cms/pages/events.json";
import pageGive from "../content/cms/pages/give.json";
import pageHome from "../content/cms/pages/home.json";
import pageImNew from "../content/cms/pages/im_new.json";
import pageLifeEvents from "../content/cms/pages/life_events.json";
import pageMinistries from "../content/cms/pages/ministries.json";
import pageParkCommunities from "../content/cms/pages/park_communities.json";
import pageParkKids from "../content/cms/pages/park_kids.json";
import pageParkYouth from "../content/cms/pages/park_youth.json";
import pageSafeguarding from "../content/cms/pages/safeguarding.json";
import pageSermons from "../content/cms/pages/sermons.json";
import pageServe from "../content/cms/pages/serve.json";
import pageSundays from "../content/cms/pages/sundays.json";
import pageTeam from "../content/cms/pages/team.json";
import pageThePark from "../content/cms/pages/the_park.json";
import pageWhatWeBelieve from "../content/cms/pages/what_we_believe.json";
import pageWhatsOn from "../content/cms/pages/whats_on.json";

type ContentSource = "local" | "api" | "sheets";
type PathToken = string | number;

type SitePages = {
  belong: typeof pageBelong;
  contact: typeof pageContact;
  contact_thank_you: typeof pageContactThankYou;
  events: typeof pageEvents;
  give: typeof pageGive;
  home: typeof pageHome;
  im_new: typeof pageImNew;
  life_events: typeof pageLifeEvents;
  ministries: typeof pageMinistries;
  park_communities: typeof pageParkCommunities;
  park_kids: typeof pageParkKids;
  park_youth: typeof pageParkYouth;
  safeguarding: typeof pageSafeguarding;
  sermons: typeof pageSermons;
  serve: typeof pageServe;
  sundays: typeof pageSundays;
  team: typeof pageTeam;
  the_park: typeof pageThePark;
  what_we_believe: typeof pageWhatWeBelieve;
  whats_on: typeof pageWhatsOn;
};

export interface SiteContent {
  site: typeof site;
  navigation: typeof navigation.items;
  utility_navigation: typeof utilityNavigation.items;
  footer: typeof footer;
  components: typeof components;
  pages: SitePages;
  sermons: typeof sermons.items;
}

const localContent: SiteContent = {
  site,
  navigation: navigation.items,
  utility_navigation: utilityNavigation.items,
  footer,
  components,
  pages: {
    belong: pageBelong,
    contact: pageContact,
    contact_thank_you: pageContactThankYou,
    events: pageEvents,
    give: pageGive,
    home: pageHome,
    im_new: pageImNew,
    life_events: pageLifeEvents,
    ministries: pageMinistries,
    park_communities: pageParkCommunities,
    park_kids: pageParkKids,
    park_youth: pageParkYouth,
    safeguarding: pageSafeguarding,
    sermons: pageSermons,
    serve: pageServe,
    sundays: pageSundays,
    team: pageTeam,
    the_park: pageThePark,
    what_we_believe: pageWhatWeBelieve,
    whats_on: pageWhatsOn,
  },
  sermons: sermons.items,
};

let cachedContent: SiteContent | null = null;
const contactThankYouFallback = pageContactThankYou;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const coerceValue = (rawValue: string, type: string): unknown => {
  const normalizedType = type.toLowerCase();

  if (normalizedType === "null") return null;
  if (normalizedType === "boolean") {
    return /^(true|1|yes)$/i.test(rawValue.trim());
  }

  if (normalizedType === "number") {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
      throw new Error(`Invalid number value: ${rawValue}`);
    }
    return numeric;
  }

  if (normalizedType === "json") {
    return JSON.parse(rawValue);
  }

  return rawValue;
};

const tokenizePath = (path: string): PathToken[] => {
  const tokens: PathToken[] = [];
  const regex = /([^.[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(path)) !== null) {
    if (match[1]) {
      tokens.push(match[1]);
    } else if (match[2]) {
      tokens.push(Number(match[2]));
    }
  }

  if (tokens.length === 0) {
    throw new Error(`Invalid content path: ${path}`);
  }

  return tokens;
};

const setValueAtPath = (
  target: Record<string, unknown>,
  path: string,
  value: unknown,
) => {
  const tokens = tokenizePath(path);
  let current: unknown = target;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const isLast = index === tokens.length - 1;
    const nextToken = tokens[index + 1];

    if (isLast) {
      if (typeof token === "number") {
        if (!Array.isArray(current)) {
          throw new Error(`Path ${path} expected array before [${token}]`);
        }
        current[token] = value;
        return;
      }

      if (!isObject(current)) {
        throw new Error(`Path ${path} expected object before ${token}`);
      }

      current[token] = value;
      return;
    }

    const nextContainer = typeof nextToken === "number" ? [] : {};

    if (typeof token === "number") {
      if (!Array.isArray(current)) {
        throw new Error(`Path ${path} expected array before [${token}]`);
      }

      if (current[token] === undefined || current[token] === null) {
        current[token] = nextContainer;
      }

      current = current[token];
      continue;
    }

    if (!isObject(current)) {
      throw new Error(`Path ${path} expected object before ${token}`);
    }

    if (!(token in current) || current[token] === null) {
      current[token] = nextContainer;
    }

    current = current[token];
  }
};

const parseCsvRows = (csvText: string): string[][] => {
  const normalizedCsv = csvText.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < normalizedCsv.length; index += 1) {
    const char = normalizedCsv[index];

    if (inQuotes) {
      if (char === '"') {
        if (normalizedCsv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      pushField();
      continue;
    }

    if (char === "\n") {
      pushField();
      pushRow();
      continue;
    }

    if (char === "\r") {
      if (normalizedCsv[index + 1] === "\n") {
        index += 1;
      }
      pushField();
      pushRow();
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new Error("Invalid CSV: unterminated quoted field.");
  }

  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }

  return rows.filter((candidateRow, index) => {
    const firstValue = candidateRow[0] ?? "";
    return candidateRow.length > 1 || firstValue.trim().length > 0 || index === 0;
  });
};

const parseSheetRowsToContent = (rows: string[][]): SiteContent => {
  if (rows.length === 0) {
    throw new Error("Google Sheet CSV is empty.");
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const pathIndex = header.indexOf("path");
  const typeIndex = header.indexOf("type");
  const valueIndex = header.indexOf("value");

  if (pathIndex === -1 || typeIndex === -1 || valueIndex === -1) {
    throw new Error(
      'Google Sheet CSV header must include "path", "type", and "value" columns.',
    );
  }

  const builtContent: Record<string, unknown> = {};

  for (const row of rows.slice(1)) {
    const path = (row[pathIndex] ?? "").trim();
    if (!path) continue;

    const type = (row[typeIndex] ?? "string").trim() || "string";
    const rawValue = row[valueIndex] ?? "";
    const value = coerceValue(rawValue, type);

    setValueAtPath(builtContent, path, value);
  }

  return builtContent as SiteContent;
};

const fetchFromApiUrl = async (contentApiUrl: string): Promise<SiteContent> => {
  const response = await fetch(contentApiUrl, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch site content from ${contentApiUrl}: ${response.status} ${response.statusText}`,
    );
  }

  return normalizeContent((await response.json()) as SiteContent);
};

const fetchFromGoogleSheets = async (): Promise<SiteContent> => {
  const csvUrlFromEnv =
    import.meta.env.GOOGLE_SHEETS_CSV_URL ?? import.meta.env.CONTENT_CSV_URL;
  const spreadsheetId =
    import.meta.env.GOOGLE_SHEETS_SPREADSHEET_ID ??
    import.meta.env.GOOGLE_SHEETS_ID ??
    "1Ay1kS_--qmW9x0gSi5zSUQvkdQoeiGVQvu30PY6XUxM";
  const sheetGid = import.meta.env.GOOGLE_SHEETS_GID;

  if (!csvUrlFromEnv && !spreadsheetId) {
    throw new Error(
      "Set GOOGLE_SHEETS_CSV_URL (recommended) or GOOGLE_SHEETS_SPREADSHEET_ID/GOOGLE_SHEETS_ID when CONTENT_SOURCE=sheets.",
    );
  }

  const csvUrl = csvUrlFromEnv
    ? csvUrlFromEnv
    : (() => {
        const url = new URL(
          `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export`,
        );
        url.searchParams.set("format", "csv");

        if (sheetGid) {
          url.searchParams.set("gid", sheetGid);
        }

        return url.toString();
      })();

  const response = await fetch(csvUrl, {
    headers: {
      Accept: "text/csv,text/plain;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Google Sheets CSV content: ${response.status} ${response.statusText}`,
    );
  }

  const rows = parseCsvRows(await response.text());

  return normalizeContent(parseSheetRowsToContent(rows));
};

const resolveContentSource = (): ContentSource => {
  const source = (import.meta.env.CONTENT_SOURCE ?? "").toLowerCase();

  if (source === "local" || source === "api" || source === "sheets") {
    return source;
  }

  if (import.meta.env.CONTENT_API_URL) {
    return "api";
  }

  return "local";
};

export async function getSiteContent(): Promise<SiteContent> {
  if (cachedContent) {
    return cachedContent;
  }

  const source = resolveContentSource();

  if (source === "local") {
    cachedContent = localContent;
    return cachedContent;
  }

  if (source === "api") {
    const contentApiUrl = import.meta.env.CONTENT_API_URL;
    if (!contentApiUrl) {
      throw new Error(
        "CONTENT_API_URL is required when CONTENT_SOURCE=api.",
      );
    }

    cachedContent = await fetchFromApiUrl(contentApiUrl);
    return cachedContent;
  }

  cachedContent = await fetchFromGoogleSheets();
  return cachedContent;
}

function normalizeContent(content: SiteContent): SiteContent {
  const navigationValue = Array.isArray(content.navigation)
    ? content.navigation
    : (content.navigation as unknown as { items?: SiteContent["navigation"] })?.items || [];
  const utilityNavigationValue = Array.isArray(content.utility_navigation)
    ? content.utility_navigation
    : (content.utility_navigation as unknown as {
        items?: SiteContent["utility_navigation"];
      })?.items || [];
  const sermonsValue = Array.isArray(content.sermons)
    ? content.sermons
    : (content.sermons as unknown as { items?: SiteContent["sermons"] })?.items || [];

  return {
    ...content,
    navigation: navigationValue,
    utility_navigation: utilityNavigationValue,
    sermons: sermonsValue,
    pages: {
      ...content.pages,
      contact_thank_you: content.pages?.contact_thank_you || contactThankYouFallback,
    },
  };
}
