import localContent from "./content.json";

export type SiteContent = typeof localContent;

type ContentSource = "local" | "api" | "sheets";
type PathToken = string | number;

type GoogleSheetValuesResponse = {
  values?: string[][];
};

let cachedContent: SiteContent | null = null;

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

const parseSheetRowsToContent = (rows: string[][]): SiteContent => {
  if (rows.length === 0) {
    throw new Error("Google Sheet is empty.");
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const pathIndex = header.indexOf("path");
  const typeIndex = header.indexOf("type");
  const valueIndex = header.indexOf("value");

  if (pathIndex === -1 || typeIndex === -1 || valueIndex === -1) {
    throw new Error(
      'Google Sheet header must include "path", "type", and "value" columns.',
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

  return (await response.json()) as SiteContent;
};

const fetchFromGoogleSheets = async (): Promise<SiteContent> => {
  // const spreadsheetId =
  //   import.meta.env.GOOGLE_SHEETS_SPREADSHEET_ID ??
  //   import.meta.env.GOOGLE_SHEETS_ID;
  const spreadsheetId = "1Ay1kS_--qmW9x0gSi5zSUQvkdQoeiGVQvu30PY6XUxM";

  const range = import.meta.env.GOOGLE_SHEETS_RANGE ?? "content!A:G";
  const apiKey = import.meta.env.GOOGLE_SHEETS_API_KEY;
  const accessToken = import.meta.env.GOOGLE_SHEETS_ACCESS_TOKEN;

  if (!spreadsheetId) {
    throw new Error(
      "GOOGLE_SHEETS_SPREADSHEET_ID (or GOOGLE_SHEETS_ID) is required when CONTENT_SOURCE=sheets.",
    );
  }

  if (!apiKey && !accessToken) {
    throw new Error(
      "Set GOOGLE_SHEETS_API_KEY (public sheet) or GOOGLE_SHEETS_ACCESS_TOKEN (private sheet) when CONTENT_SOURCE=sheets.",
    );
  }

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
  );

  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Google Sheets content: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as GoogleSheetValuesResponse;
  const rows = payload.values ?? [];

  return parseSheetRowsToContent(rows);
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
