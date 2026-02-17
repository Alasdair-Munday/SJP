import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contentPath = path.join(root, "src/data/content.json");
const outDir = path.join(root, "docs/google-sheet-template");

const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));

const csvEscape = (value) => {
  const stringValue = String(value ?? "");
  if (/[,"\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const detectType = (value) => {
  if (value === null) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value !== "string") return typeof value;
  if (/<\/?[a-z][\s\S]*>/i.test(value)) return "html";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) return "url";
  if (/^\/(images|audio|events|sermons|[a-z0-9_-]+)/i.test(value)) return "path";
  return "string";
};

const humanize = (value) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

const noteForType = (type) => {
  if (type === "html") {
    return "HTML allowed. Keep links as <a href='...'>text</a>.";
  }
  if (type === "url") {
    return "Use full URL (https://...), mailto:, or tel:.";
  }
  if (type === "path") {
    return "Use site-relative path starting with /.";
  }
  if (type === "number") {
    return "Numeric value only.";
  }
  if (type === "boolean") {
    return "Use TRUE or FALSE.";
  }
  if (type === "null") {
    return "Leave blank if not used.";
  }
  return "Plain text.";
};

const leafLabelFromPath = (pathValue) => {
  const match = pathValue.match(/([^.[\]]+)(?:\[(\d+)\])?$/);
  if (!match) return humanize(pathValue);

  const [, field, index] = match;
  if (index === undefined) {
    return humanize(field);
  }

  return `${humanize(field)} ${Number(index) + 1}`;
};

const groupFromPath = (pathValue) => {
  const first = pathValue.split(".")[0] ?? "content";
  return first.replace(/\[\d+\]/g, "");
};

const sectionFromPath = (pathValue) => {
  const cleaned = pathValue.replace(/\[\d+\]/g, "");
  const pieces = cleaned.split(".").filter(Boolean);
  return pieces.slice(0, 2).join(".") || pieces[0] || "content";
};

const rows = [];

const walk = (value, pathPrefix) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${pathPrefix}[${index}]`));
    return;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      walk(child, pathPrefix ? `${pathPrefix}.${key}` : key);
    });
    return;
  }

  const type = detectType(value);

  rows.push({
    group: groupFromPath(pathPrefix),
    section: sectionFromPath(pathPrefix),
    label: leafLabelFromPath(pathPrefix),
    path: pathPrefix,
    type,
    value: value ?? "",
    notes: noteForType(type),
  });
};

walk(content, "");
rows.sort((a, b) => a.path.localeCompare(b.path));

const adminHeader = ["group", "section", "label", "path", "type", "value", "notes"];
const adminLines = [adminHeader.join(",")];
for (const row of rows) {
  adminLines.push(
    [
      row.group,
      row.section,
      row.label,
      row.path,
      row.type,
      row.value,
      row.notes,
    ]
      .map(csvEscape)
      .join(","),
  );
}

const minimalHeader = ["path", "type", "value"];
const minimalLines = [minimalHeader.join(",")];
for (const row of rows) {
  minimalLines.push([row.path, row.type, row.value].map(csvEscape).join(","));
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "admin-content.csv"),
  `${adminLines.join("\n")}\n`,
);
fs.writeFileSync(
  path.join(outDir, "content.csv"),
  `${minimalLines.join("\n")}\n`,
);

console.log(`Wrote ${rows.length} rows to docs/google-sheet-template/admin-content.csv`);
console.log(`Wrote ${rows.length} rows to docs/google-sheet-template/content.csv`);
