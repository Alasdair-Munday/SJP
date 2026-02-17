import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const defaultSpreadsheetId = "1Ay1kS_--qmW9x0gSi5zSUQvkdQoeiGVQvu30PY6XUxM";
const requiredHeaders = ["path", "type", "value"];

const printUsage = () => {
  console.log(`Usage:
  node scripts/validate-sheet-csv.mjs [options]

Options:
  --file <path>   Validate a local CSV file (repeatable)
  --url <url>     Validate a CSV URL (repeatable)
  --tabs          Validate all CSV files in docs/google-sheet-template/tabs
  --help          Show this help

Default behavior:
  If no options are provided, validates the runtime sheet CSV URL from:
  GOOGLE_SHEETS_CSV_URL or CONTENT_CSV_URL, otherwise
  https://docs.google.com/spreadsheets/d/<id>/export?format=csv[&gid=<GOOGLE_SHEETS_GID>]
`);
};

const parseCsvRows = (csvText) => {
  const normalizedCsv = csvText.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
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

const validateValueType = (rawValue, type, sourceName, rowNumber) => {
  const normalizedType = type.toLowerCase();

  if (normalizedType === "number") {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
      throw new Error(
        `[${sourceName}] row ${rowNumber}: invalid number value "${rawValue}".`,
      );
    }
  }

  if (normalizedType === "json") {
    try {
      JSON.parse(rawValue);
    } catch {
      throw new Error(
        `[${sourceName}] row ${rowNumber}: invalid JSON value "${rawValue}".`,
      );
    }
  }
};

const validateRows = (rows, sourceName) => {
  if (rows.length === 0) {
    throw new Error(`[${sourceName}] CSV is empty.`);
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const headerIndices = Object.fromEntries(
    requiredHeaders.map((key) => [key, header.indexOf(key)]),
  );

  for (const key of requiredHeaders) {
    if (headerIndices[key] === -1) {
      throw new Error(
        `[${sourceName}] header must include "${requiredHeaders.join('", "')}" columns.`,
      );
    }
  }

  const paths = [];

  for (let index = 1; index < rows.length; index += 1) {
    const rowNumber = index + 1;
    const row = rows[index];
    const rowPath = (row[headerIndices.path] ?? "").trim();

    if (!rowPath) continue;

    const rowType = (row[headerIndices.type] ?? "string").trim() || "string";
    const rowValue = row[headerIndices.value] ?? "";

    validateValueType(rowValue, rowType, sourceName, rowNumber);
    paths.push({ path: rowPath, sourceName, rowNumber });
  }

  return {
    rowCount: rows.length - 1,
    populatedRowCount: paths.length,
    paths,
  };
};

const buildRuntimeCsvUrl = () => {
  const explicitUrl = process.env.GOOGLE_SHEETS_CSV_URL ?? process.env.CONTENT_CSV_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  const spreadsheetId =
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID ??
    process.env.GOOGLE_SHEETS_ID ??
    defaultSpreadsheetId;
  const gid = process.env.GOOGLE_SHEETS_GID;

  const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export`);
  url.searchParams.set("format", "csv");
  if (gid) {
    url.searchParams.set("gid", gid);
  }

  return url.toString();
};

const readSource = async (source) => {
  if (source.kind === "file") {
    return fs.readFileSync(source.value, "utf8");
  }

  const response = await fetch(source.value, {
    headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.8" },
  });

  if (!response.ok) {
    throw new Error(
      `[${source.name}] failed to fetch CSV: ${response.status} ${response.statusText}`,
    );
  }

  return await response.text();
};

const collectSources = (args) => {
  const sources = [];
  let includeTabs = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--tabs") {
      includeTabs = true;
      continue;
    }

    if (arg === "--file" || arg === "--url") {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`Missing value for ${arg}.`);
      }
      index += 1;
      const kind = arg === "--file" ? "file" : "url";
      const resolvedValue =
        kind === "file" ? path.resolve(root, value) : value;
      sources.push({
        kind,
        value: resolvedValue,
        name: kind === "file" ? path.relative(root, resolvedValue) : value,
      });
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (includeTabs) {
    const tabsDir = path.join(root, "docs/google-sheet-template/tabs");
    if (!fs.existsSync(tabsDir)) {
      throw new Error(
        "Tabs directory not found. Run `npm run content:sheet-template` first.",
      );
    }

    const tabFiles = fs
      .readdirSync(tabsDir)
      .filter((fileName) => fileName.endsWith(".csv"))
      .sort();

    for (const fileName of tabFiles) {
      const absolutePath = path.join(tabsDir, fileName);
      sources.push({
        kind: "file",
        value: absolutePath,
        name: path.relative(root, absolutePath),
      });
    }
  }

  if (sources.length === 0) {
    const url = buildRuntimeCsvUrl();
    sources.push({ kind: "url", value: url, name: url });
  }

  return sources;
};

const main = async () => {
  const args = process.argv.slice(2);
  const sources = collectSources(args);
  const validations = [];
  const allPaths = new Map();

  for (const source of sources) {
    const csvText = await readSource(source);
    const rows = parseCsvRows(csvText);
    const result = validateRows(rows, source.name);
    validations.push({ source, result });

    for (const pathEntry of result.paths) {
      const existing = allPaths.get(pathEntry.path) ?? [];
      existing.push(pathEntry);
      allPaths.set(pathEntry.path, existing);
    }
  }

  const errors = [];
  for (const [pathValue, occurrences] of allPaths.entries()) {
    if (occurrences.length <= 1) continue;
    const locationText = occurrences
      .map((entry) => `${entry.sourceName}:row${entry.rowNumber}`)
      .join(", ");
    errors.push(`Duplicate path "${pathValue}" found at ${locationText}`);
  }

  if (errors.length > 0) {
    console.error("Sheet CSV validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const sourceSummary = validations
    .map(
      ({ source, result }) =>
        `- ${source.name}: ${result.populatedRowCount} populated content rows`,
    )
    .join("\n");
  console.log("Sheet CSV validation passed.");
  console.log(sourceSummary);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
