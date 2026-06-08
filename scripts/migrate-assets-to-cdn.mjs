#!/usr/bin/env node
import { createHash, createHmac } from "node:crypto";
import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetRoots = ["public/images/uploads", "public/images/profile-photos"];
const manifestPath = path.join(rootDir, "asset-migration-manifest.json");
const allowedExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const deleteLocal = args.has("--delete-local");
const force = args.has("--force");

const env = (name) => process.env[name] || "";
const trimSlashes = (value) => value.replace(/^\/+|\/+$/g, "");
const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const hmac = (key, value, encoding) => createHmac("sha256", key).update(value).digest(encoding);
const encodePathSegment = (segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
const encodeKey = (key) => key.split("/").map(encodePathSegment).join("/");

const requiredEnv = [
  "ASSET_CDN_BASE_URL",
  "CLOUDFLARE_R2_ACCOUNT_ID",
  "CLOUDFLARE_R2_BUCKET",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
];

const getSigningKey = (dateStamp) => {
  const dateKey = hmac(`AWS4${env("CLOUDFLARE_R2_SECRET_ACCESS_KEY")}`, dateStamp);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
};

const assertConfigured = () => {
  if (dryRun) return;

  const missing = requiredEnv.filter((name) => !env(name));
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(entryPath));
    } else if (entry.isFile() && allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }

  return files;
};

const loadManifest = async () => {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    return {
      generatedAt: null,
      cdnBaseUrl: env("ASSET_CDN_BASE_URL"),
      assets: {},
    };
  }
};

const uploadToR2 = async ({ key, body, contentType }) => {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const host = `${env("CLOUDFLARE_R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${env("CLOUDFLARE_R2_BUCKET")}/${encodeKey(key)}`;
  const payloadHash = sha256Hex(body);
  const headers = {
    "content-type": contentType,
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const sortedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join("");
  const signedHeaders = sortedHeaderNames.join(";");
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signature = hmac(getSigningKey(dateStamp), stringToSign, "hex");

  const response = await fetch(`https://${host}${canonicalUri}`, {
    method: "PUT",
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${env("CLOUDFLARE_R2_ACCESS_KEY_ID")}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Upload failed for ${key}: ${response.status} ${await response.text()}`);
  }
};

const contentTypeFor = (file) => {
  switch (path.extname(file).toLowerCase()) {
    case ".avif": return "image/avif";
    case ".gif": return "image/gif";
    case ".jpeg":
    case ".jpg": return "image/jpeg";
    case ".png": return "image/png";
    case ".svg": return "image/svg+xml";
    case ".webp": return "image/webp";
    default: return "application/octet-stream";
  }
};

const main = async () => {
  assertConfigured();

  const files = (await Promise.all(assetRoots.map((assetRoot) => walk(path.join(rootDir, assetRoot))))).flat();
  const manifest = await loadManifest();
  manifest.generatedAt = new Date().toISOString();
  manifest.cdnBaseUrl = env("ASSET_CDN_BASE_URL") || manifest.cdnBaseUrl;

  console.log(`${dryRun ? "Would migrate" : "Migrating"} ${files.length} assets to Cloudflare R2.`);

  for (const file of files) {
    const relativeFile = path.relative(rootDir, file).split(path.sep).join("/");
    const key = relativeFile.replace(/^public\//, "");
    const publicPath = `/${key}`;
    const existing = manifest.assets[publicPath];

    if (existing && !force) {
      console.log(`skip ${publicPath} (already in manifest)`);
      continue;
    }

    const body = await readFile(file);
    const checksum = sha256Hex(body);
    const size = (await stat(file)).size;
    const configuredBaseUrl = env("ASSET_CDN_BASE_URL") || manifest.cdnBaseUrl || "https://<ASSET_CDN_BASE_URL>";
    const cdnUrl = `${configuredBaseUrl.replace(/\/+$/, "")}/${encodeKey(key)}`;

    console.log(`${dryRun ? "plan" : "upload"} ${publicPath} -> ${cdnUrl}`);

    if (!dryRun) {
      await uploadToR2({ key, body, contentType: contentTypeFor(file) });
    }

    manifest.assets[publicPath] = {
      key,
      cdnUrl,
      size,
      sha256: checksum,
    };
  }

  if (!dryRun) {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  if (deleteLocal) {
    for (const file of files) {
      const publicPath = `/${path.relative(rootDir, file).split(path.sep).join("/").replace(/^public\//, "")}`;
      if (!manifest.assets[publicPath]) continue;
      console.log(`${dryRun ? "would delete" : "delete"} ${publicPath}`);
      if (!dryRun) await rm(file);
    }
  }

  console.log(dryRun ? "Dry run complete. No files changed." : `Migration manifest written to ${path.relative(rootDir, manifestPath)}.`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
