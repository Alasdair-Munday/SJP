import localContent from "./content.json";

export type SiteContent = typeof localContent;

type ContentSource = "local" | "api" | "sheets";
type PathToken = string | number;

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

  return (await response.json()) as SiteContent;
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
