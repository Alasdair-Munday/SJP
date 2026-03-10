import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const cmsRoot = path.join(repoRoot, "src", "content", "cms");
const publicRoot = path.join(repoRoot, "public");
const uploadsRoot = path.join(publicRoot, "images", "uploads");

const walkJsonFiles = async (root) => {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkJsonFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
};

const rewriteImagePaths = async (value, seenPaths) => {
  if (Array.isArray(value)) {
    for (const item of value) {
      await rewriteImagePaths(item, seenPaths);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (
      key === "src" &&
      typeof child === "string" &&
      child.startsWith("/images/") &&
      !child.startsWith("/images/uploads/")
    ) {
      const sourcePath = path.join(publicRoot, child.replace(/^\//, ""));
      const fileName = path.basename(child);
      const targetPath = path.join(uploadsRoot, fileName);
      await fs.mkdir(uploadsRoot, { recursive: true });
      await fs.copyFile(sourcePath, targetPath);
      value[key] = `/images/uploads/${fileName}`;
      seenPaths.add(value[key]);
      continue;
    }

    await rewriteImagePaths(child, seenPaths);
  }
};

const jsonFiles = await walkJsonFiles(cmsRoot);
const rewrittenPaths = new Set();

for (const filePath of jsonFiles) {
  const data = JSON.parse(await fs.readFile(filePath, "utf8"));
  await rewriteImagePaths(data, rewrittenPaths);
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

console.log(
  `Migrated CMS image references to /images/uploads for ${rewrittenPaths.size} unique files.`,
);
